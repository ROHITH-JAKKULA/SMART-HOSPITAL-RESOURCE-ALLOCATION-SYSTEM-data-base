"""Greedy resource allocation strategies: Baseline (O(B*D*E)) and Indexed (O(1)).

Guarantees atomicity (all-or-nothing):
A plan is formed in a read-only phase; committing only occurs if bed,
doctor, and equipment (if required) are all simultaneously available.
"""
from dataclasses import dataclass, field
from typing import Optional, List, Tuple, Any, Dict
import config
from models.patient import Patient
from models.bed import Bed
from models.doctor import Doctor
from models.equipment import Equipment
from models.hospital import Hospital
from .priority_queue import OpCounter


@dataclass(frozen=True)
class Missing:
    kind: str
    needed: str
    code: str
    text: str
    holders: Tuple[str, ...] = ()


@dataclass
class ResourcePlan:
    bed: Optional[Bed] = None
    doctor: Optional[Doctor] = None
    equipment: Optional[Equipment] = None
    missing: List[Missing] = field(default_factory=list)

    @property
    def complete(self) -> bool:
        return len(self.missing) == 0 and self.bed is not None and self.doctor is not None


def _get_holders(hospital: Hospital, kind: str, type_: str) -> Tuple[str, ...]:
    """Finds patient IDs currently assigned to units of (kind, type_)."""
    units = hospital.units_of(kind, type_)
    holders = [u.assigned_patient_id for u in units if u.assigned_patient_id is not None]
    return tuple(holders)


def diagnose(patient: Patient, hospital: Hospital) -> List[Missing]:
    """Inspects all required resource categories and returns all missing items."""
    missing: List[Missing] = []

    # 1. Bed check
    bed_compat = config.BED_COMPATIBILITY.get(patient.required_bed_type, (patient.required_bed_type,))
    bed_found = False
    for bt in bed_compat:
        total = hospital.total_units("bed", bt)
        if total == 0:
            missing.append(Missing(
                kind="bed",
                needed=bt,
                code="NO_BED_IN_INVENTORY",
                text=f"{bt} Bed: none in inventory"
            ))
            bed_found = True
            break
        free_dq = hospital.free_units("bed", bt)
        if len(free_dq) > 0:
            bed_found = True
            break
        else:
            holders = _get_holders(hospital, "bed", bt)
            holder_str = f" (held by {', '.join(holders)})" if holders else ""
            missing.append(Missing(
                kind="bed",
                needed=bt,
                code="BED_BUSY",
                text=f"{bt} Bed: all {total} units busy{holder_str}",
                holders=holders
            ))
            bed_found = True
            break

    # 2. Doctor check
    doc_compat = config.DOCTOR_COMPATIBILITY.get(patient.required_doctor_specialty, (patient.required_doctor_specialty,))
    for ds in doc_compat:
        total = hospital.total_units("doctor", ds)
        if total == 0:
            missing.append(Missing(
                kind="doctor",
                needed=ds,
                code="NO_DOCTOR_IN_INVENTORY",
                text=f"{ds}: none in inventory"
            ))
            break
        free_dq = hospital.free_units("doctor", ds)
        if len(free_dq) == 0:
            holders = _get_holders(hospital, "doctor", ds)
            holder_str = f" (held by {', '.join(holders)})" if holders else ""
            missing.append(Missing(
                kind="doctor",
                needed=ds,
                code="DOCTOR_BUSY",
                text=f"{ds}: all {total} unit{'s' if total > 1 else ''} busy{holder_str}",
                holders=holders
            ))
            break

    # 3. Equipment check (if required)
    if patient.required_equipment and patient.required_equipment != config.NO_EQUIPMENT:
        eq_compat = config.EQUIPMENT_COMPATIBILITY.get(patient.required_equipment, (patient.required_equipment,))
        for eq_type in eq_compat:
            total = hospital.total_units("equipment", eq_type)
            if total == 0:
                missing.append(Missing(
                    kind="equipment",
                    needed=eq_type,
                    code="NO_EQUIPMENT_IN_INVENTORY",
                    text=f"{eq_type}: none in inventory"
                ))
                break
            free_dq = hospital.free_units("equipment", eq_type)
            if len(free_dq) == 0:
                holders = _get_holders(hospital, "equipment", eq_type)
                holder_str = f" (held by {', '.join(holders)})" if holders else ""
                missing.append(Missing(
                    kind="equipment",
                    needed=eq_type,
                    code="EQUIPMENT_BUSY",
                    text=f"{eq_type}: all {total} unit{'s' if total > 1 else ''} busy{holder_str}",
                    holders=holders
                ))
                break

    return missing


def find_plan_baseline(
    patient: Patient,
    hospital: Hospital,
    counter: Optional[OpCounter] = None
) -> ResourcePlan:
    """Strategy A: Baseline exhaustive search over all combinations B * D * E."""
    compat_beds = config.BED_COMPATIBILITY.get(patient.required_bed_type, (patient.required_bed_type,))
    compat_docs = config.DOCTOR_COMPATIBILITY.get(patient.required_doctor_specialty, (patient.required_doctor_specialty,))
    needs_eq = patient.required_equipment and patient.required_equipment != config.NO_EQUIPMENT
    compat_eqs = config.EQUIPMENT_COMPATIBILITY.get(patient.required_equipment, (patient.required_equipment,)) if needs_eq else (None,)

    # Sort resources deterministically by ID order
    sorted_beds = sorted(hospital.beds, key=lambda b: b.bed_id)
    sorted_docs = sorted(hospital.doctors, key=lambda d: d.doctor_id)
    sorted_eqs = sorted(hospital.equipment, key=lambda e: e.equipment_id) if needs_eq else [None]

    for bed in sorted_beds:
        for doc in sorted_docs:
            for eq in sorted_eqs:
                if counter:
                    counter.unit_checks += 1

                bed_ok = bed.available and bed.bed_type in compat_beds
                doc_ok = doc.available and doc.specialization in compat_docs
                eq_ok = (eq is None) if not needs_eq else (eq is not None and eq.available and eq.equipment_type in compat_eqs)

                if bed_ok and doc_ok and eq_ok:
                    return ResourcePlan(bed=bed, doctor=doc, equipment=eq, missing=[])

    # No plan found: run diagnose to gather all missing constraints
    return ResourcePlan(bed=None, doctor=None, equipment=None, missing=diagnose(patient, hospital))


def find_plan_indexed(
    patient: Patient,
    hospital: Hospital,
    counter: Optional[OpCounter] = None
) -> ResourcePlan:
    """Strategy C: Indexed O(1) candidate lookup using front of hospital deques."""
    compat_beds = config.BED_COMPATIBILITY.get(patient.required_bed_type, (patient.required_bed_type,))
    compat_docs = config.DOCTOR_COMPATIBILITY.get(patient.required_doctor_specialty, (patient.required_doctor_specialty,))
    needs_eq = patient.required_equipment and patient.required_equipment != config.NO_EQUIPMENT
    compat_eqs = config.EQUIPMENT_COMPATIBILITY.get(patient.required_equipment, (patient.required_equipment,)) if needs_eq else ()

    candidate_bed: Optional[Bed] = None
    candidate_doc: Optional[Doctor] = None
    candidate_eq: Optional[Equipment] = None

    # Bed check
    for bt in compat_beds:
        if counter:
            counter.unit_checks += 1
        dq = hospital.free_units("bed", bt)
        if len(dq) > 0:
            candidate_bed = dq[0]
            break

    # Doctor check
    for ds in compat_docs:
        if counter:
            counter.unit_checks += 1
        dq = hospital.free_units("doctor", ds)
        if len(dq) > 0:
            candidate_doc = dq[0]
            break

    # Equipment check
    if needs_eq:
        for et in compat_eqs:
            if counter:
                counter.unit_checks += 1
            dq = hospital.free_units("equipment", et)
            if len(dq) > 0:
                candidate_eq = dq[0]
                break

    # Verify all-or-nothing
    eq_satisfied = (not needs_eq) or (candidate_eq is not None)
    if candidate_bed is not None and candidate_doc is not None and eq_satisfied:
        return ResourcePlan(bed=candidate_bed, doctor=candidate_doc, equipment=candidate_eq, missing=[])

    # Candidate not complete: explain reasons without committing anything
    missing = diagnose(patient, hospital)
    return ResourcePlan(bed=candidate_bed, doctor=candidate_doc, equipment=candidate_eq, missing=missing)


def commit_plan(
    plan: ResourcePlan,
    patient: Patient,
    clock: int,
    hospital: Hospital,
    strategy: str = "indexed"
) -> None:
    """Atomically commits the complete plan to patient and hospital inventory."""
    if not plan.complete:
        return

    # Commit Bed
    if plan.bed:
        plan.bed.available = False
        plan.bed.assigned_patient_id = patient.patient_id
        patient.assigned_bed_id = plan.bed.bed_id
        if strategy == "indexed":
            dq = hospital.free_units("bed", plan.bed.bed_type)
            if dq and dq[0] == plan.bed:
                dq.popleft()
            elif plan.bed in dq:
                dq.remove(plan.bed)

    # Commit Doctor
    if plan.doctor:
        plan.doctor.available = False
        plan.doctor.assigned_patient_id = patient.patient_id
        patient.assigned_doctor_id = plan.doctor.doctor_id
        if strategy == "indexed":
            dq = hospital.free_units("doctor", plan.doctor.specialization)
            if dq and dq[0] == plan.doctor:
                dq.popleft()
            elif plan.doctor in dq:
                dq.remove(plan.doctor)

    # Commit Equipment
    if plan.equipment:
        plan.equipment.available = False
        plan.equipment.assigned_patient_id = patient.patient_id
        patient.assigned_equipment_id = plan.equipment.equipment_id
        if strategy == "indexed":
            dq = hospital.free_units("equipment", plan.equipment.equipment_type)
            if dq and dq[0] == plan.equipment:
                dq.popleft()
            elif plan.equipment in dq:
                dq.remove(plan.equipment)

    patient.allocation_clock = clock
