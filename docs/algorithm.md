# Algorithm Specification & DAA Concept Map

## 1. Pipeline Architecture
```
PATIENT INPUT → VALIDATE → REQUIREMENT ANALYSIS (bed, doctor, equipment)
   → DYNAMIC PRIORITY (recomputed every run: aging)
   → MAX HEAP (insert all eligible patients)
   → EXTRACT-MAX (highest priority)
   → FIND_PLAN  (read-only search for bed + doctor + equipment)
        ├─ complete → COMMIT all units together → ALLOCATED
        └─ incomplete → WAITING / UNAVAILABLE (+ reason codes, nothing committed)
   → LOG TRACE STEP → next patient → heap empty → METRICS
```

## 2. Priority Scoring Formula
Every patient is assigned an academic priority score:
$$\text{Priority} = 40 \cdot S + 20 \cdot W + 15 \cdot R + 15 \cdot U + 10 \cdot I$$

| Factor | Symbol | Scale | Default Weight | Meaning |
|---|---|---|---|---|
| Emergency Severity | $S$ | 1–5 | $\times 40$ | Acute severity of patient condition |
| Waiting Level | $W$ | 1–5 | $\times 20$ | Derived from minutes waited ($T_{\text{clock}} - T_{\text{arrival}}$) |
| Risk Factor | $R$ | 1–5 | $\times 15$ | Risk of immediate physiological deterioration |
| Resource Urgency | $U$ | 1–5 | $\times 15$ | Criticality of the needed medical resources |
| ICU Requirement | $I$ | 0 or 1 | $\times 10$ | Indicator if intensive care bed is required |

**Waiting Level Breakpoints:**
- $< 10\text{ min} \implies 1$
- $10\text{–}29\text{ min} \implies 2$
- $30\text{–}59\text{ min} \implies 3$
- $60\text{–}119\text{ min} \implies 4$
- $\ge 120\text{ min} \implies 5$

**Priority Bands:**
- $\ge 360 \implies \text{\textbf{CRITICAL}}$ (Red)
- $240\text{–}359 \implies \text{\textbf{HIGH}}$ (Orange)
- $< 240 \implies \text{\textbf{NORMAL}}$ (Blue)

Range: Minimum 90 ($1,1,1,1,0$), Maximum 460 ($5,5,5,5,1$). Every score is a multiple of 5.

---

## 3. Data Structure: Hand-Written Max Heap
The extraction order is governed by a hand-written array-based binary Max Heap (`algorithms/priority_queue.py`).

### Key Structure
Each heap element has key:
$$\text{Key} = (\text{Priority}, \text{Severity}, -\text{arrival\_seq})$$
- Priority is compared first (descending).
- Ties broken by higher Severity.
- Further ties broken by earlier arrival sequence ($-\text{arrival\_seq}$).
- **Total ordering guarantee:** Patient objects are never compared directly.

### Operations
1. `insert(key, item)`: Appends to end of array and calls `_sift_up(i)` in $O(\log N)$.
2. `extract_max()`: Replaces root with last element, pops last, and calls `_sift_down(0)` in $O(\log N)$.
3. `build_heap(pairs)`: Bottom-up Floyd heap construction in $O(N)$.
4. `peek()`: Inspects root in $O(1)$.

---

## 4. Greedy Resource Allocation Strategies

### Two-Phase All-or-Nothing Rule
1. **Phase 1 (Read-Only):** `find_plan()` inspects compatibility and searches for available units. If any required resource is missing, a detailed diagnostic `Missing` report is generated.
2. **Phase 2 (Atomic Commit):** `commit_plan()` executes only if the plan is completely satisfied. All units transition from free to busy in unison. Partial resource holding is structurally prevented.

### Strategy A: Baseline (Exhaustive Triple-Loop)
```python
for bed in H.beds:
    for doc in H.doctors:
        for eq in (H.equipment if p.needs_equipment else [NONE]):
            unit_checks += 1
            if bed.free and bed.type == p.bed and doc.free and doc.spec == p.doctor and ...:
                return Plan(bed, doc, eq)
```
Worst-case cost: $O(B \cdot D \cdot E)$ per patient. Total: $O(N \cdot B \cdot D \cdot E)$.

### Strategy C: Indexed Lookups ($O(1)$)
The `Hospital` maintains free queues (`collections.deque`) for each discrete `(kind, type)`.
```python
# Look at front of each required deque: O(1)
if len(H.free[("bed", p.required_bed)]) > 0 and len(H.free[("doctor", p.required_doc)]) > 0 ...:
    return Plan(bed, doc, eq)
```
Commit pops in $O(1)$; Release appends back in $O(1)$. Total matching: $O(N)$.

---

## 5. DAA Concept Map: "Where Is It in the Code?"

| DAA Concept | File $\rightarrow$ Class / Function | Visible in the UI |
|---|---|---|
| **Priority Formula** | `utils/scoring.py` $\rightarrow$ `calculate_priority()` | Patients Page (stacked breakdown), Algorithm Page |
| **Max Heap / Priority Queue** | `algorithms/priority_queue.py` $\rightarrow$ `MaxHeap` | Algorithm Page: interactive SVG tree + array table |
| **Extract-Max Order** | `MaxHeap.extract_max()` | Algorithm Page: step slider + trace table |
| **Sorting & Determinism** | `sorted()` baselines, tie-breaking tuple keys | Patients Table, Weight Lab |
| **Constraint Checking** | `algorithms/greedy_allocator.py` $\rightarrow$ `find_plan_*` | Trace Table: Bed / Doctor / Equipment $\checkmark / \times$ |
| **Greedy Choice** | `algorithms/greedy_allocator.py` $\rightarrow$ descending priority | Allocation Page, Trace Table |
| **All-or-Nothing Commit** | `algorithms/greedy_allocator.py` $\rightarrow$ `commit_plan()` | Trace: "Candidate not committed" notice |
| **Waiting Queue & Reason Codes** | `ResourceAllocator.waiting_queue()` | Allocation Page, Dashboard strip |
| **Resource Indexing ($O(1)$)** | `models/hospital.py` $\rightarrow$ `free_units()` deque | Strategy A vs C comparison panel |
| **Bottleneck Analysis** | `algorithms/advisor.py` $\rightarrow$ `bottleneck_table()` | Dashboard Chart 8, Pressure callout |
| **Marginal-Benefit Advisor** | `algorithms/advisor.py` $\rightarrow$ `advise()` | Simulation Page: Advisor Ranking Table |
| **Empirical Complexity** | `algorithms/complexity.py` $\rightarrow$ `benchmark()` | Algorithm Page: Measured vs Theory chart |
| **Second Heap (Event Queue)** | `algorithms/simulation_engine.py` $\rightarrow$ `MinHeap` | Simulation: Hospital-Day timeline & step chart |

---

## 6. Honest Algorithmic Limitations & Counterexample
Greedy by Priority maximizes the priority order of serviced patients; **it does not maximize throughput (patient count)**.

### Proven Counterexample (§7.13, T22)
- **Inventory:** 1 General Bed, 1 ICU Bed, 1 Physician, 1 Cardiologist, 0 ECG Machines.
- **Patients:**
  1. $P$: Priority 400 (Requires: General Bed + Physician + ECG)
  2. $Q_1$: Priority 300 (Requires: General Bed + Cardiologist + None)
  3. $Q_2$: Priority 200 (Requires: ICU Bed + Physician + None)
- **Execution with 0 ECG:**
  - $P$ is UNAVAILABLE (needs ECG).
  - $Q_1$ is ALLOCATED (General Bed + Cardiologist).
  - $Q_2$ is ALLOCATED (ICU Bed + Physician).
  - **Total Allocated = 2.**
- **Execution after adding 1 ECG machine:**
  - $P$ is ALLOCATED (claims General Bed + Physician + ECG).
  - $Q_1$ is WAITING (General Bed taken by $P$).
  - $Q_2$ is WAITING (Physician taken by $P$).
  - **Total Allocated = 1.**

**Takeaway:** Adding a resource reduced total allocations from 2 to 1! This directly illustrates why the general multi-resource matching problem is NP-hard, justifying an explainable greedy heuristic with explicit trade-off visibility.
