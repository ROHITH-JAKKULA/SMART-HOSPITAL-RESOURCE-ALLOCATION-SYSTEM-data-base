# Theoretical and Empirical Complexity Analysis

## 1. Step-by-Step Complexity Breakdown
Notation:
- $N$: Number of eligible patients in the pool
- $B$: Number of hospital beds
- $D$: Number of hospital doctors
- $E$: Number of equipment units
- $T$: Number of resource types ($T = 12$, constant)
- $W$: Number of unserved waiting patients ($W \le N$)

| Pipeline Step | Time Complexity | Auxiliary Space | Theoretical Justification |
|---|---|---|---|
| **Priority Calculation** | $O(1)$ per patient $\implies O(N)$ | $O(1)$ | Fixed arithmetic on 5 weighted variables |
| **Heap Build (Insertion)** | $O(N \log N)$ | $O(N)$ | $N$ sequential calls to `_sift_up(i)` |
| **Heap Build (Floyd)** | $O(N)$ | $O(N)$ | Bottom-up heapify; nodes near bottom sift down tiny heights |
| **Heap Extraction (All)** | $O(N \log N)$ | $O(1)$ | $N$ extractions, each requiring $O(\log N)$ `_sift_down(0)` |
| **Matching (Baseline A)** | $O(B \cdot D \cdot E)$ per patient $\implies O(N \cdot B \cdot D \cdot E)$ | $O(1)$ | Exhaustive nested loops over all beds $\times$ doctors $\times$ equipment |
| **Matching (Scans B)** | $O(B + D + E)$ per patient $\implies O(N(B + D + E))$ | $O(1)$ | Independent linear passes over beds, doctors, and equipment |
| **Matching (Indexed C)** | $O(1)$ per patient $\implies O(N)$ | $O(B + D + E)$ | $O(1)$ peek at front of type-indexed double-ended queues |
| **Commit / Release** | $O(1)$ | $O(1)$ | Constant number of pointer updates ($\le 3$ units) |
| **Diagnosis of Blockers** | $O(B + D + E)$ | $O(1)$ | Triggered only upon incomplete candidate check to gather holder IDs |
| **Bypass Count Calculation**| $O(N)$ | $O(1)$ | Single pass over execution trace tracking `unserved_so_far` |
| **Explain One Patient** | $O(B + D + E)$ | $O(1)$ | Inspects inventory and holders of missing types |
| **Bottleneck Table** | $O(N + B + D + E)$ | $O(T) = O(1)$ | Single pass aggregating demand vs supply for 12 types |
| **Resource Advisor** | $O(T \cdot N \log N)$ | $O(N + B + D + E)$ | $T=12$ independent clone-and-run simulation trials |
| **Weight Lab Re-Score** | $O(N \log N)$ | $O(N)$ | Recalculate $N$ scores and sort to display rank changes |
| **Discrete Sim (F31)** | $O(N \cdot W \log W)$ | $O(N)$ | Event heap with $2N$ events; passes over waiting queue |

---

## 2. Overall Time and Space Complexity

### Worst-Case Time Totals
- **Baseline Strategy:**
  $$\mathcal{T}_{\text{baseline}} = O(N \log N + N \cdot B \cdot D \cdot E)$$
  *(Never say $O(N \log N)$ alone for the baseline—that omits the exhaustive resource search).*
- **Linear Scans Strategy:**
  $$\mathcal{T}_{\text{scans}} = O(N \log N + N(B + D + E))$$
- **Indexed Strategy (Our Primary Engine):**
  $$\mathcal{T}_{\text{indexed}} = O(N \log N) \quad \text{after a one-time } O(B + D + E) \text{ index build}$$

### Best-Case Time (Baseline)
When compatible free units are found on the very first loop iteration for every patient:
$$\mathcal{T}_{\text{best}} = O(N \log N)$$

### Auxiliary Space Complexity
$$\mathcal{S} = O(N + B + D + E)$$
- The array-based MaxHeap requires $O(N)$ space.
- The hospital inventory requires $O(B + D + E)$ space.
- Trace history requires $O(N)$ space (or $O(N^2)$ if heap snapshots are recorded, which is capped at $N \le 50$).

---

## 3. Empirical Benchmark Measurements
Empirical benchmark executed on standard hardware using `cli.py benchmark` (unmodified real measurements):

| $N$ (Patients) | Baseline Strategy ($O(N \cdot B \cdot D \cdot E)$) | Indexed Strategy ($O(N \log N)$) | Measured Speedup | Baseline Unit Checks | Indexed Unit Checks |
|---|---|---|---|---|---|
| **20** | 2.30 ms | 1.51 ms | **1.5x** | 2,521 | 59 |
| **50** | 21.44 ms | 3.24 ms | **6.6x** | 88,030 | 142 |
| **100** | 310.52 ms | 6.34 ms | **49.0x** | 1,387,806 | 274 |

### Observations
1. At $N = 100$, baseline unit checks explode to **1,387,806**, whereas indexed unit checks remain linear at **274** (less than 3 checks per patient).
2. The empirical speedup reaches **49.0x** at $N=100$, confirming the theoretical transition from polynomial resource-dependent complexity to quasi-linear heap-governed complexity.

---

## 4. Model Viva Answer (Verbatim)
> *"Our algorithm uses a priority queue implemented as a max-heap, which costs $O(N \log N)$ for inserting and extracting $N$ patients. For each patient, the baseline greedy matcher may scan $B$ beds, $D$ doctors, and $E$ equipment units in nested loops, which is $O(B \cdot D \cdot E)$ per patient, giving an overall worst-case time of $O(N \log N + N \cdot B \cdot D \cdot E)$.*
>
> *Because bed, doctor, and equipment constraints are independent, we also implemented an indexed version using type-based queues that finds a candidate unit in $O(1)$, reducing allocation time to $O(N \log N)$. Space complexity is $O(N + B + D + E)$."*
