"""Seeded scenario generator and hospital presets (F23)."""
import random
from typing import List, Tuple, Dict
from models.patient import Patient
from models.bed import Bed
from models.doctor import Doctor
from models.equipment import Equipment
from models.hospital import Hospital


def get_preset_hospital(preset_name: str = "Standard") -> Hospital:
    """Returns a Hospital instance configured with a standard preset inventory."""
    presets = {
        "Standard": {
            "beds": {"ICU": 3, "EMERGENCY": 3, "GENERAL": 6},
            "doctors": {"Cardiologist": 2, "Neurologist": 1, "Physician": 3, "Surgeon": 2},
            "equipment": {"Ventilator": 2, "ECG": 2, "Monitor": 3, "MRI": 1, "X-Ray": 2}
        },
        "Equipment shortage": {
            "beds": {"ICU": 3, "EMERGENCY": 3, "GENERAL": 6},
            "doctors": {"Cardiologist": 2, "Neurologist": 1, "Physician": 3, "Surgeon": 2},
            "equipment": {"Ventilator": 1, "ECG": 1, "Monitor": 1, "MRI": 1, "X-Ray": 1}
        },
        "Specialist shortage": {
            "beds": {"ICU": 3, "EMERGENCY": 3, "GENERAL": 6},
            "doctors": {"Cardiologist": 1, "Neurologist": 1, "Physician": 1, "Surgeon": 1},
            "equipment": {"Ventilator": 2, "ECG": 2, "Monitor": 3, "MRI": 1, "X-Ray": 2}
        },
        "Small-hospital surge": {
            "beds": {"ICU": 2, "EMERGENCY": 2, "GENERAL": 4},
            "doctors": {"Cardiologist": 1, "Neurologist": 1, "Physician": 2, "Surgeon": 1},
            "equipment": {"Ventilator": 1, "ECG": 1, "Monitor": 2, "MRI": 1, "X-Ray": 1}
        }
    }

    config_data = presets.get(preset_name, presets["Standard"])

    beds = []
    for b_type, count in config_data["beds"].items():
        prefix = f"BED-{b_type[:3]}"
        for i in range(1, count + 1):
            beds.append(Bed(f"{prefix}-{i:02d}", b_type, f"{b_type} Ward"))

    doctors = []
    for spec, count in config_data["doctors"].items():
        prefix = f"DOC-{spec[:4].upper()}"
        for i in range(1, count + 1):
            doctors.append(Doctor(f"{prefix}-{i:02d}", f"Dr. {spec} {i}", spec))

    equipment = []
    for eq_type, count in config_data["equipment"].items():
        prefix = f"EQP-{eq_type[:4].upper()}"
        for i in range(1, count + 1):
            equipment.append(Equipment(f"{prefix}-{i:02d}", eq_type, f"Suite {i}"))

    return Hospital(beds=beds, doctors=doctors, equipment=equipment)


def generate_patients(n: int, seed: int = 42, profile: str = "normal_day") -> List[Patient]:
    """Generates n validated synthetic patients deterministically using seed."""
    rnd = random.Random(seed)

    if profile == "surge":
        sev_choices = [1, 2, 3, 4, 5]
        sev_weights = [0.05, 0.10, 0.20, 0.30, 0.35]
    else:  # normal_day
        sev_choices = [1, 2, 3, 4, 5]
        sev_weights = [0.20, 0.25, 0.30, 0.15, 0.10]

    # Generate arrivals first and sort them
    arrivals = sorted([rnd.randint(0, 120) for _ in range(n)])

    patients = []
    for i in range(n):
        seq = i + 1
        sev = rnd.choices(sev_choices, weights=sev_weights, k=1)[0]

        # ICU requirement
        if sev == 5:
            icu = 1 if rnd.random() < 0.70 else 0
        elif sev == 4:
            icu = 1 if rnd.random() < 0.25 else 0
        else:
            icu = 0

        # Bed type
        if icu == 1:
            bed_type = "ICU"
        elif sev >= 4:
            bed_type = "EMERGENCY"
        else:
            bed_type = "GENERAL"

        # Risk and Urgency: severity +/- {-1, 0, 1}, clamped to 1-5
        risk = max(1, min(5, sev + rnd.choice([-1, 0, 1])))
        urgency = max(1, min(5, sev + rnd.choice([-1, 0, 1])))

        # Doctor Specialty: Physician 35%, Cardiologist 25%, Neurologist 20%, Surgeon 20%
        doc_spec = rnd.choices(
            ["Physician", "Cardiologist", "Neurologist", "Surgeon"],
            weights=[0.35, 0.25, 0.20, 0.20],
            k=1
        )[0]

        # Equipment
        if icu == 1:
            eq = rnd.choice(["Ventilator", "Monitor"])
        elif doc_spec == "Cardiologist":
            eq = rnd.choices(["ECG", "Monitor"], weights=[0.60, 0.40], k=1)[0]
        elif doc_spec == "Neurologist":
            eq = rnd.choices(["MRI", "None"], weights=[0.70, 0.30], k=1)[0]
        elif doc_spec == "Surgeon":
            eq = rnd.choices(["X-Ray", "Monitor", "None"], weights=[0.50, 0.25, 0.25], k=1)[0]
        else:  # Physician
            eq = rnd.choices(["None", "Monitor", "X-Ray"], weights=[0.70, 0.15, 0.15], k=1)[0]

        patients.append(Patient(
            patient_id=f"P{seq:02d}",
            name=f"Generated Patient {seq:02d}",
            age=rnd.randint(1, 95),
            severity=sev,
            arrival_minute=arrivals[i],
            risk=risk,
            urgency=urgency,
            icu_required=icu,
            required_bed_type=bed_type,
            required_doctor_specialty=doc_spec,
            required_equipment=eq,
            length_of_stay_min=rnd.randint(30, 150),
            arrival_seq=seq
        ))

    return patients
