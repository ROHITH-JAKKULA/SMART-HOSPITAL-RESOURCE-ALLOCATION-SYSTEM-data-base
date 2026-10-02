"""ResourceAllocator orchestrator managing hospital state, runs, aging, undo, and event logging."""
import copy
import time
from dataclasses import dataclass, field
from typing import List, Dict, Tuple, Optional, Any
from collections import deque

import config
from models.patient import Patient, Status
from models.hospital import Hospital, DomainError
from utils.scoring import calculate_priority, waiting_level, priority_band
from .priority_queue import MaxHeap, OpCounter
from .greedy_allocator import (
    find_plan_baseline,
    find_plan_indexed,
    commit_plan,
    ResourcePlan
)


@dataclass
class TraceStep:
    step_no: int
    patient_id: str
    patient_name: str
    priority: int
    band: str
    heap_size_before: int
    heap_snapshot: Optional[List[dict]]
    required: Dict[str, str]
    checks: Dict[str, str]
    result: Status
    assigned: Dict[str, Optional[str]]
    reason_codes: List[str]
    unit_checks_used: int


@dataclass
class Metrics:
    total_patients: int
    allocated_count: int
    waiting_count: int
    unavailable_count: int
    completed_count: int
    not_arrived_count: int

    beds_total: int
    beds_busy: int
    beds_util_pct: float

    doctors_total: int
    doctors_busy: int
    doctors_util_pct: float

    equipment_total: int
    equipment_busy: int
    equipment_util_pct: float

    overall_total: int
    overall_busy: int
    overall_util_pct: float

    allocation_rate: float
    avg_priority_all: float
    avg_priority_allocated: float
    avg_priority_unserved: float

    avg_wait_allocated: float
    avg_wait_unserved: float
    max_wait_allocated: int
    max_wait_unserved: int

    weighted_score: int
    bypass_count: int


@dataclass
class AllocationResult:
    trace: List[TraceStep]
    metrics: Metrics
    ops: OpCounter
    runtime_ms: float
    strategy: str
    order: str
    clock: int
    bypass_count: int


@dataclass
class RunSummary:
    run_id: int
    clock: int
    strategy: str
    order: str
    patients: int
    allocated: int
    waiting: int
    unavailable: int
    overall_utilization_pct: float
    avg_priority: float
    weighted_score: int
    bypass_count: int
    unit_checks: int
    runtime_ms: float


@dataclass
class Event:
    clock: int
    kind: str
    details: str


class ResourceAllocator:
    """Core stateful orchestrator for hospital resource allocation."""

    def __init__(
        self,
        hospital: Hospital,
        patients: List[Patient],
        clock: int = config.DEMO_START_CLOCK,
        weights: Optional[Dict[str, int]] = None
    ):
        self.hospital = hospital
        self.patients = patients
        self.clock = clock
        self.weights = weights or dict(config.DEFAULT_WEIGHTS)

        self.history: List[RunSummary] = []
        self.event_log: List[Event] = []
        self._undo_stack: List[dict] = []
        self._run_counter: int = 0

        self.log_event("SCENARIO_LOADED", f"{len(self.patients)} patients, {len(self.hospital.beds)} beds, {len(self.hospital.doctors)} doctors, {len(self.hospital.equipment)} eqp")

    def log_event(self, kind: str, details: str) -> None:
        """Appends an event to the audit trail."""
        self.event_log.append(Event(clock=self.clock, kind=kind, details=details))

    def push_undo_snapshot(self) -> None:
        """Saves a deep copy of state to the undo stack."""
        snapshot = {
            "hospital": copy.deepcopy(self.hospital),
            "patients": copy.deepcopy(self.patients),
            "clock": self.clock,
            "weights": dict(self.weights),
            "event_log_len": len(self.event_log)
        }
        self._undo_stack.append(snapshot)
        if len(self._undo_stack) > config.UNDO_DEPTH:
            self._undo_stack.pop(0)

    def undo(self) -> bool:
        """Restores the last snapshot from the undo stack."""
        if not self._undo_stack:
            return False

        snapshot = self._undo_stack.pop()
        self.hospital = snapshot["hospital"]
        self.patients = snapshot["patients"]
        self.clock = snapshot["clock"]
        self.weights = snapshot["weights"]
        self.event_log = self.event_log[:snapshot["event_log_len"]]

        self.log_event("UNDO", f"Reverted state at clock {self.clock}")
        return True

    def clone(self) -> "ResourceAllocator":
        """Creates an independent deep copy without undo history."""
        alloc = ResourceAllocator(
            hospital=copy.deepcopy(self.hospital),
            patients=copy.deepcopy(self.patients),
            clock=self.clock,
            weights=dict(self.weights)
        )
        alloc.history = list(self.history)
        alloc.event_log = list(self.event_log)
        return alloc

    def advance_clock(self, minutes: int) -> None:
        """Advances hospital clock forward by minutes (positive only)."""
        if minutes <= 0:
            raise DomainError("Clock advance must be a positive integer.")
        self.clock += minutes
        self.log_event("CLOCK_ADVANCED", f"+{minutes} min -> clock {self.clock}")

    def add_patient(self, p: Patient) -> None:
        """Adds a patient after case-insensitive ID uniqueness check."""
        pid_lower = p.patient_id.strip().lower()
        for existing in self.patients:
            if existing.patient_id.strip().lower() == pid_lower:
                raise DomainError(f"Patient ID '{p.patient_id}' already exists.")

        p.arrival_seq = len(self.patients) + 1
        self.patients.append(p)
        self.log_event("PATIENT_ADDED", p.patient_id)

    def remove_patient(self, patient_id: str) -> None:
        """Removes a patient; if currently allocated, releases their units first."""
        target = next((p for p in self.patients if p.patient_id == patient_id), None)
        if not target:
            raise DomainError(f"Patient '{patient_id}' not found.")

        if target.status == Status.ALLOCATED:
            self._release_patient_units(target)

        self.patients = [p for p in self.patients if p.patient_id != patient_id]
        self.log_event("PATIENT_REMOVED", patient_id)

    def discharge(self, patient_id: str) -> None:
        """Discharges an allocated patient and frees their assigned resources."""
        target = next((p for p in self.patients if p.patient_id == patient_id), None)
        if not target:
            raise DomainError(f"Patient '{patient_id}' not found.")

        if target.status == Status.COMPLETED:
            raise DomainError(f"Patient '{patient_id}' is already completed / discharged.")
        if target.status != Status.ALLOCATED:
            raise DomainError(f"Cannot discharge patient '{patient_id}' because status is {target.status.value}, not ALLOCATED.")

        self.push_undo_snapshot()
        self._release_patient_units(target)
        target.status = Status.COMPLETED
        self.log_event("DISCHARGED", patient_id)

    def _release_patient_units(self, p: Patient) -> None:
        """Helper to free assigned units in O(1) and clear references."""
        if p.assigned_bed_id:
            bed = next((b for b in self.hospital.beds if b.bed_id == p.assigned_bed_id), None)
            if bed:
                self.hospital.release(bed)
            p.assigned_bed_id = None

        if p.assigned_doctor_id:
            doc = next((d for d in self.hospital.doctors if d.doctor_id == p.assigned_doctor_id), None)
            if doc:
                self.hospital.release(doc)
            p.assigned_doctor_id = None

        if p.assigned_equipment_id:
            eq = next((e for e in self.hospital.equipment if e.equipment_id == p.assigned_equipment_id), None)
            if eq:
                self.hospital.release(eq)
            p.assigned_equipment_id = None

    def reset_allocations(self) -> None:
        """Resets all active allocations; resets all patients back to NEW (completed stay completed)."""
        self.push_undo_snapshot()

        for b in self.hospital.beds:
            b.available = True
            b.assigned_patient_id = None
        for d in self.hospital.doctors:
            d.available = True
            d.assigned_patient_id = None
        for e in self.hospital.equipment:
            e.available = True
            e.assigned_patient_id = None

        self.hospital._rebuild_index()

        for p in self.patients:
            if p.status != Status.COMPLETED:
                p.status = Status.NEW
                p.assigned_bed_id = None
                p.assigned_doctor_id = None
                p.assigned_equipment_id = None
                p.allocation_clock = None
                p.reason_codes = []

        self.log_event("ALLOCATIONS_RESET", "All units freed; uncompleted patients set to NEW")

    def apply_inventory(self, target_counts: Dict[Tuple[str, str], int], reset: bool = True) -> None:
        """Adjusts inventory to match target_counts dict: (kind, type) -> count."""
        if reset:
            self.reset_allocations()

        for (kind, type_), target in target_counts.items():
            current = self.hospital.total_units(kind, type_)
            diff = target - current
            if diff > 0:
                self.hospital.add_units(kind, type_, diff)
            elif diff < 0:
                self.hospital.remove_free_units(kind, type_, abs(diff))

        self.log_event("INVENTORY_CHANGED", f"{len(target_counts)} types updated (reset={reset})")

    def waiting_queue(self) -> List[Patient]:
        """Returns WAITING and UNAVAILABLE patients sorted by priority descending."""
        queue = [p for p in self.patients if p.status in (Status.WAITING, Status.UNAVAILABLE)]
        queue.sort(key=lambda p: (p.priority, p.severity, -p.arrival_seq), reverse=True)
        return queue

    def run_allocation(
        self,
        strategy: str = "indexed",
        order: str = "priority",
        trace_snapshots: bool = False
    ) -> AllocationResult:
        """Runs the deterministic all-or-nothing greedy allocation pipeline."""
        t0 = time.perf_counter()
        self.push_undo_snapshot()
        self._run_counter += 1

        self.log_event("RUN_STARTED", f"Strategy: {strategy}, Order: {order}, Clock: {self.clock}")

        ops = OpCounter()
        trace: List[TraceStep] = []

        # 1. Gather eligible pool: NEW, WAITING, UNAVAILABLE arrived at or before current clock
        pool = [
            p for p in self.patients
            if p.status in (Status.NEW, Status.WAITING, Status.UNAVAILABLE)
            and p.arrival_minute <= self.clock
        ]

        # 2. Dynamic Priority update (Aging)
        for p in pool:
            p.waiting_minutes = self.clock - p.arrival_minute
            p.waiting_level = waiting_level(p.waiting_minutes)
            p.priority = calculate_priority(
                p.severity,
                p.waiting_level,
                p.risk,
                p.urgency,
                p.icu_required,
                self.weights
            )
            p.band = priority_band(p.priority)

        # 3. Order patients
        if order == "priority":
            heap = MaxHeap(counter=ops)
            # Insert key = (priority, severity, -arrival_seq) for deterministic total ordering
            for p in pool:
                key = (p.priority, p.severity, -p.arrival_seq)
                heap.insert(key, p)
            extract_seq = []
            while not heap.is_empty():
                snapshot_data = heap.snapshot() if trace_snapshots and len(pool) <= config.SNAPSHOT_LIMIT_N else None
                heap_size = len(heap)
                key, p = heap.extract_max()
                extract_seq.append((p, heap_size, snapshot_data))
        else:
            # FCFS: order by arrival_seq ascending
            sorted_pool = sorted(pool, key=lambda p: (p.arrival_minute, p.arrival_seq))
            extract_seq = [(p, len(sorted_pool) - i, None) for i, p in enumerate(sorted_pool)]

        # 4. Greedy match and commit
        step_no = 0
        unserved_so_far = 0
        bypass_count = 0

        for p, heap_size_before, heap_snap in extract_seq:
            step_no += 1
            before_checks = ops.unit_checks

            # Search plan
            if strategy == "baseline":
                plan = find_plan_baseline(p, self.hospital, counter=ops)
            else:
                plan = find_plan_indexed(p, self.hospital, counter=ops)

            checks_used = ops.unit_checks - before_checks

            checks_map: Dict[str, str] = {}
            assigned_map: Dict[str, Optional[str]] = {"bed": None, "doctor": None, "equipment": None}

            if plan.complete:
                commit_plan(plan, p, self.clock, self.hospital, strategy=strategy)
                p.status = Status.ALLOCATED
                p.reason_codes = []

                checks_map["bed"] = f"✓ {plan.bed.bed_id}"
                checks_map["doctor"] = f"✓ {plan.doctor.doctor_id}"
                checks_map["equipment"] = f"✓ {plan.equipment.equipment_id}" if plan.equipment else "—"

                assigned_map["bed"] = plan.bed.bed_id
                assigned_map["doctor"] = plan.doctor.doctor_id
                assigned_map["equipment"] = plan.equipment.equipment_id if plan.equipment else None

                self.log_event("ALLOCATED", f"{p.patient_id} ({assigned_map['bed']}, {assigned_map['doctor']})")
                bypass_count += unserved_so_far
            else:
                # Incomplete plan: determine WAITING vs UNAVAILABLE
                is_unavailable = any(m.code.endswith("_IN_INVENTORY") for m in plan.missing)
                p.status = Status.UNAVAILABLE if is_unavailable else Status.WAITING
                p.reason_codes = [m.code for m in plan.missing]

                # Check details formatting
                # Bed check note
                bed_miss = next((m for m in plan.missing if m.kind == "bed"), None)
                if bed_miss:
                    checks_map["bed"] = f"✗ {bed_miss.text}"
                elif plan.bed:
                    checks_map["bed"] = f"✓ candidate {plan.bed.bed_id} (not committed)"
                else:
                    checks_map["bed"] = "—"

                # Doctor check note
                doc_miss = next((m for m in plan.missing if m.kind == "doctor"), None)
                if doc_miss:
                    checks_map["doctor"] = f"✗ {doc_miss.text}"
                elif plan.doctor:
                    checks_map["doctor"] = f"✓ candidate {plan.doctor.doctor_id} (not committed)"
                else:
                    checks_map["doctor"] = "—"

                # Equipment check note
                if p.required_equipment and p.required_equipment != config.NO_EQUIPMENT:
                    eq_miss = next((m for m in plan.missing if m.kind == "equipment"), None)
                    if eq_miss:
                        checks_map["equipment"] = f"✗ {eq_miss.text}"
                    elif plan.equipment:
                        checks_map["equipment"] = f"✓ candidate {plan.equipment.equipment_id} (not committed)"
                    else:
                        checks_map["equipment"] = "—"
                else:
                    checks_map["equipment"] = "—"

                self.log_event(p.status.value, f"{p.patient_id}: {'; '.join(p.reason_codes)}")
                unserved_so_far += 1

            trace.append(TraceStep(
                step_no=step_no,
                patient_id=p.patient_id,
                patient_name=p.name,
                priority=p.priority,
                band=p.band,
                heap_size_before=heap_size_before,
                heap_snapshot=heap_snap,
                required={
                    "bed": p.required_bed_type,
                    "doctor": p.required_doctor_specialty,
                    "equipment": p.required_equipment
                },
                checks=checks_map,
                result=p.status,
                assigned=assigned_map,
                reason_codes=list(p.reason_codes),
                unit_checks_used=checks_used
            ))

        runtime_ms = (time.perf_counter() - t0) * 1000.0
        current_metrics = self.metrics()
        current_metrics.bypass_count = bypass_count

        result = AllocationResult(
            trace=trace,
            metrics=current_metrics,
            ops=ops,
            runtime_ms=runtime_ms,
            strategy=strategy,
            order=order,
            clock=self.clock,
            bypass_count=bypass_count
        )

        self.history.append(RunSummary(
            run_id=self._run_counter,
            clock=self.clock,
            strategy=strategy,
            order=order,
            patients=len(pool),
            allocated=current_metrics.allocated_count,
            waiting=current_metrics.waiting_count,
            unavailable=current_metrics.unavailable_count,
            overall_utilization_pct=current_metrics.overall_util_pct,
            avg_priority=current_metrics.avg_priority_all,
            weighted_score=current_metrics.weighted_score,
            bypass_count=bypass_count,
            unit_checks=ops.unit_checks,
            runtime_ms=runtime_ms
        ))

        return result

    def metrics(self) -> Metrics:
        """Computes all required metrics following §7.15."""
        pool = [p for p in self.patients if p.arrival_minute <= self.clock]
        not_arrived = [p for p in self.patients if p.arrival_minute > self.clock]

        allocated = [p for p in self.patients if p.status == Status.ALLOCATED]
        waiting = [p for p in self.patients if p.status == Status.WAITING]
        unavailable = [p for p in self.patients if p.status == Status.UNAVAILABLE]
        completed = [p for p in self.patients if p.status == Status.COMPLETED]

        # Beds
        beds_total = len(self.hospital.beds)
        beds_busy = sum(1 for b in self.hospital.beds if not b.available)
        beds_util = (beds_busy / beds_total * 100.0) if beds_total > 0 else 0.0

        # Doctors
        docs_total = len(self.hospital.doctors)
        docs_busy = sum(1 for d in self.hospital.doctors if not d.available)
        docs_util = (docs_busy / docs_total * 100.0) if docs_total > 0 else 0.0

        # Equipment
        eqs_total = len(self.hospital.equipment)
        eqs_busy = sum(1 for e in self.hospital.equipment if not e.available)
        eqs_util = (eqs_busy / eqs_total * 100.0) if eqs_total > 0 else 0.0

        # Overall
        overall_total = beds_total + docs_total + eqs_total
        overall_busy = beds_busy + docs_busy + eqs_busy
        overall_util = (overall_busy / overall_total * 100.0) if overall_total > 0 else 0.0

        # Rate
        rate = (len(allocated) / len(pool)) if pool else 0.0

        # Priorities
        avg_pri_all = (sum(p.priority for p in pool) / len(pool)) if pool else 0.0
        avg_pri_alloc = (sum(p.priority for p in allocated) / len(allocated)) if allocated else 0.0
        unserved = waiting + unavailable
        avg_pri_unserved = (sum(p.priority for p in unserved) / len(unserved)) if unserved else 0.0

        # Waits
        alloc_waits = [
            (p.allocation_clock - p.arrival_minute) if p.allocation_clock is not None else p.waiting_minutes
            for p in allocated
        ]
        avg_wait_alloc = (sum(alloc_waits) / len(alloc_waits)) if alloc_waits else 0.0
        max_wait_alloc = max(alloc_waits) if alloc_waits else 0

        unserved_waits = [p.waiting_minutes for p in unserved]
        avg_wait_unserved = (sum(unserved_waits) / len(unserved_waits)) if unserved_waits else 0.0
        max_wait_unserved = max(unserved_waits) if unserved_waits else 0

        weighted_score = sum(p.priority for p in allocated)

        return Metrics(
            total_patients=len(self.patients),
            allocated_count=len(allocated),
            waiting_count=len(waiting),
            unavailable_count=len(unavailable),
            completed_count=len(completed),
            not_arrived_count=len(not_arrived),
            beds_total=beds_total,
            beds_busy=beds_busy,
            beds_util_pct=round(beds_util, 1),
            doctors_total=docs_total,
            doctors_busy=docs_busy,
            doctors_util_pct=round(docs_util, 1),
            equipment_total=eqs_total,
            equipment_busy=eqs_busy,
            equipment_util_pct=round(eqs_util, 1),
            overall_total=overall_total,
            overall_busy=overall_busy,
            overall_util_pct=round(overall_util, 1),
            allocation_rate=round(rate, 3),
            avg_priority_all=round(avg_pri_all, 1),
            avg_priority_allocated=round(avg_pri_alloc, 1),
            avg_priority_unserved=round(avg_pri_unserved, 1),
            avg_wait_allocated=round(avg_wait_alloc, 1),
            avg_wait_unserved=round(avg_wait_unserved, 1),
            max_wait_allocated=max_wait_alloc,
            max_wait_unserved=max_wait_unserved,
            weighted_score=weighted_score,
            bypass_count=0
        )
