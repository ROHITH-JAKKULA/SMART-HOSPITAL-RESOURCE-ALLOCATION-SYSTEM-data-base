"""Custom test runner that executes unit tests and measures line coverage across algorithms/ and utils/."""
import unittest
import sys
import os
import trace

if __name__ == "__main__":
    # Create a Trace object to track statement execution
    tracer = trace.Trace(
        ignoredirs=[sys.prefix, sys.exec_prefix],
        trace=0,
        count=1
    )

    loader = unittest.TestLoader()
    suite = loader.discover("tests", pattern="test_*.py")

    runner = unittest.TextTestRunner(verbosity=2)

    def run_suite():
        return runner.run(suite)

    print("=" * 80)
    print("RUNNING ALL UNIT TESTS & COVERAGE VERIFICATION")
    print("=" * 80)
    result = tracer.runfunc(run_suite)

    # Calculate coverage for files in algorithms/ and utils/
    counts = tracer.results().counts
    target_dirs = ["algorithms", "utils", "models"]

    total_lines = 0
    covered_lines = 0

    print("\n" + "=" * 80)
    print(f"{'Module / File':<40} | {'Executable':<12} | {'Covered':<10} | {'Coverage %':<10}")
    print("-" * 80)

    for (filename, lineno), count in sorted(counts.items()):
        # Filter for project source files
        pass

    # Simple source line scanner
    for root_dir in ["algorithms", "utils"]:
        for root, _, files in os.walk(root_dir):
            for file in files:
                if file.endswith(".py"):
                    filepath = os.path.abspath(os.path.join(root, file))
                    with open(filepath, "r", encoding="utf-8") as f:
                        lines = f.readlines()
                    exec_lines = 0
                    cov_lines = 0
                    for i, l in enumerate(lines, 1):
                        stripped = l.strip()
                        if stripped and not stripped.startswith("#") and not stripped.startswith('"""'):
                            exec_lines += 1
                            if counts.get((filepath, i), 0) > 0:
                                cov_lines += 1
                    total_lines += exec_lines
                    covered_lines += cov_lines
                    pct = (cov_lines / max(1, exec_lines)) * 100.0
                    rel_path = os.path.relpath(filepath)
                    print(f"{rel_path:<40} | {exec_lines:<12} | {cov_lines:<10} | {pct:<10.1f}%")

    overall_pct = (covered_lines / max(1, total_lines)) * 100.0
    print("-" * 80)
    print(f"{'OVERALL (algorithms/ + utils/)':<40} | {total_lines:<12} | {covered_lines:<10} | {overall_pct:<10.1f}%")
    print("=" * 80 + "\n")

    sys.exit(0 if result.wasSuccessful() else 1)
