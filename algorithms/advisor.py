"""Bottleneck analysis, marginal-benefit Resource Advisor, and What-If analysis."""
from dataclasses import dataclass
from typing import List, Dict, Tuple, Optional, Any
import copy

import config
from models.patient import Patient, Status
from models.hospital import Hospital, DomainError
from .resource_allocator import ResourceAllocator, Metrics


@dataclass
class BottleneckRow:
    kind: str
    type_: str
    demand: int
    supply: int
    busy: int
    blocked: int
    shortage: int
    pressure: float
    pressure_str: str


@dataclass
class Advice:
    kind: str
    type_: str
    delta_allocated: int
    delta_weighted_score: int
    newly_allocated_ids: List[str]
    newly_unserved_ids: List[str]
    reduces_count: bool


@dataclass
class WhatIfResult:
    changes: Dict[str, int]
    baseline_metrics: Metrics
    scenario_metrics: Metrics
    delta_allocated: int
    delta_waiting: int
    delta_unavailable: int
    delta_weighted_score: int
    changed_patients: List[Dict[str, Any]]
    explanation: str


ALL_RESOURCE_TYPES: List[Tuple[str, str]] = [
    ("bed", "ICU"),
    ("bed", "EMERGENCY"),
    ("bed", "GENERAL"),
    ("doctor", "Cardiologist"),
    ("doctor", "Neurologist"),
    ("doctor", "Physician"),
    ("doctor", "Surgeon"),
    ("equipment", "Ventilator"),
    ("equipment", "ECG"),
    ("equipment", "Monitor"),
    ("equipment", "MRI"),
    ("equipment", "X-Ray"),
]


def bottleneck_table(allocator: ResourceAllocator) -> List[BottleneckRow]:
    """Computes demand vs supply and pressure for all 12 hospital resource types."""
    rows: List[BottleneckRow] = []

    active_patients = [
        p for p in allocator.patients
        if p.status != Status.COMPLETED and p.arrival_minute <= allocator.clock
    ]

    for kind, type_ in ALL_RESOURCE_TYPES:
        supply = allocator.hospital.total_units(kind, type_)
        units = allocator.hospital.units_of(kind, type_)
        busy = sum(1 for u in units if not u.available)

        # Count demand: how many patients require this type
        if kind == "bed":
            demand = sum(1 for p in active_patients if p.required_bed_type == type_)
            blocked = sum(1 for p in active_patients if p.status in (Status.WAITING, Status.UNAVAILABLE) and p.required_bed_type == type_)
        elif kind == "doctor":
            demand = sum(1 for p in active_patients if p.required_doctor_specialty == type_)
            blocked = sum(1 for p in active_patients if p.status in (Status.WAITING, Status.UNAVAILABLE) and p.required_doctor_specialty == type_)
        else:
            demand = sum(1 for p in active_patients if p.required_equipment == type_)
            blocked = sum(1 for p in active_patients if p.status in (Status.WAITING, Status.UNAVAILABLE) and p.required_equipment == type_)

        shortage = max(0, demand - supply)
        if supply == 0:
            pressure = float("inf") if demand > 0 else 0.0
            pressure_str = "∞ (none in inventory)" if demand > 0 else "0.0"
        else:
            pressure = round(demand / supply, 2)
            pressure_str = f"{pressure:.1f}"

        rows.append(BottleneckRow(
            kind=kind,
            type_=type_,
            demand=demand,
            supply=supply,
            busy=busy,
            blocked=blocked,
            shortage=shortage,
            pressure=pressure,
            pressure_str=pressure_str
        ))

    # Sort so top bottleneck comes first: highest pressure, then largest shortage
    rows.sort(key=lambda r: (r.pressure, r.shortage, r.demand), reverse=True)
    return rows


def advise(allocator: ResourceAllocator) -> List[Advice]:
    """Evaluates marginal benefit of +1 unit for each of the 12 resource types.

    Never modifies the live allocator state.
    Cost: O(T * N log N), T = 12.
    """
    advice_list: List[Advice] = []

    # 1. Baseline run on clean reset state
    base_clone = allocator.clone()
    base_clone.reset_allocations()
    base_result = base_clone.run_allocation(strategy="indexed", order="priority")
    base_allocated = {p.patient_id for p in base_clone.patients if p.status == Status.ALLOCATED}
    base_score = base_result.metrics.weighted_score
    base_count = base_result.metrics.allocated_count

    # 2. Test each of the 12 types with +1 unit
    for kind, type_ in ALL_RESOURCE_TYPES:
        test_clone = allocator.clone()
        test_clone.reset_allocations()
        test_clone.hospital.add_units(kind, type_, 1)
        test_result = test_clone.run_allocation(strategy="indexed", order="priority")

        test_allocated = {p.patient_id for p in test_clone.patients if p.status == Status.ALLOCATED}
        test_score = test_result.metrics.weighted_score
        test_count = test_result.metrics.allocated_count

        newly_alloc = sorted(list(test_allocated - base_allocated))
        newly_unserved = sorted(list(base_allocated - test_allocated))

        delta_alloc = test_count - base_count
        delta_score = test_score - base_score

        advice_list.append(Advice(
            kind=kind,
            type_=type_,
            delta_allocated=delta_alloc,
            delta_weighted_score=delta_score,
            newly_allocated_ids=newly_alloc,
            newly_unserved_ids=newly_unserved,
            reduces_count=(delta_alloc < 0)
        ))

    # Sort by delta_weighted_score desc, delta_allocated desc, type_ asc
    advice_list.sort(key=lambda a: (a.delta_weighted_score, a.delta_allocated, a.type_), reverse=True)
    return advice_list


def what_if(allocator: ResourceAllocator, changes: Dict[str, int]) -> WhatIfResult:
    """Clones allocator, applies resource changes, runs indexed allocator, and returns comparison."""
    # Run baseline on clean state
    base_clone = allocator.clone()
    base_clone.reset_allocations()
    base_res = base_clone.run_allocation(strategy="indexed", order="priority")
    base_statuses = {p.patient_id: p.status for p in base_clone.patients}

    # Run scenario on clean state with changes applied
    scen_clone = allocator.clone()
    scen_clone.reset_allocations()

    for type_name, delta in changes.items():
        if delta == 0:
            continue
        kind = None
        if type_name in config.BED_TYPES:
            kind = "bed"
        elif type_name in config.DOCTOR_SPECIALTIES:
            kind = "doctor"
        elif type_name in config.EQUIPMENT_TYPES:
            kind = "equipment"

        if kind:
            if delta > 0:
                scen_clone.hospital.add_units(kind, type_name, delta)
            else:
                current_free = len(scen_clone.hospital.free_units(kind, type_name))
                to_remove = min(abs(delta), current_free)
                if to_remove > 0:
                    scen_clone.hospital.remove_free_units(kind, type_name, to_remove)

    scen_res = scen_clone.run_allocation(strategy="indexed", order="priority")
    scen_statuses = {p.patient_id: p.status for p in scen_clone.patients}

    changed_patients: List[Dict[str, Any]] = []
    for pid, old_st in base_statuses.items():
        new_st = scen_statuses.get(pid)
        if old_st != new_st:
            p_obj = next((p for p in scen_clone.patients if p.patient_id == pid), None)
            changed_patients.append({
                "patient_id": pid,
                "name": p_obj.name if p_obj else pid,
                "priority": p_obj.priority if p_obj else 0,
                "old_status": old_st.value,
                "new_status": new_st.value if new_st else "UNKNOWN"
            })

    delta_alloc = scen_res.metrics.allocated_count - base_res.metrics.allocated_count
    delta_wait = scen_res.metrics.waiting_count - base_res.metrics.waiting_count
    delta_unavail = scen_res.metrics.unavailable_count - base_res.metrics.unavailable_count
    delta_score = scen_res.metrics.weighted_score - base_res.metrics.weighted_score

    if not changed_patients:
        explanation = "No change: no waiting patient required the modified resources."
    else:
        explanation = f"Scenario resulted in {delta_alloc:+d} allocated patients (score {delta_score:+d})."

    return WhatIfResult(
        changes=changes,
        baseline_metrics=base_res.metrics,
        scenario_metrics=scen_res.metrics,
        delta_allocated=delta_alloc,
        delta_waiting=delta_wait,
        delta_unavailable=delta_unavail,
        delta_weighted_score=delta_score,
        changed_patients=changed_patients,
        explanation=explanation
    )
