"""Utilities package for Smart Hospital Resource Allocation System."""
from .scoring import calculate_priority, waiting_level, priority_band, score_breakdown
from .validation import validate_patient_data, ValidationResult
from .data_loader import (
    load_patients_from_csv,
    load_beds_from_csv,
    load_doctors_from_csv,
    load_equipment_from_csv,
    get_golden_data
)
from .serialization import (
    export_scenario_to_dict,
    export_scenario_to_json,
    import_scenario_from_dict,
    import_scenario_from_json
)
from .generator import generate_patients, get_preset_hospital
from .explain import explain_patient, Explanation
from .reports import (
    generate_patient_report,
    generate_allocation_report,
    generate_waiting_queue_report,
    generate_resource_utilization_report,
    generate_algorithm_execution_report,
    generate_event_log_report,
    generate_run_history_report,
    sanitize_csv_cell
)
from .logging_config import setup_logger

__all__ = [
    "calculate_priority",
    "waiting_level",
    "priority_band",
    "score_breakdown",
    "validate_patient_data",
    "ValidationResult",
    "load_patients_from_csv",
    "load_beds_from_csv",
    "load_doctors_from_csv",
    "load_equipment_from_csv",
    "get_golden_data",
    "export_scenario_to_dict",
    "export_scenario_to_json",
    "import_scenario_from_dict",
    "import_scenario_from_json",
    "generate_patients",
    "get_preset_hospital",
    "explain_patient",
    "Explanation",
    "generate_patient_report",
    "generate_allocation_report",
    "generate_waiting_queue_report",
    "generate_resource_utilization_report",
    "generate_algorithm_execution_report",
    "generate_event_log_report",
    "generate_run_history_report",
    "sanitize_csv_cell",
    "setup_logger"
]
