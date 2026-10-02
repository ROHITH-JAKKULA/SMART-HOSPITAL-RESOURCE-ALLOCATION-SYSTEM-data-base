# Hackathon Demo Script (3–5 Minutes)

## Pre-Demo Checklist
1. App is open with golden scenario preloaded (Clock at T+120).
2. Terminal window is open in background as fallback with `python cli.py run --dataset golden --trace`.
3. Screen layout is clean; full-screen browser mode enabled.

---

## Timed Demo Sequence

### Minute 0:00 – 0:45 | Introduction & Problem Overview
- **Action:** Open Dashboard. Point out the six-question strip across the top.
- **Say This:**
  *"Good morning. We are presenting the Smart Hospital Resource Allocation System. In emergency care, patients arrive with critical needs, but beds, specialists, and equipment are severely limited. Traditional FIFO allocation fails because arrival time has no correlation with clinical urgency. Notice our dashboard's six-question strip: in under ten seconds, faculty can see who needs help, what resources exist, who was allocated, and how the algorithm decided."*

### Minute 0:45 – 1:30 | The DAA Engine: MaxHeap & Dynamic Priority
- **Action:** Navigate to **Algorithm** page. Show the SVG binary heap tree and array table.
- **Say This:**
  *"Here is the algorithmic core. We implemented a hand-written binary MaxHeap. Patients are keyed by a three-element tuple: priority score, medical severity, and negative arrival sequence. This ensures total deterministic ordering without ever comparing Patient objects directly. Notice the priority formula: severity is weighted at 40, waiting level at 20, risk at 15, urgency at 15, and ICU at 10. The waiting level provides dynamic aging, preventing low-severity patients from starving."*

### Minute 1:30 – 2:30 | Execution Trace & All-or-Nothing Atomicity
- **Action:** Click **Run Allocation ▶**. Show the step-by-step trace table. Highlight Step 4 (P04).
- **Say This:**
  *"Let's run the algorithm on our verified Golden Dataset. Patients P01, P03, and P02 are extracted and allocated. Now look closely at Step 4 for patient P04. General Bed 02 is free, but the hospital's single Physician is busy treating P02. Notice our atomicity guarantee: instead of locking Bed 02, our read-only diagnostic phase marks Bed 02 as 'candidate not committed'. Bed 02 stays free for other patients, and P04 is cleanly marked WAITING with Physician identified as the blocker."*

### Minute 2:30 – 3:30 | Strategy Comparison: Baseline vs Indexed
- **Action:** Click **Compare Baseline vs Indexed**. Point to the identical statuses and unit-check counters.
- **Say This:**
  *"To prove our algorithmic optimization, we implemented both the baseline $O(N \cdot B \cdot D \cdot E)$ triple loop and an indexed $O(1)$ matcher. Both produce identical allocation statuses, but our indexed version cuts unit checks down from thousands to just 10 on this dataset, and delivers a 49x speedup on 100 patients."*

### Minute 3:30 – 4:30 | Explainability, Bottlenecks & Resource Advisor
- **Action:** Navigate to **Simulation** page. Show the Bottleneck Table and click **Run Resource Advisor**.
- **Say This:**
  *"Our Resource Advisor runs a marginal-benefit simulation across all 12 resource types in $O(T \cdot N \log N)$ time. Notice the result: adding an ICU bed or Cardiologist produces zero benefit because they are not bottlenecked. Adding 1 Physician is ranked #1, delivering +1 allocated patient and +165 priority score. If we test this What-If scenario with one click, P04 is immediately allocated."*

### Minute 4:30 – 5:00 | Conclusion & Q&A Transition
- **Action:** Navigate to **About** page. Show DAA Concept Map and Academic Disclaimer.
- **Say This:**
  *"In conclusion, our project demonstrates verified DAA concepts: a custom MaxHeap, atomic greedy matching, dynamic aging, and real-time bottleneck analysis—all backed by 41 passing unit tests and complete mathematical transparency. We are ready for your questions."*

---

## Faculty Fallback Drill
If browser or projector issues occur:
1. Switch to terminal: run `python cli.py run --dataset golden --strategy indexed --trace`.
2. Point to the four steps outputting in exact order: P01, P03, P02, P04.
3. Show `python3 run_tests.py` passing 41/41 unit tests.
