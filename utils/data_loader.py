"""Data loaders for CSV files and scenario presets."""
import csv
import os
from typing import List, Tuple

from models.patient import Patient, Status
from models.bed import Bed
from models.doctor import Doctor
from models.equipment import Equipment
from models.hospital import Hospital


def load_patients_from_csv(filepath: str) -> List[Patient]:
    """Loads patients from a CSV file."""
    patients = []
    if not os.path.exists(filepath):
        return patients

    with open(filepath, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        seq = 0
        for row in reader:
            seq += 1
            los_raw = row.get("length_of_stay_min", "").strip()
            los = int(los_raw) if los_raw and los_raw.isdigit() else None

            patients.append(Patient(
                patient_id=row["patient_id"].strip(),
                name=row["name"].strip(),
                age=int(row["age"]),
                severity=int(row["severity"]),
                arrival_minute=int(row["arrival_minute"]),
                risk=int(row["risk"]),
                urgency=int(row["urgency"]),
                icu_required=int(row["icu_required"]),
                required_bed_type=row["required_bed_type"].strip(),
                required_doctor_specialty=row["required_doctor_specialty"].strip(),
                required_equipment=row.get("required_equipment", "None").strip(),
                length_of_stay_min=los,
                arrival_seq=seq
            ))
    return patients


def load_beds_from_csv(filepath: str) -> List[Bed]:
    """Loads beds from a CSV file."""
    beds = []
    if not os.path.exists(filepath):
        return beds

    with open(filepath, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            beds.append(Bed(
                bed_id=row["bed_id"].strip(),
                bed_type=row["bed_type"].strip(),
                ward=row.get("ward", "").strip()
            ))
    return beds


def load_doctors_from_csv(filepath: str) -> List[Doctor]:
    """Loads doctors from a CSV file."""
    doctors = []
    if not os.path.exists(filepath):
        return doctors

    with open(filepath, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            doctors.append(Doctor(
                doctor_id=row["doctor_id"].strip(),
                name=row["name"].strip(),
                specialization=row["specialization"].strip()
            ))
    return doctors


def load_equipment_from_csv(filepath: str) -> List[Equipment]:
    """Loads equipment from a CSV file."""
    equipment = []
    if not os.path.exists(filepath):
        return equipment

    with open(filepath, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            equipment.append(Equipment(
                equipment_id=row["equipment_id"].strip(),
                equipment_type=row["equipment_type"].strip(),
                location=row.get("location", "").strip()
            ))
    return equipment


def get_golden_data() -> Tuple[Hospital, List[Patient]]:
    """Returns the exact §10 Golden Dataset programmatically."""
    beds = [
        Bed("BED-ICU-01", "ICU", "ICU Ward"),
        Bed("BED-ICU-02", "ICU", "ICU Ward"),
        Bed("BED-GEN-01", "GENERAL", "General Ward"),
        Bed("BED-GEN-02", "GENERAL", "General Ward"),
        Bed("BED-EMG-01", "EMERGENCY", "Emergency Ward")
    ]

    doctors = [
        Doctor("DOC-CARD-01", "Dr. Demo Cardiologist 1", "Cardiologist"),
        Doctor("DOC-NEUR-01", "Dr. Demo Neurologist 1", "Neurologist"),
        Doctor("DOC-PHYS-01", "Dr. Demo Physician 1", "Physician")
    ]

    equipment = [
        Equipment("EQP-VENT-01", "Ventilator", "Room 101"),
        Equipment("EQP-ECG-01", "ECG", "Room 102"),
        Equipment("EQP-MRI-01", "MRI", "Room 103"),
        Equipment("EQP-MON-01", "Monitor", "Room 104")
    ]

    hospital = Hospital(beds=beds, doctors=doctors, equipment=equipment)

    patients = [
        Patient(
            patient_id="P01",
            name="Demo Patient 01",
            age=58,
            severity=5,
            arrival_minute=45,
            risk=5,
            urgency=5,
            icu_required=1,
            required_bed_type="ICU",
            required_doctor_specialty="Cardiologist",
            required_equipment="Ventilator",
            length_of_stay_min=60,
            arrival_seq=1
        ),
        Patient(
            patient_id="P03",
            name="Demo Patient 03",
            age=47,
            severity=5,
            arrival_minute=75,
            risk=4,
            urgency=4,
            icu_required=1,
            required_bed_type="ICU",
            required_doctor_specialty="Neurologist",
            required_equipment="Monitor",
            length_of_stay_min=90,
            arrival_seq=2
        ),
        Patient(
            patient_id="P02",
            name="Demo Patient 02",
            age=62,
            severity=3,
            arrival_minute=80,
            risk=2,
            urgency=2,
            icu_required=0,
            required_bed_type="GENERAL",
            required_doctor_specialty="Physician",
            required_equipment="None",
            length_of_stay_min=30,
            arrival_seq=3
        ),
        Patient(
            patient_id="P04",
            name="Demo Patient 04",
            age=34,
            severity=2,
            arrival_minute=105,
            risk=2,
            urgency=1,
            icu_required=0,
            required_bed_type="GENERAL",
            required_doctor_specialty="Physician",
            required_equipment="None",
            length_of_stay_min=20,
            arrival_seq=4
        )
    ]

    return hospital, patients
