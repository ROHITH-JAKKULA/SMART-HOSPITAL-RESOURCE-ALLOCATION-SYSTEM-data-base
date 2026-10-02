"""Configuration and constants for the Smart Hospital Resource Allocation System.

DAA Hackathon System - Master Build v3.0
"""
from typing import Tuple, Dict

# Resource Categories and Types
BED_TYPES: Tuple[str, ...] = ("ICU", "EMERGENCY", "GENERAL")
DOCTOR_SPECIALTIES: Tuple[str, ...] = ("Cardiologist", "Neurologist", "Physician", "Surgeon")
EQUIPMENT_TYPES: Tuple[str, ...] = ("Ventilator", "ECG", "Monitor", "MRI", "X-Ray")
NO_EQUIPMENT: str = "None"

# Patient requirement -> acceptable resource types, in preference order
# (A future "bed upgrade" is one edit, e.g. "GENERAL": ("GENERAL", "ICU"))
BED_COMPATIBILITY: Dict[str, Tuple[str, ...]] = {
    "ICU": ("ICU",),
    "EMERGENCY": ("EMERGENCY",),
    "GENERAL": ("GENERAL",)
}

DOCTOR_COMPATIBILITY: Dict[str, Tuple[str, ...]] = {
    s: (s,) for s in DOCTOR_SPECIALTIES
}

EQUIPMENT_COMPATIBILITY: Dict[str, Tuple[str, ...]] = {
    e: (e,) for e in EQUIPMENT_TYPES
}
EQUIPMENT_COMPATIBILITY[NO_EQUIPMENT] = ()

# Unit ID prefixes
ID_PREFIX: Dict[str, str] = {
    "ICU": "BED-ICU",
    "EMERGENCY": "BED-EMG",
    "GENERAL": "BED-GEN",
    "Cardiologist": "DOC-CARD",
    "Neurologist": "DOC-NEUR",
    "Physician": "DOC-PHYS",
    "Surgeon": "DOC-SURG",
    "Ventilator": "EQP-VENT",
    "ECG": "EQP-ECG",
    "Monitor": "EQP-MON",
    "MRI": "EQP-MRI",
    "X-Ray": "EQP-XRAY"
}

# Priority Weights and Scoring Parameters
DEFAULT_WEIGHTS: Dict[str, int] = {
    "severity": 40,
    "waiting": 20,
    "risk": 15,
    "urgency": 15,
    "icu": 10
}

SCALES: Dict[str, Tuple[int, int]] = {
    "severity": (1, 5),
    "waiting": (1, 5),
    "risk": (1, 5),
    "urgency": (1, 5),
    "icu": (0, 1)
}

# minutes < bound -> level; else 5
WAIT_LEVEL_BREAKPOINTS: Tuple[Tuple[int, int], ...] = (
    (10, 1),
    (30, 2),
    (60, 3),
    (120, 4)
)

# score >= bound -> band; else NORMAL
BAND_THRESHOLDS: Tuple[Tuple[str, int], ...] = (
    ("CRITICAL", 360),
    ("HIGH", 240)
)

# Limits and System Defaults
MAX_UPLOAD_BYTES: int = 2_000_000
MAX_ROWS: int = 5_000
MAX_NAME_LEN: int = 60
ID_PATTERN: str = r"^[A-Za-z0-9_-]{1,20}$"

DEFAULT_LOS_MIN: int = 90
DEMO_START_CLOCK: int = 120
SNAPSHOT_LIMIT_N: int = 50
UNDO_DEPTH: int = 10
