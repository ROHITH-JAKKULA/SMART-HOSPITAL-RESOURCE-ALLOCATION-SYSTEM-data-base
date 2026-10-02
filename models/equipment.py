"""Equipment resource model."""
from dataclasses import dataclass
from typing import Optional


@dataclass
class Equipment:
    equipment_id: str
    equipment_type: str
    location: str
    available: bool = True
    assigned_patient_id: Optional[str] = None
