"""Time-stepped hospital-day simulation using a MinHeap event queue (F31)."""
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
import copy

import config
from models.patient import Patient, Status
from models.hospital import Hospital
from .priority_queue import MinHeap
from .resource_allocator import ResourceAllocator


@dataclass
class SimEvent:
    time: int
    event_type: str  # "DISCHARGE" or "ARRIVAL"
    patient_id: str
    details: str = ""


@dataclass
class SimTimelinePoint:
    time: int
    event_desc: str
    allocated_count: int
    waiting_count: int
    busy_beds: int
    busy_doctors: int
    busy_equipment: int
    overall_util_pct: float


@dataclass
class SimulationDayResult:
    timeline: List[SimTimelinePoint]
    event_log: List[SimEvent]
    avg_wait_minutes: float
    max_wait_minutes: int
    throughput: int
    time_weighted_util_pct: float


def run_hospital_day_simulation(
    hospital: Hospital,
    patients: List[Patient],
    start_clock: int = config.DEMO_START_CLOCK,
    horizon_minutes: int = 360
) -> SimulationDayResult:
    """Runs time-stepped discrete-event simulation over a hospital day using a MinHeap."""
    h_sim = hospital.clone()
    p_sim = [copy.deepcopy(p) for p in patients]

    allocator = ResourceAllocator(h_sim, p_sim, clock=start_clock)

    event_heap = MinHeap()
    seq = 0

    # Initialize arrival events
    for p in p_sim:
        if p.arrival_minute > start_clock:
            seq += 1
            # key: (time, type_rank=1 for ARRIVAL, seq)
            event_heap.insert((p.arrival_minute, 1, seq), SimEvent(time=p.arrival_minute, event_type="ARRIVAL", patient_id=p.patient_id))

    timeline: List[SimTimelinePoint] = []
    event_log: List[SimEvent] = []

    # Initial pass at start_clock
    res = allocator.run_allocation(strategy="indexed", order="priority")

    # Schedule discharges for patients allocated at start_clock
    for p in p_sim:
        if p.status == Status.ALLOCATED and p.allocation_clock == start_clock:
            los = p.length_of_stay_min or config.DEFAULT_LOS_MIN
            discharge_time = start_clock + los
            seq += 1
            # type_rank=0 for DISCHARGE (processed before arrivals at same time)
            event_heap.insert(
                (discharge_time, 0, seq),
                SimEvent(time=discharge_time, event_type="DISCHARGE", patient_id=p.patient_id, details=f"LOS: {los} min")
            )

    m = allocator.metrics()
    timeline.append(SimTimelinePoint(
        time=start_clock,
        event_desc="Simulation Start & Initial Allocation",
        allocated_count=m.allocated_count,
        waiting_count=m.waiting_count,
        busy_beds=m.beds_busy,
        busy_doctors=m.doctors_busy,
        busy_equipment=m.equipment_busy,
        overall_util_pct=m.overall_util_pct
    ))

    # Main event loop
    while not event_heap.is_empty():
        # Peek next event time
        next_time = event_heap.peek()[0][0]
        if next_time > horizon_minutes:
            break

        # Pop all events at this exact timestamp
        current_events: List[SimEvent] = []
        while not event_heap.is_empty() and event_heap.peek()[0][0] == next_time:
            _, event = event_heap.extract_min()
            current_events.append(event)
            event_log.append(event)

        # Advance clock to event time
        allocator.clock = next_time

        # 1. Process DISCHARGES first (frees units)
        for ev in current_events:
            if ev.event_type == "DISCHARGE":
                allocator.discharge(ev.patient_id)

        # 2. Process ARRIVALS
        for ev in current_events:
            if ev.event_type == "ARRIVAL":
                p_match = next((p for p in allocator.patients if p.patient_id == ev.patient_id), None)
                if p_match:
                    p_match.status = Status.NEW

        # 3. Run allocation once at this timestamp
        step_res = allocator.run_allocation(strategy="indexed", order="priority")

        # 4. Schedule discharges for newly allocated patients
        for p in allocator.patients:
            if p.status == Status.ALLOCATED and p.allocation_clock == next_time:
                los = p.length_of_stay_min or config.DEFAULT_LOS_MIN
                d_time = next_time + los
                seq += 1
                event_heap.insert(
                    (d_time, 0, seq),
                    SimEvent(time=d_time, event_type="DISCHARGE", patient_id=p.patient_id, details=f"LOS: {los} min")
                )

        step_m = allocator.metrics()
        ev_types = ", ".join(f"{e.event_type} {e.patient_id}" for e in current_events)
        timeline.append(SimTimelinePoint(
            time=next_time,
            event_desc=ev_types,
            allocated_count=step_m.allocated_count,
            waiting_count=step_m.waiting_count,
            busy_beds=step_m.beds_busy,
            busy_doctors=step_m.doctors_busy,
            busy_equipment=step_m.equipment_busy,
            overall_util_pct=step_m.overall_util_pct
        ))

    # Compute overall summary metrics
    completed = [p for p in allocator.patients if p.status in (Status.ALLOCATED, Status.COMPLETED)]
    waits = [
        (p.allocation_clock - p.arrival_minute)
        for p in completed
        if p.allocation_clock is not None
    ]
    avg_wait = sum(waits) / len(waits) if waits else 0.0
    max_wait = max(waits) if waits else 0

    return SimulationDayResult(
        timeline=timeline,
        event_log=event_log,
        avg_wait_minutes=round(avg_wait, 2),
        max_wait_minutes=max_wait,
        throughput=len(completed),
        time_weighted_util_pct=round(sum(tp.overall_util_pct for tp in timeline) / max(1, len(timeline)), 1)
    )
