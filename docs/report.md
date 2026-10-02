# Smart Hospital Resource Allocation System: Technical Report

## Abstract
Healthcare resource scarcity in emergency and intensive care settings demands scheduling algorithms that balance medical urgency, multi-resource constraints, and starvation prevention. This paper presents the architecture, implementation, and empirical verification of the Smart Hospital Resource Allocation System. Built for Design and Analysis of Algorithms (DAA) evaluation, the system implements a dynamic priority scoring formula, a hand-written array-based binary MaxHeap, and a two-phase all-or-nothing greedy matching engine. We present an optimization that reduces combinatorial triple-nested matching from $O(N \cdot B \cdot D \cdot E)$ to $O(N \log N)$ via type-indexed deques. Verified against a hand-calculated golden dataset and 41 automated test cases, the system includes bottleneck analysis, explainability diagnostics, and a discrete-event simulation engine.

---

## 1. Introduction
Modern hospitals face persistent operational friction during emergency surges. Medical triage is characterized by strict multi-resource interdependencies: a patient undergoing acute respiratory distress requires an ICU bed, a specialized physician, and a mechanical ventilator concurrently. Allocating these resources under First-Come, First-Served (FCFS) paradigms causes severe clinical degradation, while naive greedy heuristics risk deadlock or indefinite starvation. 

This project addresses these challenges by developing a transparent, deterministic algorithm that models multi-resource allocation as a constrained priority queue scheduling problem.

---

## 2. Problem Definition & Mathematical Model
Let a hospital inventory be represented by three sets of resources:
- Beds $B = \{b_1, \dots, b_{|B|}\}$ with types $T_B = \{\text{ICU}, \text{EMERGENCY}, \text{GENERAL}\}$
- Doctors $D = \{d_1, \dots, d_{|D|}\}$ with specialties $T_D = \{\text{Cardiologist}, \text{Neurologist}, \text{Physician}, \text{Surgeon}\}$
- Equipment $E = \{e_1, \dots, e_{|E|}\}$ with categories $T_E = \{\text{Ventilator}, \text{ECG}, \text{Monitor}, \text{MRI}, \text{X-Ray}\}$

A patient $p_i$ is defined by the requirement tuple:
$$p_i = (req\_bed_i \in T_B, req\_doc_i \in T_D, req\_eq_i \in T_E \cup \{\text{None}\})$$

### Priority Function with Dynamic Aging
Clinical urgency is quantified via:
$$\text{Priority}(p_i) = 40 \cdot S_i + 20 \cdot W_i + 15 \cdot R_i + 15 \cdot U_i + 10 \cdot I_i$$
where $S_i, R_i, U_i \in [1, 5]$ denote severity, risk, and resource urgency; $I_i \in \{0, 1\}$ denotes ICU need; and $W_i \in [1, 5]$ represents the waiting level derived from elapsed wait time:
$$W_i = \text{waiting\_level}(T_{\text{clock}} - T_{\text{arrival}})$$

---

## 3. Algorithm Specification & Optimization

### Two-Phase Greedy Matching
To guarantee atomicity and prevent partial resource holding, allocation is divided into two distinct phases:
1. **Candidate Verification (Read-Only):** The matcher checks whether free units satisfy $req\_bed$, $req\_doc$, and $req\_eq$ concurrently. If any component is unavailable, the candidate units remain free, and diagnostic reason codes (`BED_BUSY`, `NO_DOCTOR_IN_INVENTORY`, etc.) are recorded.
2. **Atomic State Transition:** If all three units exist, they transition to busy in unison, and pointers are assigned to the patient.

### Baseline vs. Indexed Strategy
- **Baseline Strategy ($O(N \cdot B \cdot D \cdot E)$):** Iterates through all combinations of beds $\times$ doctors $\times$ equipment.
- **Indexed Strategy ($O(N \log N)$):** Maintains type-based double-ended queues ($deque$) of available units in ID order. Candidate lookups execute in $O(1)$ by peeking at the head of the corresponding queue.

---

## 4. Empirical Results & Benchmark Analysis
Empirical profiling confirms our theoretical complexity bounds. On synthetic benchmarks ranging from $N=20$ to $N=100$:

| Metric | $N = 20$ | $N = 50$ | $N = 100$ |
|---|---|---|---|
| Baseline Runtime | 2.30 ms | 21.44 ms | 310.52 ms |
| Indexed Runtime | 1.51 ms | 3.24 ms | 6.34 ms |
| **Speedup** | **1.5x** | **6.6x** | **49.0x** |
| Baseline Unit Checks | 2,521 | 88,030 | 1,387,806 |
| Indexed Unit Checks | 59 | 142 | 274 |

The indexed algorithm scales quasi-linearly, keeping unit checks proportional to the number of required resources ($< 3$ checks per patient).

---

## 5. Verification on the Golden Dataset
On the hand-verified 4-patient benchmark ($T_{\text{clock}} = 120$):
- **P01** (Score 440, CRITICAL): Allocated `BED-ICU-01`, `DOC-CARD-01`, `EQP-VENT-01`.
- **P03** (Score 390, CRITICAL): Allocated `BED-ICU-02`, `DOC-NEUR-01`, `EQP-MON-01`.
- **P02** (Score 240, HIGH): Allocated `BED-GEN-01`, `DOC-PHYS-01`.
- **P04** (Score 165, NORMAL): Evaluated 4th. `BED-GEN-02` is free (candidate not committed); `DOC-PHYS-01` is busy $\implies$ **WAITING**.
- **Final Metrics:** Allocated = 3, Waiting = 1, Unavailable = 0. Weighted Score = 1,070. Bypass Count = 0. Bed Utilisation = 60.0%, Doctor Utilisation = 100.0%, Equipment Utilisation = 50.0%, Overall Utilisation = 66.7%. Exact match on all metrics.

---

## 6. Ethical Considerations and Algorithmic Limitations
1. **Priority vs. Throughput:** The greedy-by-priority heuristic does not maximize the cardinality of served patients. In our counterexample (§7.13, T22), adding an ECG machine reduced total allocations from 2 to 1 because a newly enabled high-urgency patient claimed shared resources.
2. **Subjective Weight Encodings:** Priority weights represent institutional policy decisions rather than absolute clinical truths. The Weight Lab makes these trade-offs visible.
3. **Academic Scope:** This system is an algorithmic simulation and is not approved for actual clinical triage.

---

## 7. Conclusion & Future Scope
The Smart Hospital Resource Allocation System proves that multi-resource medical scheduling can be resolved in $O(N \log N)$ time with complete all-or-nothing atomicity. Future extensions will incorporate nurse-to-patient ratios, doctor shift scheduling, and dynamic bed-tier upgrades.

---

## 8. References
1. Cormen, T. H., Leiserson, C. E., Rivest, R. L., & Stein, C. (2009). *Introduction to Algorithms* (3rd ed.). MIT Press. (Priority queues, Heaps, and Greedy Algorithms).
2. Kleinberg, J., & Tardos, É. (2006). *Algorithm Design*. Pearson. (Multi-dimensional matching and NP-completeness).
3. Python Software Foundation. (2024). *Python 3.10 Standard Library Reference: Data Structures and collections.deque*.
