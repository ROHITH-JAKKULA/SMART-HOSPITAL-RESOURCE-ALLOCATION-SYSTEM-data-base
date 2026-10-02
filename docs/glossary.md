# Algorithmic and Medical Triage Glossary

- **Binary Max-Heap:** A complete binary tree stored as an array where every parent node has a key greater than or equal to its children.
- **Sift-Up (Bubble-Up):** The $O(\log N)$ operation that restores the heap property by moving a newly inserted leaf toward the root.
- **Sift-Down (Heapify):** The $O(\log N)$ operation that restores the heap property by moving a displaced root element down to its correct position.
- **Floyd's Heapify:** The bottom-up $O(N)$ algorithm for constructing a valid binary heap from an unsorted array.
- **Greedy-Choice Property:** A property of optimization problems stating that a globally optimal solution can be reached by making locally optimal choices at each step.
- **Atomic (All-or-Nothing) Allocation:** A concurrency and resource constraint requiring all interdependent resources (Bed + Doctor + Equipment) to be committed simultaneously or none at all.
- **Dynamic Aging:** The technique of incrementing a patient's priority key as waiting time elapses to prevent indefinite starvation of lower-urgency patients.
- **Priority Inversion (Bypassing):** A condition where a lower-priority patient receives resources while a higher-priority patient remains unserved because they require different bottlenecked resources.
- **Bottleneck Pressure:** The ratio of active patient demand to total hospital supply ($\text{Demand} / \text{Supply}$).
- **Marginal Benefit:** The incremental clinical outcome ($\Delta \text{Allocated}$, $\Delta \text{Priority Score}$) gained by adding one additional unit of a resource.
- **DomainError:** An application-specific exception carrying user-friendly diagnostic information.
- **CSV Formula Injection:** A vulnerability where spreadsheet software executes command macros embedded in untrusted cell text starting with `=`, `+`, `-`, or `@`.
