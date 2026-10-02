# DAA Comprehensive Viva Preparation Guide (50+ Q&As)

## Category 1: Foundational DAA Concepts
### Q1. Why use a Priority Queue instead of a simple FIFO Queue (FCFS)?
**Answer:** In an emergency healthcare environment, patients have drastically different medical urgencies. A simple FIFO queue serves patients strictly in arrival order, causing critical cardiac or respiratory patients to wait behind non-urgent general patients. A priority queue ensures that patients with the highest clinical acuity and waiting time are always serviced first.
> **Say this:** *"FIFO treats all patients as clinically equal, which leads to unacceptable outcomes during surges; a priority queue dynamically orders patients by medical urgency."*

### Q2. Why did you implement your own Max-Heap instead of using Python's `heapq`?
**Answer:** Python's built-in `heapq` module is a min-heap that requires key negation tricks, and library abstractions obscure the underlying algorithmic operations during academic evaluation. Building our own binary MaxHeap allows us to explicitly demonstrate `_sift_up`, `_sift_down`, and Floyd's $O(N)$ heapify, while hooking in operation counters for comparisons.
> **Say this:** *"A custom MaxHeap demonstrates mastery of sift operations and Floyd's heapify without hiding algorithmic mechanics behind C-level library wrappers."*

### Q3. Why is this problem suited for a Greedy Algorithm?
**Answer:** At each step, the algorithm makes the locally optimal choice—allocating available resources to the patient with the highest priority score currently extracted from the heap. Because patient acuity is time-sensitive, making an immediate commitment to the highest-priority patient without backtracking provides an effective and predictable heuristic.
> **Say this:** *"The greedy choice property lets us commit resources to the most urgent patient immediately without combinatorial backtracking."*

### Q4. What is the time complexity of the complete allocation pipeline?
**Answer:** The baseline greedy matcher scans beds ($B$), doctors ($D$), and equipment ($E$), resulting in $O(N \log N + N \cdot B \cdot D \cdot E)$. However, our optimized indexed strategy uses double-ended queues for each resource type, reducing candidate retrieval to $O(1)$ and total allocation time to $O(N \log N)$.
> **Say this:** *"The indexed algorithm runs in $O(N \log N)$ time, dominated by the priority queue extractions, compared to the $O(N \cdot B \cdot D \cdot E)$ baseline."*

### Q5. What is the auxiliary space complexity?
**Answer:** The space complexity is $O(N + B + D + E)$. The MaxHeap requires $O(N)$ space to store patient keys, and the hospital inventory requires $O(B + D + E)$ space to hold bed, doctor, and equipment references and index queues.
> **Say this:** *"Space complexity is linear in terms of patient count and total hospital resources: $O(N + B + D + E)$."*

### Q6. What happens when a required resource is completely unavailable?
**Answer:** The system classifies the patient's state as either `WAITING` (if units exist in the hospital but all are currently busy) or `UNAVAILABLE` (if the total inventory of that required type is zero). In both cases, the two-phase allocator commits nothing and moves to the next patient.
> **Say this:** *"We distinguish temporary resource conflict (`WAITING`) from structural deficit (`UNAVAILABLE`) while maintaining strict all-or-nothing atomicity."*

### Q7. How does the priority formula prevent starvation of lower-severity patients?
**Answer:** The priority formula incorporates dynamic aging through the waiting level term ($20 \cdot W$). As an unserved patient waits, $T_{\text{clock}} - T_{\text{arrival}}$ increases, raising $W$ from 1 up to 5 (a +80 point boost), allowing prolonged waits to eventually overtake newly arrived moderate-severity patients.
> **Say this:** *"Dynamic aging increases priority monotonically with waiting time, guaranteeing that low-severity patients are not starved indefinitely."*

### Q8. What constraints must be satisfied for a valid allocation?
**Answer:** Three simultaneous constraints: (1) an available bed matching the patient's required bed type, (2) an available doctor matching the required specialty, and (3) an available equipment unit matching the required equipment (if not 'None'). All three must be free in the same step.
> **Say this:** *"A triple constraint: bed type compatibility, doctor specialty compatibility, and equipment type compatibility must all be satisfied simultaneously."*

### Q9. How do you prevent double-allocation of the same physical bed or doctor?
**Answer:** We maintain an atomic commit phase. When candidate units are selected, their `available` flags are immediately set to `False`, their assigned patient ID is recorded, and they are dequeued from the hospital's free index in $O(1)$.
> **Say this:** *"Units are dequeued from the free index during the atomic commit, making them inaccessible to subsequent extraction steps."*

### Q10. What is resource compatibility in your model?
**Answer:** Resource compatibility is governed by configuration dictionaries (`BED_COMPATIBILITY`, `DOCTOR_COMPATIBILITY`, `EQUIPMENT_COMPATIBILITY`). In v1, strict equality matching is enforced, but the mapping structure allows future bed upgrades (e.g., General patients in ICU beds) with a single configuration edit.

---

## Category 2: Heap Internals & Data Structures
### Q11. How is the binary heap represented in memory?
**Answer:** It is represented as a contiguous 0-indexed array/list. For any node at index $i$, its parent is at $\lfloor (i - 1) / 2 \rfloor$, its left child is at $2i + 1$, and its right child is at $2i + 2$.
> **Say this:** *"We use an array-based implicit binary tree, avoiding node pointer overhead and maximizing cache locality."*

### Q12. Why do `_sift_up` and `_sift_down` take $O(\log N)$ time?
**Answer:** A binary heap of size $N$ has a height of $\lfloor \log_2 N \rfloor$. Sift-up traverses a single path from a leaf to the root, and sift-down traverses from the root to a leaf, bounding comparisons and swaps by the tree height.

### Q13. Why does Floyd's `build_heap` run in $O(N)$ while repeated insertions take $O(N \log N)$?
**Answer:** Repeated insertion sifts every newly added element up from the bottom, where most nodes reside. Floyd's algorithm processes nodes bottom-up from $\lfloor N/2 \rfloor - 1$ down to 0; the majority of nodes are near the leaves and sift down at most 0 or 1 levels. Summing $\sum_{h=0}^{\log N} \frac{N}{2^{h+1}} \cdot h$ mathematically converges to $O(N)$.
> **Say this:** *"In Floyd's algorithm, the majority of nodes are near the leaves and perform at most 1 or 2 sifts, bounding the summation to $O(N)$."*

### Q14. Why are heap keys structured as tuples: `(priority, severity, -arrival_seq)`?
**Answer:** Python evaluates tuples lexicographically from left to right. This guarantees total ordering: equal priority is broken by higher severity, and equal severity is broken by earlier arrival ($-\text{arrival\_seq}$). Most importantly, Patient objects are never compared, eliminating `TypeError` exceptions.
> **Say this:** *"Tuples enforce strict tie-breaking without ever requiring object comparison methods on the Patient dataclass."*

### Q15. What is the difference between extracting from a MaxHeap and sorting the entire patient list?
**Answer:** Sorting the entire list costs $O(N \log N)$ upfront and requires all elements to be known beforehand. A MaxHeap allows streaming arrivals where new patients can be inserted dynamically in $O(\log N)$ without re-sorting the whole collection.

---

## Category 3: Greedy Theory & Optimization
### Q16. Does the greedy-by-priority algorithm maximize the total number of patients treated?
**Answer:** No. Greedy-by-priority maximizes the priority order of served patients, not total throughput. If an urgent patient requires multiple scarce resources, serving them may prevent two or three slightly lower-priority patients from being treated.
> **Say this:** *"No, greedy-by-priority optimizes clinical urgency, not throughput. Maximizing throughput would be a multi-dimensional knapsack problem."*

### Q17. Can adding more resources ever result in fewer patients being allocated?
**Answer:** Yes! In our proven counterexample (§7.13, T22), adding 1 ECG machine allowed a high-priority patient requiring a General Bed, Physician, and ECG to be allocated. This blocked two lower-priority patients who previously shared that General Bed and Physician, reducing total allocations from 2 to 1.
> **Say this:** *"Yes, because a high-priority patient newly enabled by an additional resource can consume shared resources that previously satisfied multiple lower-priority patients."*

### Q18. Why not use Integer Linear Programming (ILP) or Bipartite Matching?
**Answer:** Each patient requires a triple of heterogeneous resources (Bed, Doctor, Equipment), making this a 3-Dimensional Matching problem, which is NP-complete. While ILP solvers can find exact global optima, they require exponential worst-case time, making them unfeasible for real-time triage during hospital surges.
> **Say this:** *"Simultaneous 3-resource matching is an NP-complete 3D matching problem; a greedy heuristic provides fast, predictable, and explainable $O(N \log N)$ execution."*

### Q19. What is the Greedy Choice Property in your system?
**Answer:** The greedy choice is that at each decision step, the patient with the highest computed priority score currently in the MaxHeap is evaluated. If their required resources are available, they are committed immediately without considering future arrivals or looking ahead.

### Q20. What is optimal substructure in this context?
**Answer:** Optimal substructure would imply that the optimal allocation for $N$ patients contains within it the optimal allocation for $N-1$ patients. Because multi-resource constraints couple patients together, optimal throughput does not exhibit pure greedy substructure, which is why greedy is a heuristic rather than an exact throughput optimizer.

---

## Category 4: Algorithmic Complexity & Profiling
### Q21. Why is the baseline matcher $O(B \cdot D \cdot E)$ wasteful?
**Answer:** Bed, doctor, and equipment constraints are independent. The availability of a Cardiologist does not depend on which General Bed is free. Nesting the loops creates $B \times D \times E$ iterations when checking each resource category independently requires only $B + D + E$ checks.
> **Say this:** *"The nested loops are wasteful because resource constraints are independent orthogonal checks, not coupled combinations."*

### Q22. How did you reduce matching from $O(B \cdot D \cdot E)$ to $O(1)$?
**Answer:** In `Hospital`, we created an index mapping `(kind, type) -> deque` of available units in ID order. When checking a patient, we simply inspect the front of the corresponding deque (`dq[0]`) in $O(1)$ time, yielding constant-time candidate checking.
> **Say this:** *"By indexing available units into discrete type-queues, candidate availability is verified in $O(1)$ at the front of each deque."*

### Q23. What did your empirical benchmark show?
**Answer:** Benchmarking from $N=20$ to $N=100$ demonstrated that baseline unit checks exploded from 2,521 to 1,387,806, whereas indexed unit checks grew strictly linearly from 59 to 274. At $N=100$, the indexed implementation was 49.0x faster.

### Q24. What is the time complexity of the Resource Advisor?
**Answer:** The Resource Advisor tests the marginal benefit of adding +1 unit for all $T = 12$ resource types. For each type, it clones the hospital, adds the unit, and executes the indexed allocator in $O(N \log N)$. Therefore, the total advisor cost is $O(T \cdot N \log N)$, which is quasi-linear since $T=12$ is constant.

### Q25. Could you use Counting Sort or Bucket Sort to beat $O(N \log N)$?
**Answer:** Yes! Because priority scores are bounded integers between 90 and 460 (a range of 371 distinct values), Counting Sort could order $N$ patients in $O(N + 371) = O(N)$ time. However, a MaxHeap is preferred in production because it supports online streaming arrivals in $O(\log N)$ without re-sorting the array.

---

## Category 5: Design Patterns & Robustness
### Q26. Why do you rebuild the heap on every re-run instead of maintaining a persistent heap?
**Answer:** When the simulation clock advances, every waiting patient's waiting time changes, which alters their waiting level and priority score. Changing keys inside a heap invalidates the heap invariant; restoring it for $W$ patients takes $O(W \log W)$, which is asymptotically identical to rebuilding.
> **Say this:** *"Because dynamic aging alters the priority keys of all waiting patients simultaneously, rebuilding the heap is cleaner and has the exact same $O(W \log W)$ complexity."*

### Q27. What is the difference between WAITING and UNAVAILABLE?
**Answer:** `WAITING` means the required resources exist in the hospital's inventory but all units are currently occupied by other patients. `UNAVAILABLE` means the hospital inventory has zero units of that type, meaning the patient cannot be served regardless of waiting time until management procures new equipment or beds.
> **Say this:** *"`WAITING` is temporary congestion; `UNAVAILABLE` is a permanent inventory deficit."*

### Q28. How does the system ensure atomicity (all-or-nothing allocation)?
**Answer:** Allocation is split into two phases: `find_plan` is purely read-only and gathers candidate pointers. `commit_plan` is called only if the plan is completely satisfied. If even one resource is missing, nothing is committed, and candidate units remain available for subsequent extractions.
> **Say this:** *"Two-phase execution: candidate checking is strictly read-only; units are marked busy only when all required resources are simultaneously confirmed."*

### Q29. What is "bypassing" and how is it measured?
**Answer:** Bypassing occurs when a lower-priority patient is allocated resources while a higher-priority patient is still waiting (because the higher-priority patient is blocked by a different resource). We compute the bypass count in $O(N)$ during trace logging by tracking unserved patients ahead of each allocation.
> **Say this:** *"Bypassing measures priority inversions where a lower-priority patient receives free resources while a higher-priority patient remains blocked."*

### Q30. How does the Undo feature work without corrupting state?
**Answer:** Before every state-altering operation (`run_allocation`, `discharge`, `apply_inventory`), a deep copy snapshot of the hospital inventory, patient records, clock, and weights is pushed onto an undo stack (depth 10). Invoking `undo()` restores the snapshot in $O(N + B + D + E)$.

---

## Category 6: Explainability, Bottlenecks & Simulation
### Q31. How does the "Why is this patient waiting?" panel work?
**Answer:** The explainability engine inspects the unserved patient's missing requirements, identifies the total and free counts for each type, queries which patient IDs currently occupy those units, and generates actionable remedies (e.g., "Discharge P02 or add 1 Physician").

### Q32. What is the Bottleneck Pressure metric?
**Answer:** For each resource type, Pressure is defined as $\text{Demand} / \text{Supply}$, where Demand is the number of active patients requiring that type and Supply is the total inventory. A type with Supply = 0 and Demand > 0 has infinite ($\infty$) pressure. The highest pressure indicates the primary hospital bottleneck.

### Q33. How does the Resource Advisor evaluate marginal benefit?
**Answer:** It simulates adding +1 unit to each of the 12 resource types on an isolated clone of the hospital. It measures $\Delta \text{Allocated}$ and $\Delta \text{Priority-Weighted Score}$, ranking recommendations so hospital administrators can identify which procurement produces the highest clinical impact.

### Q34. What is the purpose of the Weight Lab?
**Answer:** Priority weights (40, 20, 15, 15, 10) encode explicit value judgements. The Weight Lab allows evaluators to interactively adjust weights, instantly re-ranking patients to observe how changing policy priorities alters queue order and clinical trade-offs.

### Q35. How does the Time-Stepped Simulation (F31) incorporate a second heap?
**Answer:** It uses a MinHeap as an event queue where events are keyed by `(time, type_rank, seq)`. Discharges are given `type_rank = 0` and Arrivals `type_rank = 1`, ensuring freed units are immediately visible to arrivals at the same timestamp.

---

## Category 7: Software Engineering & Security
### Q36. How is the codebase protected against CSV Formula Injection?
**Answer:** In `utils/reports.py`, all exported text cells starting with formula trigger characters (`=`, `+`, `-`, `@`, `\t`, `\r`) are sanitized by prepending an apostrophe (`'`). This prevents spreadsheet software like Excel from executing arbitrary command payloads.

### Q37. Why use custom domain exceptions like `DomainError`?
**Answer:** Standard Python exceptions (`KeyError`, `IndexError`) crash applications and leak internal stack traces. `DomainError` carries human-readable diagnostic messages that the UI and CLI intercept gracefully to inform the user of constraint violations.

### Q38. How is upload security enforced?
**Answer:** File uploads are restricted to a maximum size of 2 MB and 5,000 rows. Uploaded CSVs and JSON files are schema-validated against strict regex patterns and range checks before touching the allocation engine.

### Q39. What test coverage standards does this project meet?
**Answer:** The project contains 41 unit tests covering T01 to T40, verifying scoring, MaxHeap operations, greedy atomicity, invariants, golden dataset metrics, and edge cases with continuous testing and line coverage reporting.

### Q40. Why are algorithm and model files isolated from Streamlit?
**Answer:** Decoupling business logic from presentation ensures the core algorithm can be executed in headless environments (like `cli.py`), tested independently with `unittest`/`pytest`, and integrated into any UI without refactoring.

---

## Category 8: Ethics, Clinical Scope & Traps
### Q41. Is this algorithm ready for deployment in a real emergency ward?
**Answer:** No. This is an academic simulation built for a DAA course. Real clinical triage requires certified protocols (such as the Emergency Severity Index or Manchester Triage System), physician oversight, continuous biometric telemetry, and regulatory HIPAA/GDPR compliance.
> **Say this:** *"No, this is strictly an academic algorithm simulation demonstrating data structures; clinical triage requires certified medical protocols and human physician oversight."*

### Q42. Trap Question: "Is your time complexity $O(N \log N)$?"
**Answer:** For our indexed strategy, yes, it is $O(N \log N)$. But for the baseline greedy strategy, claiming $O(N \log N)$ is incorrect because it ignores matching overhead—the baseline runs in $O(N \log N + N \cdot B \cdot D \cdot E)$.

### Q43. Trap Question: "Doesn't serving lower-priority patients violate the priority queue contract?"
**Answer:** No. The priority queue determines the *order of consideration*, not the feasibility of allocation. If the highest-priority patient cannot be served because their specific equipment is busy, leaving other available resources idle would be inefficient. Lower-priority patients are served only with resources the waiting patient does not need.

### Q44. Trap Question: "Why not just sort the patient list once?"
**Answer:** Sorting once works only for static batch input. In a real hospital, patients arrive continuously over time. A priority queue supports dynamic insertions in $O(\log N)$ without re-sorting the existing queue.

### Q45. Trap Question: "Isn't this just a CRUD app with a database?"
**Answer:** No. There is no database. All state is maintained in memory using custom fundamental data structures: a hand-written binary MaxHeap, double-ended lookup queues, dynamic priority scoring, and a multi-resource greedy constraint solver.

---

## Whiteboard Drills for Students
Students should be prepared to perform these five whiteboard exercises during viva examinations:
1. **Insert 5 numbers into a MaxHeap:** Draw the array representation and the corresponding binary tree after each insertion.
2. **Perform Extract-Max:** Show root removal, swapping with the last element, and the step-by-step `_sift_down` swaps.
3. **Derive Complexity:** Write out the derivation for Floyd's $O(N)$ heapify and the $O(N \log N + N \cdot B \cdot D \cdot E)$ baseline vs $O(N \log N)$ indexed.
4. **Trace the Golden Example:** Walk through patients P01, P03, P02, P04 by hand, demonstrating why P04 is blocked by Physician despite a General Bed being free.
5. **Construct the Counterexample:** Draw the 3-patient, 1-ECG example showing how adding an ECG machine reduces allocations from 2 to 1.

---

## Mock Viva Scoring Scheme
- **Round 1 (Basics):** Data structure choice, formula explanation, heap representation (Target: 10/10).
- **Round 2 (Implementation):** Sift operations, strategy A vs C, all-or-nothing atomicity (Target: 10/10).
- **Round 3 (Hard/Trap):** Counterexample, 3D matching NP-completeness, starvation vs bypassing, Floyd's proof (Target: 10/10).
