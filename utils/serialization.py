"""JSON scenario save and load with schema validation (F24)."""
from __future__ import annotations
import json
from typing import Dict, Any, Tuple, List, TYPE_CHECKING

import config
from models.patient import Patient, Status
from models.bed import Bed
from models.doctor import Doctor
from models.equipment import Equipment
from models.hospital import Hospital, DomainError

if TYPE_CHECKING:
    from algorithms.resource_allocator import ResourceAllocator


def export_scenario_to_dict(allocator: "ResourceAllocator") -> Dict[str, Any]:
    """Serializes the current allocator scenario into a versioned dictionary."""
    return {
        "version": 1,
        "clock": allocator.clock,
        "weights": dict(allocator.weights),
        "beds": [
            {"bed_id": b.bed_id, "bed_type": b.bed_type, "ward": b.ward}
            for b in allocator.hospital.beds
        ],
        "doctors": [
            {"doctor_id": d.doctor_id, "name": d.name, "specialization": d.specialization}
            for d in allocator.hospital.doctors
        ],
        "equipment": [
            {"equipment_id": e.equipment_id, "equipment_type": e.equipment_type, "location": e.location}
            for e in allocator.hospital.equipment
        ],
        "patients": [
            {
                "patient_id": p.patient_id,
                "name": p.name,
                "age": p.age,
                "severity": p.severity,
                "arrival_minute": p.arrival_minute,
                "risk": p.risk,
                "urgency": p.urgency,
                "icu_required": p.icu_required,
                "required_bed_type": p.required_bed_type,
                "required_doctor_specialty": p.required_doctor_specialty,
                "required_equipment": p.required_equipment,
                "length_of_stay_min": p.length_of_stay_min,
                "arrival_seq": p.arrival_seq
            }
            for p in allocator.patients
        ]
    }


def export_scenario_to_json(allocator: "ResourceAllocator") -> str:
    """Serializes the allocator scenario to a JSON formatted string."""
    return json.dumps(export_scenario_to_dict(allocator), indent=2)


def import_scenario_from_dict(data: Dict[str, Any]) -> "ResourceAllocator":
    """Imports and validates a scenario dictionary, instantiating a fresh ResourceAllocator."""
    from algorithms.resource_allocator import ResourceAllocator
    if not isinstance(data, dict):
        raise DomainError("Scenario data must be a valid JSON object.")

    version = data.get("version")
    if version != 1:
        raise DomainError(f"Unsupported scenario version: {version}. Expected version: 1.")

    clock = int(data.get("clock", config.DEMO_START_CLOCK))
    weights = data.get("weights", config.DEFAULT_WEIGHTS)

    beds = [
        Bed(b["bed_id"], b["bed_type"], b.get("ward", ""))
        for b in data.get("beds", [])
    ]
    doctors = [
        Doctor(d["doctor_id"], d["name"], d["specialization"])
        for d in data.get("doctors", [])
    ]
    equipment = [
        Equipment(e["equipment_id"], e["equipment_type"], e.get("location", ""))
        for e in data.get("equipment", [])
    ]

    hospital = Hospital(beds=beds, doctors=doctors, equipment=equipment)

    patients = []
    for seq, p_data in enumerate(data.get("patients", []), start=1):
        patients.append(Patient(
            patient_id=p_data["patient_id"],
            name=p_data["name"],
            age=int(p_data["age"]),
            severity=int(p_data["severity"]),
            arrival_minute=int(p_data["arrival_minute"]),
            risk=int(p_data["risk"]),
            urgency=int(p_data["urgency"]),
            icu_required=int(p_data["icu_required"]),
            required_bed_type=p_data["required_bed_type"],
            required_doctor_specialty=p_data["required_doctor_specialty"],
            required_equipment=p_data.get("required_equipment", "None"),
            length_of_stay_min=p_data.get("length_of_stay_min"),
            arrival_seq=p_data.get("arrival_seq", seq)
        ))

    return ResourceAllocator(hospital, patients, clock=clock, weights=weights)


def import_scenario_from_json(json_str: str) -> ResourceAllocator:
    """Parses JSON string and constructs ResourceAllocator."""
    try:
        data = json.loads(json_str)
    except json.JSONDecodeError as err:
        raise DomainError(f"Malformed JSON: {err}")
    return import_scenario_from_dict(data)
