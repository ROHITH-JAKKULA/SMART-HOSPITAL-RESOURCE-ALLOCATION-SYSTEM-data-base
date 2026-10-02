"""Doctor resource model."""
from dataclasses import dataclass
from typing import Optional


@dataclass
class Doctor:
    doctor_id: str
    name: str
    specialization: str
    available: bool = True
    assigned_patient_id: Optional[str] = None
