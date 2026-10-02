"""CSV report generation with CSV-injection hardening."""
from __future__ import annotations
import csv
import io
from typing import List, Dict, Any, Optional, TYPE_CHECKING

import config
from models.patient import Patient, Status

if TYPE_CHECKING:
    from algorithms.resource_allocator import ResourceAllocator, TraceStep


def sanitize_csv_cell(value: Any) -> str:
    """Hardens string cells against CSV formula injection by prepending a single quote.

    Targets cells starting with =, +, -, @, \\t, or \\r.
    """
    if value is None:
        return ""
    val_str = str(value)
    if val_str and val_str[0] in ('=', '+', '-', '@', '\t', '\r'):
        return "'" + val_str
    return val_str


def generate_patient_report(allocator: "ResourceAllocator") -> str:
    """Generates patient_report.csv content."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "patient_id", "name", "age", "severity", "waiting_minutes",
        "waiting_level", "risk", "urgency", "icu_required",
        "bed_type", "doctor_specialty", "equipment", "priority",
        "band", "status"
    ])

    for p in allocator.patients:
        writer.writerow([
            sanitize_csv_cell(p.patient_id),
            sanitize_csv_cell(p.name),
            p.age,
            p.severity,
            p.waiting_minutes,
            p.waiting_level,
            p.risk,
            p.urgency,
            p.icu_required,
            sanitize_csv_cell(p.required_bed_type),
            sanitize_csv_cell(p.required_doctor_specialty),
            sanitize_csv_cell(p.required_equipment),
            p.priority,
            p.band,
            p.status.value
        ])

    return output.getvalue()


def generate_allocation_report(allocator: "ResourceAllocator") -> str:
    """Generates allocation_report.csv content."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "patient_id", "name", "priority", "bed_id", "doctor_id",
        "doctor_name", "equipment_id", "allocation_time",
        "wait_at_allocation", "status"
    ])

    for p in allocator.patients:
        doc_name = ""
        if p.assigned_doctor_id:
            d = next((doc for doc in allocator.hospital.doctors if doc.doctor_id == p.assigned_doctor_id), None)
            doc_name = d.name if d else ""

        wait_alloc = (p.allocation_clock - p.arrival_minute) if p.allocation_clock is not None else ""

        writer.writerow([
            sanitize_csv_cell(p.patient_id),
            sanitize_csv_cell(p.name),
            p.priority,
            sanitize_csv_cell(p.assigned_bed_id),
            sanitize_csv_cell(p.assigned_doctor_id),
            sanitize_csv_cell(doc_name),
            sanitize_csv_cell(p.assigned_equipment_id),
            p.allocation_clock if p.allocation_clock is not None else "",
            wait_alloc,
            p.status.value
        ])

    return output.getvalue()


def generate_waiting_queue_report(allocator: "ResourceAllocator") -> str:
    """Generates waiting_queue_report.csv content."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "patient_id", "priority", "required_bed", "required_doctor",
        "required_equipment", "status", "reason_codes", "reason_text"
    ])

    for p in allocator.waiting_queue():
        reason_text = "; ".join(p.reason_codes) if p.reason_codes else "Resource conflict"
        writer.writerow([
            sanitize_csv_cell(p.patient_id),
            p.priority,
            sanitize_csv_cell(p.required_bed_type),
            sanitize_csv_cell(p.required_doctor_specialty),
            sanitize_csv_cell(p.required_equipment),
            p.status.value,
            sanitize_csv_cell(", ".join(p.reason_codes)),
            sanitize_csv_cell(reason_text)
        ])

    return output.getvalue()


def generate_resource_utilization_report(allocator: "ResourceAllocator") -> str:
    """Generates resource_utilization_report.csv content."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["category", "type", "total", "busy", "free", "utilization_pct"])

    for bt in config.BED_TYPES:
        total = allocator.hospital.total_units("bed", bt)
        busy = total - len(allocator.hospital.free_units("bed", bt))
        pct = round(busy / total * 100, 1) if total > 0 else 0.0
        writer.writerow(["Bed", bt, total, busy, total - busy, pct])

    for ds in config.DOCTOR_SPECIALTIES:
        total = allocator.hospital.total_units("doctor", ds)
        busy = total - len(allocator.hospital.free_units("doctor", ds))
        pct = round(busy / total * 100, 1) if total > 0 else 0.0
        writer.writerow(["Doctor", ds, total, busy, total - busy, pct])

    for et in config.EQUIPMENT_TYPES:
        total = allocator.hospital.total_units("equipment", et)
        busy = total - len(allocator.hospital.free_units("equipment", et))
        pct = round(busy / total * 100, 1) if total > 0 else 0.0
        writer.writerow(["Equipment", et, total, busy, total - busy, pct])

    return output.getvalue()


def generate_algorithm_execution_report(trace: List["TraceStep"]) -> str:
    """Generates algorithm_execution_report.csv content from trace steps."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "step", "patient_id", "priority", "heap_size_before",
        "bed_check", "doctor_check", "equipment_check",
        "result", "assigned_units", "reason_codes", "unit_checks_used"
    ])

    for t in trace:
        assigned_str = ", ".join(f"{k}:{v}" for k, v in t.assigned.items() if v)
        writer.writerow([
            t.step_no,
            sanitize_csv_cell(t.patient_id),
            t.priority,
            t.heap_size_before,
            sanitize_csv_cell(t.checks.get("bed", "")),
            sanitize_csv_cell(t.checks.get("doctor", "")),
            sanitize_csv_cell(t.checks.get("equipment", "")),
            t.result.value,
            sanitize_csv_cell(assigned_str),
            sanitize_csv_cell(", ".join(t.reason_codes)),
            t.unit_checks_used
        ])

    return output.getvalue()


def generate_event_log_report(allocator: "ResourceAllocator") -> str:
    """Generates event_log.csv content."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["clock", "kind", "details"])

    for ev in allocator.event_log:
        writer.writerow([ev.clock, sanitize_csv_cell(ev.kind), sanitize_csv_cell(ev.details)])

    return output.getvalue()


def generate_run_history_report(allocator: "ResourceAllocator") -> str:
    """Generates run_history.csv content."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "run_id", "clock", "strategy", "order", "patients",
        "allocated", "waiting", "unavailable", "overall_utilization_pct",
        "avg_priority", "weighted_score", "bypass_count",
        "unit_checks", "runtime_ms"
    ])

    for h in allocator.history:
        writer.writerow([
            h.run_id, h.clock, h.strategy, h.order, h.patients,
            h.allocated, h.waiting, h.unavailable, h.overall_utilization_pct,
            h.avg_priority, h.weighted_score, h.bypass_count,
            h.unit_checks, h.runtime_ms
        ])

    return output.getvalue()
