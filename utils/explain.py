"""Explainability module answering 'Why is this patient waiting or allocated?'."""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any, TYPE_CHECKING

from models.patient import Patient, Status
from utils.scoring import score_breakdown, waiting_level

if TYPE_CHECKING:
    from algorithms.resource_allocator import ResourceAllocator


@dataclass
class Explanation:
    patient_id: str
    name: str
    priority: int
    band: str
    rank: int
    total_in_pool: int
    score_terms: Dict[str, int]
    status: Status
    decision_step: Optional[int]
    assigned_units: Dict[str, Optional[str]]
    blockers: List[Dict[str, Any]]
    candidate_not_committed: List[str]
    summary_text: str


def explain_patient(allocator: "ResourceAllocator", patient_id: str) -> Explanation:
    """Produces detailed explainability report for a specific patient."""
    p = next((pat for pat in allocator.patients if pat.patient_id == patient_id), None)
    if not p:
        return Explanation(
            patient_id=patient_id,
            name="Unknown",
            priority=0,
            band="NORMAL",
            rank=0,
            total_in_pool=0,
            score_terms={},
            status=Status.NEW,
            decision_step=None,
            assigned_units={},
            blockers=[],
            candidate_not_committed=[],
            summary_text=f"Patient '{patient_id}' not found in the system."
        )

    # Find patient's rank and step in the last run trace
    last_run_summary = allocator.history[-1] if allocator.history else None
    decision_step = None
    rank = 0
    total_in_pool = 0
    candidate_not_committed = []

    # Get score terms
    w_lvl = waiting_level(allocator.clock - p.arrival_minute) if p.status != Status.ALLOCATED else p.waiting_level
    terms = score_breakdown(p.severity, w_lvl, p.risk, p.urgency, p.icu_required, allocator.weights)

    # Re-evaluate ranking among pool
    pool = [pat for pat in allocator.patients if pat.arrival_minute <= allocator.clock]
    total_in_pool = len(pool)
    sorted_pool = sorted(pool, key=lambda x: (x.priority, x.severity, -x.arrival_seq), reverse=True)
    for idx, pat in enumerate(sorted_pool, start=1):
        if pat.patient_id == patient_id:
            rank = idx
            break

    blockers = []
    summary_parts = []

    if p.status == Status.ALLOCATED:
        summary_text = (
            f"{p.name} ({p.patient_id}) with priority {p.priority} ({p.band}) was processed "
            f"rank {rank} of {total_in_pool} and successfully allocated: "
            f"Bed {p.assigned_bed_id}, Doctor {p.assigned_doctor_id}"
            + (f", Equipment {p.assigned_equipment_id}." if p.assigned_equipment_id else ".")
        )
        return Explanation(
            patient_id=p.patient_id,
            name=p.name,
            priority=p.priority,
            band=p.band,
            rank=rank,
            total_in_pool=total_in_pool,
            score_terms=terms,
            status=p.status,
            decision_step=decision_step,
            assigned_units={
                "bed": p.assigned_bed_id,
                "doctor": p.assigned_doctor_id,
                "equipment": p.assigned_equipment_id
            },
            blockers=[],
            candidate_not_committed=[],
            summary_text=summary_text
        )

    # For WAITING or UNAVAILABLE: inspect each requirement
    # Bed
    bed_free = len(allocator.hospital.free_units("bed", p.required_bed_type))
    bed_total = allocator.hospital.total_units("bed", p.required_bed_type)
    if bed_total == 0:
        blockers.append({
            "kind": "bed",
            "needed": p.required_bed_type,
            "reason": "none in inventory",
            "holders": [],
            "unblock": f"Add at least 1 unit of {p.required_bed_type} Bed to hospital inventory."
        })
    elif bed_free == 0:
        holders = [b.assigned_patient_id for b in allocator.hospital.beds if b.bed_type == p.required_bed_type and b.assigned_patient_id]
        blockers.append({
            "kind": "bed",
            "needed": p.required_bed_type,
            "reason": f"all {bed_total} units busy",
            "holders": holders,
            "unblock": f"Discharge {', '.join(holders)} or add 1 {p.required_bed_type} Bed."
        })
    else:
        candidate_not_committed.append(f"{p.required_bed_type} Bed (candidate available but not committed)")

    # Doctor
    doc_free = len(allocator.hospital.free_units("doctor", p.required_doctor_specialty))
    doc_total = allocator.hospital.total_units("doctor", p.required_doctor_specialty)
    if doc_total == 0:
        blockers.append({
            "kind": "doctor",
            "needed": p.required_doctor_specialty,
            "reason": "none in inventory",
            "holders": [],
            "unblock": f"Add at least 1 {p.required_doctor_specialty} to hospital inventory."
        })
    elif doc_free == 0:
        holders = [d.assigned_patient_id for d in allocator.hospital.doctors if d.specialization == p.required_doctor_specialty and d.assigned_patient_id]
        blockers.append({
            "kind": "doctor",
            "needed": p.required_doctor_specialty,
            "reason": f"all {doc_total} unit{'s' if doc_total > 1 else ''} busy",
            "holders": holders,
            "unblock": f"Discharge {', '.join(holders)} or add 1 {p.required_doctor_specialty}."
        })
    else:
        candidate_not_committed.append(f"{p.required_doctor_specialty} (candidate available but not committed)")

    # Equipment
    if p.required_equipment and p.required_equipment != "None":
        eq_free = len(allocator.hospital.free_units("equipment", p.required_equipment))
        eq_total = allocator.hospital.total_units("equipment", p.required_equipment)
        if eq_total == 0:
            blockers.append({
                "kind": "equipment",
                "needed": p.required_equipment,
                "reason": "none in inventory",
                "holders": [],
                "unblock": f"Add at least 1 {p.required_equipment} to hospital inventory."
            })
        elif eq_free == 0:
            holders = [e.assigned_patient_id for e in allocator.hospital.equipment if e.equipment_type == p.required_equipment and e.assigned_patient_id]
            blockers.append({
                "kind": "equipment",
                "needed": p.required_equipment,
                "reason": f"all {eq_total} unit{'s' if eq_total > 1 else ''} busy",
                "holders": holders,
                "unblock": f"Discharge {', '.join(holders)} or add 1 {p.required_equipment}."
            })
        else:
            candidate_not_committed.append(f"{p.required_equipment} (candidate available but not committed)")

    blocker_descs = [f"{b['needed']}: {b['reason']} (held by {', '.join(b['holders']) if b['holders'] else 'none'})" for b in blockers]
    unblock_options = [b["unblock"] for b in blockers]

    summary_text = (
        f"{p.name} ({p.patient_id}, priority {p.priority} [{p.band}]) was processed #{rank} of {total_in_pool}. "
        f"Status: {p.status.value}. "
        f"Blockers: {'; '.join(blocker_descs)}. "
        + (f"Candidates found but held back: {', '.join(candidate_not_committed)}. " if candidate_not_committed else "")
        + f"To unblock: {' OR '.join(unblock_options)}."
    )

    return Explanation(
        patient_id=p.patient_id,
        name=p.name,
        priority=p.priority,
        band=p.band,
        rank=rank,
        total_in_pool=total_in_pool,
        score_terms=terms,
        status=p.status,
        decision_step=decision_step,
        assigned_units={},
        blockers=blockers,
        candidate_not_committed=candidate_not_committed,
        summary_text=summary_text
    )
