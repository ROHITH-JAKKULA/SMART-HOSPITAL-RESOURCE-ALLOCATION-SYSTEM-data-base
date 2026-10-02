"""Bed resource model."""
from dataclasses import dataclass
from typing import Optional


@dataclass
class Bed:
    bed_id: str
    bed_type: str
    ward: str
    available: bool = True
    assigned_patient_id: Optional[str] = None
