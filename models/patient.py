"""Patient data model."""
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, List


class Status(str, Enum):
    NEW = "NEW"
    ALLOCATED = "ALLOCATED"
    WAITING = "WAITING"
    UNAVAILABLE = "UNAVAILABLE"
    COMPLETED = "COMPLETED"


@dataclass
class Patient:
    patient_id: str
    name: str
    age: int
    severity: int
    arrival_minute: int
    risk: int
    urgency: int
    icu_required: int
    required_bed_type: str
    required_doctor_specialty: str
    required_equipment: str = "None"
    length_of_stay_min: Optional[int] = None

    # Runtime fields (computed/set by allocator)
    status: Status = Status.NEW
    arrival_seq: int = 0
    waiting_minutes: int = 0
    waiting_level: int = 1
    priority: int = 0
    band: str = "NORMAL"
    assigned_bed_id: Optional[str] = None
    assigned_doctor_id: Optional[str] = None
    assigned_equipment_id: Optional[str] = None
    allocation_clock: Optional[int] = None
    reason_codes: List[str] = field(default_factory=list)
