"""Terminal CLI fallback for Smart Hospital Resource Allocation System (F25).

Usage:
    python cli.py run --dataset golden --strategy indexed --trace
    python cli.py run --dataset demo --strategy baseline
    python cli.py benchmark --max-n 200
"""
import argparse
import sys
import os

from utils.data_loader import (
    get_golden_data,
    load_patients_from_csv,
    load_beds_from_csv,
    load_doctors_from_csv,
    load_equipment_from_csv
)
from models.hospital import Hospital
from algorithms.resource_allocator import ResourceAllocator
from algorithms.complexity import benchmark


def cmd_run(args: argparse.Namespace) -> int:
    """Executes allocation run and displays metrics and trace."""
    if args.dataset == "golden":
        hospital, patients = get_golden_data()
        clock = 120
    else:
        # Load from data/ folder
        beds = load_beds_from_csv(os.path.join("data", "beds.csv"))
        doctors = load_doctors_from_csv(os.path.join("data", "doctors.csv"))
        equipment = load_equipment_from_csv(os.path.join("data", "equipment.csv"))
        patients = load_patients_from_csv(os.path.join("data", "patients.csv"))
        hospital = Hospital(beds=beds, doctors=doctors, equipment=equipment)
        clock = args.clock

    allocator = ResourceAllocator(hospital, patients, clock=clock)
    result = allocator.run_allocation(
        strategy=args.strategy,
        order=args.order,
        trace_snapshots=args.trace
    )

    print("\n" + "=" * 80)
    print(f"SMART HOSPITAL RESOURCE ALLOCATION SYSTEM (CLI)")
    print(f"Dataset: {args.dataset.upper()} | Strategy: {args.strategy.upper()} | Order: {args.order.upper()} | Clock: T+{clock} min")
    print("=" * 80)

    if args.trace:
        print("\n--- EXECUTION TRACE ---")
        print(f"{'Step':<5} | {'PID':<5} | {'Pri':<5} | {'Bed Check':<30} | {'Doctor Check':<32} | {'Result':<11}")
        print("-" * 100)
        for t in result.trace:
            b_check = t.checks.get("bed", "—")[:30]
            d_check = t.checks.get("doctor", "—")[:32]
            print(f"{t.step_no:<5} | {t.patient_id:<5} | {t.priority:<5} | {b_check:<30} | {d_check:<32} | {t.result.value:<11}")

    m = result.metrics
    print("\n--- SUMMARY METRICS ---")
    print(f"Total Patients: {m.total_patients} | Allocated: {m.allocated_count} | Waiting: {m.waiting_count} | Unavailable: {m.unavailable_count}")
    print(f"Priority-Weighted Score: {m.weighted_score} | Bypass Count: {m.bypass_count}")
    print(f"Bed Utilisation: {m.beds_busy}/{m.beds_total} ({m.beds_util_pct}%)")
    print(f"Doctor Utilisation: {m.doctors_busy}/{m.doctors_total} ({m.doctors_util_pct}%)")
    print(f"Equipment Utilisation: {m.equipment_busy}/{m.equipment_total} ({m.equipment_util_pct}%)")
    print(f"Overall Utilisation: {m.overall_busy}/{m.overall_total} ({m.overall_util_pct}%)")
    print(f"Unit Checks Used: {result.ops.unit_checks} | Heap Comparisons: {result.ops.heap_comparisons}")
    print(f"Execution Time: {result.runtime_ms:.2f} ms")
    print("=" * 80 + "\n")

    return 0


def cmd_benchmark(args: argparse.Namespace) -> int:
    """Executes empirical complexity benchmarks."""
    max_n = args.max_n
    sizes = [s for s in [20, 50, 100, 200, 500, 1000] if s <= max_n]
    if max_n not in sizes:
        sizes.append(max_n)

    print("\n" + "=" * 80)
    print(f"RUNNING EMPIRICAL COMPLEXITY BENCHMARK (N up to {max_n})")
    print("=" * 80)
    print(f"{'N':<8} | {'Baseline (ms)':<15} | {'Indexed (ms)':<15} | {'Speedup':<10} | {'Base Checks':<14} | {'Idx Checks':<12}")
    print("-" * 80)

    rows = benchmark(sizes=sizes, seed=42)
    for r in rows:
        print(f"{r['n']:<8} | {r['baseline_runtime_ms']:<15.2f} | {r['indexed_runtime_ms']:<15.2f} | {r['speedup']:<10.1f}x | {r['baseline_unit_checks']:<14} | {r['indexed_unit_checks']:<12}")

    print("=" * 80 + "\n")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Smart Hospital Resource Allocation System CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # run command
    run_parser = subparsers.add_parser("run", help="Run resource allocation")
    run_parser.add_argument("--dataset", choices=["golden", "demo"], default="golden", help="Dataset to load")
    run_parser.add_argument("--strategy", choices=["indexed", "baseline"], default="indexed", help="Matcher strategy")
    run_parser.add_argument("--order", choices=["priority", "fcfs"], default="priority", help="Processing order")
    run_parser.add_argument("--clock", type=int, default=120, help="Initial simulation clock (minutes)")
    run_parser.add_argument("--trace", action="store_true", help="Display full step-by-step execution trace")

    # benchmark command
    bench_parser = subparsers.add_parser("benchmark", help="Run empirical performance benchmarks")
    bench_parser.add_argument("--max-n", type=int, default=200, help="Maximum number of patients to benchmark")

    args = parser.parse_args()
    if args.command == "run":
        return cmd_run(args)
    elif args.command == "benchmark":
        return cmd_benchmark(args)
    return 0


if __name__ == "__main__":
    sys.exit(main())
