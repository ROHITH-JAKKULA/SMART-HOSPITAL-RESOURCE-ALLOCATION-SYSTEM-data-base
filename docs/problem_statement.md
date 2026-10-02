# Problem Statement: Smart Hospital Resource Allocation System

## 1. Context and Motivation
Modern healthcare facilities operate under critical constraints. Emergency departments and intensive care units frequently encounter surges where the demand for specialized facilities exceeds available inventory. 

A hospital has limited:
- **Beds:** ICU beds, Emergency beds, General beds.
- **Doctors:** Cardiologists, Neurologists, Physicians, Surgeons.
- **Equipment:** Ventilators, ECG monitors, Multipara Monitors, MRI scanners, X-Ray units.

When patients arrive with varying medical acute conditions, allocating resources purely on a First-Come, First-Served (FCFS) basis leads to tragic clinical outcomes—critical cardiac or respiratory patients may wait while non-urgent general patients hold critical resources. Conversely, purely naive greedy heuristics risk starving lower-priority patients indefinitely.

## 2. Formal DAA Problem Definition
Given:
1. A set of hospital resources $R = \{B, D, E\}$ partitioned into discrete types:
   - Beds $B = \bigcup B_i$ where $B_i$ are beds of type $t \in \{\text{ICU}, \text{EMERGENCY}, \text{GENERAL}\}$
   - Doctors $D = \bigcup D_j$ where $D_j$ are doctors of specialization $s \in \{\text{Cardiologist}, \text{Neurologist}, \text{Physician}, \text{Surgeon}\}$
   - Equipment $E = \bigcup E_k$ where $E_k$ are machines of type $e \in \{\text{Ventilator}, \text{ECG}, \text{Monitor}, \text{MRI}, \text{X-Ray}\}$
2. A sequence of patients $P = \{p_1, p_2, \dots, p_N\}$ where each patient requires a triple tuple:
   $$(req\_bed_i, req\_doc_i, req\_eq_i)$$

Objective:
Allocate resources to patients such that:
1. **Priority Maximization:** Patients with acute medical urgency are allocated before lower-priority patients.
2. **Atomicity (All-or-Nothing):** A patient is allocated if and only if **all three** required resources (Bed + Doctor + Equipment) are simultaneously available. No partial allocation is ever allowed (e.g., an ICU bed and doctor cannot be held by a patient if the required Ventilator is unavailable).
3. **Starvation Mitigation:** Waiting patients accumulate aging bonuses over time so that long-waiting patients eventually receive high priority.
4. **Algorithmic Efficiency:** The matching procedure must run in $O(N \log N)$ time rather than exhaustive combinatorial search.

## 3. Assumptions and Scope (v1)
- Each patient requires exactly one bed type, exactly one doctor specialty, and at most one equipment type (or None).
- Strict type matching is enforced (no substitution or bed upgrades in v1 baseline).
- Preemption is not allowed (once assigned, a patient holds resources until discharge).
- Academic simulation model: priority weights encode explicit heuristic criteria and are not a substitute for clinical protocols.
