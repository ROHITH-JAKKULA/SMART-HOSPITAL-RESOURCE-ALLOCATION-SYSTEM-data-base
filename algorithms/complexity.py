"""Complexity measurement and empirical benchmark engine."""
import time
import random
from typing import List, Dict, Any, Tuple

from models.patient import Patient, Status
from models.bed import Bed
from models.doctor import Doctor
from models.equipment import Equipment
from models.hospital import Hospital
from .resource_allocator import ResourceAllocator


def generate_benchmark_instance(n: int, seed: int = 42) -> Tuple[Hospital, List[Patient]]:
    """Generates synthetic hospital and n patients for empirical benchmarking."""
    rnd = random.Random(seed)

    # Scale resources roughly proportional to N
    num_beds = max(5, n // 3)
    num_docs = max(4, n // 4)
    num_eqps = max(4, n // 4)

    beds = [
        Bed(bed_id=f"BED-{i}", bed_type=rnd.choice(["ICU", "EMERGENCY", "GENERAL"]), ward="Ward A")
        for i in range(num_beds)
    ]
    doctors = [
        Doctor(doctor_id=f"DOC-{i}", name=f"Doc {i}", specialization=rnd.choice(["Cardiologist", "Neurologist", "Physician", "Surgeon"]))
        for i in range(num_docs)
    ]
    equipment = [
        Equipment(equipment_id=f"EQP-{i}", equipment_type=rnd.choice(["Ventilator", "ECG", "Monitor", "MRI", "X-Ray"]), location="Wing 1")
        for i in range(num_eqps)
    ]

    hospital = Hospital(beds=beds, doctors=doctors, equipment=equipment)

    patients = []
    for i in range(1, n + 1):
        icu = rnd.choice([0, 1])
        b_type = "ICU" if icu else rnd.choice(["EMERGENCY", "GENERAL"])
        patients.append(Patient(
            patient_id=f"BM-P{i:04d}",
            name=f"Bench Patient {i}",
            age=rnd.randint(18, 85),
            severity=rnd.randint(1, 5),
            arrival_minute=rnd.randint(0, 120),
            risk=rnd.randint(1, 5),
            urgency=rnd.randint(1, 5),
            icu_required=icu,
            required_bed_type=b_type,
            required_doctor_specialty=rnd.choice(["Cardiologist", "Neurologist", "Physician", "Surgeon"]),
            required_equipment=rnd.choice(["Ventilator", "ECG", "Monitor", "None"]),
            arrival_seq=i
        ))

    return hospital, patients


def benchmark(sizes: List[int] = None, seed: int = 42) -> List[Dict[str, Any]]:
    """Empirically benchmarks Baseline vs Indexed allocation across sizes."""
    if sizes is None:
        sizes = [20, 50, 100, 200]

    results = []
    for n in sizes:
        h_base, p_base = generate_benchmark_instance(n, seed)
        alloc_base = ResourceAllocator(h_base, p_base, clock=120)

        # Baseline run
        res_base = alloc_base.run_allocation(strategy="baseline", order="priority", trace_snapshots=False)

        h_idx, p_idx = generate_benchmark_instance(n, seed)
        alloc_idx = ResourceAllocator(h_idx, p_idx, clock=120)

        # Indexed run
        res_idx = alloc_idx.run_allocation(strategy="indexed", order="priority", trace_snapshots=False)

        results.append({
            "n": n,
            "baseline_runtime_ms": round(res_base.runtime_ms, 2),
            "indexed_runtime_ms": round(res_idx.runtime_ms, 2),
            "speedup": round(res_base.runtime_ms / max(0.01, res_idx.runtime_ms), 2),
            "baseline_unit_checks": res_base.ops.unit_checks,
            "indexed_unit_checks": res_idx.ops.unit_checks,
            "heap_comparisons": res_idx.ops.heap_comparisons
        })

    return results
