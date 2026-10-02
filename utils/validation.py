"""Validation and domain integrity checks."""
import re
from dataclasses import dataclass, field
from typing import List, Optional, Set, Any
import config


@dataclass
class ValidationResult:
    ok: bool
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


def validate_patient_data(
    data: dict,
    existing_ids: Optional[Set[str]] = None,
    clock: int = config.DEMO_START_CLOCK
) -> ValidationResult:
    """Validates raw patient dictionary for input constraints."""
    errors: List[str] = []
    warnings: List[str] = []

    # 1. Patient ID validation
    raw_id = str(data.get("patient_id", "")).strip()
    if not raw_id:
        errors.append("Patient ID cannot be blank.")
    elif not re.match(config.ID_PATTERN, raw_id):
        errors.append(f"Patient ID '{raw_id}' is invalid. Allowed: alphanumeric, hyphen, underscore (1-20 chars).")
    elif existing_ids and raw_id.lower() in {eid.lower() for eid in existing_ids}:
        errors.append(f"Patient ID '{raw_id}' already exists (case-insensitive match).")

    # 2. Name validation
    name = str(data.get("name", "")).strip()
    if not name:
        errors.append("Patient name cannot be blank.")
    elif len(name) > config.MAX_NAME_LEN:
        errors.append(f"Patient name exceeds maximum allowed length of {config.MAX_NAME_LEN} characters.")

    # 3. Age validation
    try:
        age = int(data.get("age", -1))
        if age < 0 or age > 120:
            errors.append(f"Age {age} is outside the allowed range of 0 to 120.")
    except (ValueError, TypeError):
        errors.append("Age must be an integer between 0 and 120.")

    # 4. Severity / Risk / Urgency validation (1-5)
    for field_name in ("severity", "risk", "urgency"):
        try:
            val = int(data.get(field_name, -1))
            if val < 1 or val > 5:
                errors.append(f"{field_name.capitalize()} value '{val}' is outside the allowed range of 1 to 5.")
        except (ValueError, TypeError):
            errors.append(f"{field_name.capitalize()} must be an integer between 1 and 5.")

    # 5. ICU Required (0 or 1)
    try:
        icu = int(data.get("icu_required", 0))
        if icu not in (0, 1):
            errors.append("ICU required flag must be either 0 or 1.")
    except (ValueError, TypeError):
        errors.append("ICU required flag must be 0 or 1.")
        icu = 0

    # 6. Bed Type validation
    bed_type = str(data.get("required_bed_type", "")).strip()
    if bed_type not in config.BED_TYPES:
        errors.append(f"Unknown bed type '{bed_type}'. Allowed types: {', '.join(config.BED_TYPES)}.")
    elif icu == 1 and bed_type != "ICU":
        errors.append("ICU required is 1, so required bed type must be 'ICU'.")

    # 7. Doctor Specialty validation
    doc_spec = str(data.get("required_doctor_specialty", "")).strip()
    if doc_spec not in config.DOCTOR_SPECIALTIES:
        errors.append(f"Unknown doctor specialty '{doc_spec}'. Allowed specialties: {', '.join(config.DOCTOR_SPECIALTIES)}.")

    # 8. Equipment Type validation
    eq_type = str(data.get("required_equipment", config.NO_EQUIPMENT)).strip()
    allowed_eq = set(config.EQUIPMENT_TYPES) | {config.NO_EQUIPMENT}
    if eq_type not in allowed_eq:
        errors.append(f"Unknown equipment type '{eq_type}'. Allowed types: {', '.join(sorted(allowed_eq))}.")

    # 9. Arrival minute check
    try:
        arrival = int(data.get("arrival_minute", 0))
        if arrival < 0:
            errors.append("Arrival minute cannot be negative.")
        elif arrival > clock:
            warnings.append(f"Arrival minute ({arrival}) is after current clock ({clock}). Patient will be marked as not yet arrived.")
    except (ValueError, TypeError):
        errors.append("Arrival minute must be a valid integer.")

    return ValidationResult(ok=(len(errors) == 0), errors=errors, warnings=warnings)
