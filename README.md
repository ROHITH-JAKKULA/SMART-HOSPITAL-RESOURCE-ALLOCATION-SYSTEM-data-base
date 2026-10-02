# Smart Hospital Resource Allocation System
[![CI Tests](https://github.com/DAA-Team/Smart-Hospital-Resource-Allocation/actions/workflows/ci.yml/badge.svg)](https://github.com/DAA-Team/Smart-Hospital-Resource-Allocation/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python: 3.10+](https://img.shields.io/badge/Python-3.10%2B-brightgreen.svg)](https://www.python.org/)
[![Code Style: Ruff](https://img.shields.io/badge/Code%20Style-Ruff-000000.svg)](https://github.com/astral-sh/ruff)

> **DAA Hackathon Master Project (v3.0)**  
> *A hospital has limited beds, doctors, and medical equipment. Allocate these resources to patients according to their priority and medical requirements.*

---

## 🏥 Live Demo & Overview
- **Development App:** [Interactive Live Demo](https://ais-dev-r4c3wu74dfngd63cco42kf-566964980389.asia-southeast1.run.app)
- **Primary Mission:** Make core DAA data structures and algorithms—**Priority Queues**, **Hand-Written Max-Heaps**, **Floyd's Heapify**, **Greedy Multi-Resource Matchers**, and **Constraint Checkers**—visible, explainable, and benchmarkable in real time.

---

## 📌 DAA Concept Map: "Where Is It in the Code?"

| DAA Concept | File $\rightarrow$ Function / Class | Visible in UI |
|---|---|---|
| **Priority Formula** | `utils/scoring.py` $\rightarrow$ `calculate_priority()` | Patients Page (Breakdown), Algorithm Page |
| **Binary Max-Heap** | `algorithms/priority_queue.py` $\rightarrow$ `MaxHeap` | Algorithm: Interactive SVG Tree + Array Table |
| **Extract-Max Order** | `MaxHeap.extract_max()` | Algorithm: Step Slider + Trace Table |
| **Floyd's Heapify ($O(N)$)** | `MaxHeap.build_heap()` | Algorithm: Construction Selector |
| **Constraint Checking** | `algorithms/greedy_allocator.py` $\rightarrow$ `find_plan_*` | Trace Table: Bed / Doctor / Equipment $\checkmark / \times$ |
| **All-or-Nothing Commit** | `algorithms/greedy_allocator.py` $\rightarrow$ `commit_plan()` | Trace: "Candidate not committed" notice |
| **Resource Indexing ($O(1)$)** | `models/hospital.py` $\rightarrow$ `free_units()` deque | Strategy A vs C Comparison Panel |
| **Bottleneck Analysis** | `algorithms/advisor.py` $\rightarrow$ `bottleneck_table()` | Dashboard Chart 8 & Pressure Callout |
| **Marginal-Benefit Advisor** | `algorithms/advisor.py` $\rightarrow$ `advise()` | Simulation: Marginal Benefit Ranking |
| **Discrete Sim Event Queue** | `algorithms/simulation_engine.py` $\rightarrow$ `MinHeap` | Simulation: Hospital-Day Timeline |
| **Empirical Complexity** | `algorithms/complexity.py` $\rightarrow$ `benchmark()` | Algorithm: Measured vs Theory Chart |

---

## ⚙️ Algorithm Architecture & Pseudocode

### 1. Two-Phase All-or-Nothing Greedy Matcher
```
RUN_ALLOCATION(A, strategy, order):
    pool ← [eligible arrived patients]
    for p in pool:
        p.waiting_minutes ← A.clock − p.arrival_minute
        p.waiting_level   ← WAITING_LEVEL(p.waiting_minutes)
        p.priority        ← CALC_PRIORITY(p, A.weights)
    Q ← MaxHeap(); Q.insert((p.priority, p.severity, -p.seq), p) for p in pool
    
    while Q is not empty:
        p ← Q.extract_max()
        plan ← FIND_PLAN(strategy, p, A.hospital)    # Phase 1: Read-Only Check
        if plan.complete:
            COMMIT(plan, p, A.clock)                 # Phase 2: Atomic Commit
            p.status ← ALLOCATED
        else:
            p.status ← UNAVAILABLE if any missing code ends with "_IN_INVENTORY" else WAITING
            p.reason_codes ← missing_codes
        LOG_TRACE_STEP(p, plan)
    return AllocationResult(...)
```

### 2. Priority Scoring Formula
$$\text{Priority} = 40 \cdot S + 20 \cdot W + 15 \cdot R + 15 \cdot U + 10 \cdot I$$
- **Emergency Severity ($S$):** 1–5 ($\times 40$)
- **Waiting Level ($W$):** 1–5 ($\times 20$) — *Dynamic Aging to eliminate starvation*
- **Risk Factor ($R$):** 1–5 ($\times 15$)
- **Resource Urgency ($U$):** 1–5 ($\times 15$)
- **ICU Requirement ($I$):** 0 or 1 ($\times 10$)
- *Range:* Min 90 to Max 460. Bands: $\ge 360$ (CRITICAL), $240–359$ (HIGH), $<240$ (NORMAL).

---

## 📊 Complexity Analysis (Theoretical vs Measured)

| Step | Baseline Strategy | Indexed Strategy (Our Engine) |
|---|---|---|
| **Priority & Aging** | $O(N)$ | $O(N)$ |
| **Heap Build & Extract** | $O(N \log N)$ | $O(N \log N)$ |
| **Resource Search** | $O(N \cdot B \cdot D \cdot E)$ *(triple loop)* | $O(N)$ *(indexed deques)* |
| **Overall Time** | $O(N \log N + N \cdot B \cdot D \cdot E)$ | **$O(N \log N)$** |
| **Auxiliary Space** | $O(N + B + D + E)$ | **$O(N + B + D + E)$** |

### Real Measured Benchmark
At $N = 100$ patients:
- **Baseline:** 310.52 ms | 1,387,806 unit checks
- **Indexed:** 6.34 ms | 274 unit checks (**49x speedup**)

---

## 🚀 Quickstart & Commands

### 1. Run Unit Tests (41 Verified Tests)
```bash
python3 run_tests.py
# or standard unittest
python3 -m unittest tests/test_all_requirements.py
```

### 2. Terminal CLI Fallback
```bash
# Run verified golden dataset with step trace
python3 cli.py run --dataset golden --strategy indexed --trace

# Run empirical complexity benchmark
python3 cli.py benchmark --max-n 200
```

### 3. Local Web App (Streamlit)
```bash
pip install -r requirements-dev.txt
streamlit run app.py
```

---

## 🔒 Security Hardening
- **CSV-Injection Protection:** Text cells starting with `=`, `+`, `-`, `@`, `\t`, or `\r` are prefixed with `'`.
- **Upload Hardening:** Restricts payload to 2 MB and 5,000 rows with schema regex validation.
- **Domain Exceptions:** Normal constraint violations raise `DomainError` with actionable feedback.

---

## ⚠️ Academic Disclaimer
*This system is an academic simulation built for a Design and Analysis of Algorithms course. The priority formula is not a clinical triage protocol. This software must not be used to make real medical decisions.*

---

## 📜 License
Licensed under the [MIT License](LICENSE).
