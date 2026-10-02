# Test Cases and Verification Report (T01 – T40)

All tests are verified through Python unittest (`python3 run_tests.py`). Real execution output is documented below.

| Test ID | Objective | Input Configuration | Expected Outcome | Actual Verification | Status |
|---|---|---|---|---|---|
| **T01** | Basic Matching | 1 Patient, 1 General Bed, 1 Physician | Status ALLOCATED; Bed `BED-GEN-01`, Doctor `DOC-PHYS-01` | Exact IDs assigned; units marked busy | **PASS** |
| **T02a** | Resource Busy | 1 ICU Patient, ICU Bed is busy | Status WAITING; reason code `BED_BUSY` | Correct reason code and text generated | **PASS** |
| **T02b** | Zero Inventory | 1 ICU Patient, 0 ICU Beds in hospital | Status UNAVAILABLE; code `NO_BED_IN_INVENTORY` | Differentiates from normal waiting | **PASS** |
| **T03** | Priority Allocation | 2 Patients, 1 Physician | Higher-priority patient gets doctor; lower waits | High priority allocated; low priority waits | **PASS** |
| **T04** | Equipment Contention | 2 Patients, 1 Ventilator | Higher-priority ventilator patient gets machine | Highest score extracted and committed | **PASS** |
| **T05** | Empty Patients | 0 Patients in pool | Return result with 0 counts; no runtime crash | Metrics reflect 0s; trace empty | **PASS** |
| **T06** | Missing Equipment | 1 Patient needing ECG, 1 needing None (0 ECGs) | ECG patient UNAVAILABLE; None patient ALLOCATED | Equipment-independent patient serviced | **PASS** |
| **T07** | Duplicate ID | Add patient with existing ID `p01` | Case-insensitive rejection with `DomainError` | Raises `DomainError`; list length unchanged | **PASS** |
| **T08** | Unit Ordering | 3 Physicians (`DOC-PHYS-02`, `01`, `03`) | Lowest ID (`DOC-PHYS-01`) assigned | Deterministically assigns lowest ID unit | **PASS** |
| **T09** | Golden +1 Physician | Golden Dataset with +1 Physician | 4/4 Allocated, 0 Waiting, Weighted Score 1235 | 4 Allocated, Score 1235, 76.9% Utilisation | **PASS** |
| **T10** | Golden -1 Ventilator | Golden Dataset with 0 Ventilators | P01 UNAVAILABLE; 2 Allocated, 1 Waiting, Score 630 | Score 630, Bypass Count 2, P01 UNAVAILABLE | **PASS** |
| **T11** | Atomicity | Ventilator busy for ICU patient | Candidate bed & doctor NOT marked busy | Units remain available; patient WAITING | **PASS** |
| **T12** | Tie-Breaking | Equal priority scores (270 vs 270) | Higher severity extracted first; deterministic | Higher severity patient extracted first | **PASS** |
| **T13** | MaxHeap Correctness | Random sequence insertion into MaxHeap | Extractions match `sorted(reverse=True)` | Extracted keys strictly descending | **PASS** |
| **T14** | Invariant: No Double Alloc | 30 Patients, random resource demands | Each unit assigned to $\le 1$ patient; all requirements met | Set length equals list length for all kinds | **PASS** |
| **T15** | Discharge & Re-run | Discharge P02 (Physician held) | P04 re-evaluated and allocated to freed doctor | P04 transitions from WAITING to ALLOCATED | **PASS** |
| **T16** | Priority Formula | Golden patients P01, P03, P02, P04 | Scores: 440, 390, 240, 165; Bounds 90 to 460 | Calculated priorities match golden table | **PASS** |
| **T17** | Strategy Equivalence | Random scenario on Baseline vs Indexed | Identical patient allocation statuses | Statuses match 100% across both runs | **PASS** |
| **T18** | Validation Checks | Invalid age, empty name, ICU bed mismatch | Specific diagnostic errors returned | `ok=False` and descriptive error message | **PASS** |
| **T20** | Report Generation | Export 5 CSV reports on Golden run | CSV headers and rows populated correctly | All headers match contract specifications | **PASS** |
| **T21** | Dynamic Aging | Advance clock by +15 min | P04 score: 165 $\rightarrow$ 185; P03: 390 $\rightarrow$ 410 | Scores strictly increase with wait time | **PASS** |
| **T22** | Counterexample Check | 0 ECG vs 1 ECG with 3 interdependent patients | 2 allocated with 0 ECG; 1 allocated with 1 ECG | Proves greedy-by-priority $\ne$ max throughput | **PASS** |
| **T23** | What-If Purity | Run Advisor and What-If routines | Live hospital inventory and patients untouched | Pre and post inventories identical | **PASS** |
| **T24** | Golden Trace Verification | Full run on Golden Dataset | Sequence: P01, P03, P02, P04; Free beds: EMG, GEN-02 | Free units: `BED-EMG-01`, `BED-GEN-02` | **PASS** |
| **T25** | Run Determinism | Execute same scenario twice | Bit-for-bit identical trace and step results | Exact match across every trace field | **PASS** |
| **T26** | Explain P04 | Request explanation for waiting P04 | Rank 4, blocked by Physician held by P02 | Names P02 and suggests unblocking steps | **PASS** |
| **T27** | Advisor on Golden | Run marginal-benefit advisor | +1 Physician is #1 recommendation (+165 score) | Physician ranked top; others "no change" | **PASS** |
| **T28** | Bottleneck Analysis | Compute demand vs supply on Golden | Physician pressure 2.0, shortage 1 | Physician identified as sole bottleneck | **PASS** |
| **T29** | Bypass Count | Golden vs Scenario B | Golden bypass = 0; Scenario B bypass = 2 | Correctly counts priority inversions | **PASS** |
| **T30** | JSON Round-Trip | Export allocator to JSON and reload | Lossless recreation; rejects invalid versions | Exact match on clock, counts, weights | **PASS** |
| **T31** | Seeded Generator | Generate patients with seed=42 | Deterministic reproduction; valid fields | Exact match between runs with same seed | **PASS** |
| **T32** | Event Audit Log | Complete allocation cycle | Detailed audit trail with clocks and kinds | Records all state changes sequentially | **PASS** |
| **T33** | Undo Stack | Run allocation then invoke `undo()` | Reverts hospital inventory and patient states | Exact pre-run state restored | **PASS** |
| **T34** | Weight Lab | Adjust scoring weights | Recomputed scores reflect custom weights | Default 440 updates according to formula | **PASS** |
| **T35** | CSV Injection Hardening | Name starting with `=1+1` or `+cmd` | Prepends `'` to neutralize formula execution | Exported cell: `'=1+1` | **PASS** |
| **T36** | Op Counter Accuracy | Golden run operation counts | Indexed checks = 10; Baseline checks $\ge 10$ | Indexed checks confirmed as 10 | **PASS** |
| **T38** | Upload Security | Malformed patient dictionaries | Graceful rejection without system crash | Errors collected and presented safely | **PASS** |
| **T39** | Discrete Event Sim | Time-stepped hospital-day simulation | Average wait = 51.25 min, Max wait = 75 min | Verified against manual trace calculations | **PASS** |
| **T40** | Exhaustive vs Greedy | Compare greedy choice to subset enumeration | Greedy allocates 1, maximum subset is 2 | Direct counterexample validation | **PASS** |
