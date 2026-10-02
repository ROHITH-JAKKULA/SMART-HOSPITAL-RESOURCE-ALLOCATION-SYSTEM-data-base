# DAA Hackathon Presentation (7 Slides)

## Slide 1: Title & Team
- **Title:** Smart Hospital Resource Allocation System
- **Subtitle:** Priority Queue, Max Heap, and Atomic Greedy Multi-Resource Optimization
- **Team Roles:**
  - **Algorithms & Data Structures Lead:** Hand-written MaxHeap, Greedy Matcher, Complexity Analysis
  - **UI/UX & Visualization Lead:** Dashboard, Interactive Heap Tree, Charting System
  - **Systems & Architecture Lead:** Hospital Inventory Indexing, Discrete Sim, Validation Engine
  - **QA & Technical Documentation Lead:** Test Suite (T01–T40), CI Pipeline, Viva Prep
- **Speaker Notes (35s):**
  *"Good morning evaluators. Our project addresses a critical real-world problem: hospital resource saturation. During healthcare surges, limited beds, specialists, and medical devices must be allocated under strict priority and zero tolerance for partial assignments. We designed and implemented a complete algorithmic solution emphasizing priority queues, hand-written max-heaps, and all-or-nothing greedy matching."*

---

## Slide 2: Problem & Motivation
- **Clinical Reality:** Mismatched supply and demand in emergency wards.
- **Why FIFO / FCFS Fails:** Severe respiratory cases wait behind minor general ailments.
- **The Challenge:** Each patient requires a heterogeneous triple $(Bed, Doctor, Equipment)$ simultaneously.
- **Core Dilemma:** How to maximize clinical urgency without starvation, deadlock, or partial resource hoarding?
- **Speaker Notes (40s):**
  *"Traditional First-Come, First-Served scheduling fails in healthcare because arrival order has zero correlation with clinical urgency. However, allocating multiple interdependent resources is non-trivial—a patient cannot be partially assigned to an ICU bed if no ventilator exists. Our goal is to make these trade-offs transparent, deterministic, and algorithmically optimal."*

---

## Slide 3: The Algorithmic Solution
- **Dynamic Priority Scoring:** 5 weighted factors with monotonic aging to eliminate starvation.
- **Binary Max-Heap:** Hand-written, array-based priority queue with lexicographic tie-breaking keys.
- **Two-Phase Greedy Allocation:**
  1. *Read-Only Candidate Search:* Identifies availability and records missing blocker diagnostics.
  2. *Atomic Commit:* All required units are marked busy simultaneously; partial assignment is structurally impossible.
- **Speaker Notes (40s):**
  *"Our architecture operates in three stages: First, dynamic priority scoring combines severity, risk, and an aging term that monotonically elevates waiting patients. Second, patients enter our hand-written MaxHeap keyed by priority, severity, and arrival sequence. Third, a two-phase greedy allocator checks candidate feasibility in read-only mode and atomically commits all three resources in unison."*

---

## Slide 4: DAA Execution Trace (The Golden Dataset)
- **Step 1 (P01, Score 440):** Allocates ICU Bed 01, Cardiologist 01, Ventilator 01.
- **Step 2 (P03, Score 390):** Allocates ICU Bed 02, Neurologist 01, Monitor 01.
- **Step 3 (P02, Score 240):** Allocates General Bed 01, Physician 01.
- **Step 4 (P04, Score 165):** General Bed 02 is candidate (uncommitted); Physician is busy $\implies$ WAITING.
- **Atomicity Proof:** General Bed 02 remains free; no resource leak occurs!
- **Speaker Notes (40s):**
  *"On our hand-verified golden dataset, P01, P03, and P02 are sequentially allocated. When P04 is extracted, General Bed 02 is free, but the hospital's only Physician is busy with P02. Notice our atomicity guarantee: rather than locking Bed 02, the candidate is left free for future patients, and P04 is cleanly marked WAITING with the exact blocker diagnosed."*

---

## Slide 5: System Architecture & Optimization
- **Separation of Layers:** Algorithms $\leftrightarrow$ Orchestration $\leftrightarrow$ Presentation.
- **Baseline Strategy ($O(N \cdot B \cdot D \cdot E)$):** Exhaustive triple-nested search loop.
- **Indexed Strategy ($O(N \log N)$):** Double-ended queues for each resource type yield $O(1)$ candidate lookups.
- **Empirical Proof:** At $N=100$, unit checks drop from 1,387,806 to 274, delivering a **49x speedup**.
- **Speaker Notes (35s):**
  *"To optimize allocation, we recognized that bed, doctor, and equipment constraints are independent. By replacing nested loops with type-indexed queues, candidate retrieval drops from $O(B \cdot D \cdot E)$ to $O(1)$. In our live benchmarks, unit checks dropped from over 1.3 million to just 274 at $N=100$, confirming our theoretical $O(N \log N)$ bound."*

---

## Slide 6: Innovation, Explainability & Simulation
- **Explainability:** Instant answers to *'Why is this patient waiting?'* with specific unblocking actions.
- **Bottleneck Analysis:** Computes demand vs supply pressure for all 12 resource types.
- **Resource Advisor:** Simulates marginal benefits of $+1$ unit across all categories in $O(T \cdot N \log N)$.
- **Weight Lab:** Live sensitivity analysis revealing how policy weight shifts alter queue rankings.
- **Speaker Notes (40s):**
  *"Beyond raw allocation, our system features explainability tools. The 'Why?' panel pinpoints the exact patient holding a needed resource. Our Resource Advisor tests adding $+1$ unit across all 12 types, showing administrators that adding a Physician yields $+165$ score points while adding beds produces zero benefit because doctors are the true bottleneck."*

---

## Slide 7: Complexity, Honest Limits & Summary
- **Complexity:** Time $O(N \log N)$, Space $O(N + B + D + E)$.
- **Honest Limitation:** Greedy-by-priority maximizes urgency, not patient count (counterexample proven).
- **Quality Assurance:** 41 automated tests, 100% golden fidelity, CSV-injection defense, zero mock data.
- **Takeaway:** Clear algorithm, proven data structures, measurable speedup, and total transparency.
- **Speaker Notes (30s):**
  *"In conclusion, we deliver a verified DAA implementation running in $O(N \log N)$ time and $O(N + B + D + E)$ space. We openly demonstrate our counterexample proving that greedy heuristics trade throughput for clinical urgency. Thank you, and we welcome your questions!"*
