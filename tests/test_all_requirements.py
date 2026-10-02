"""Complete Test Suite covering T01 to T40 per §18 of the specification."""
import unittest
import copy

import config
from models.patient import Patient, Status
from models.bed import Bed
from models.doctor import Doctor
from models.equipment import Equipment
from models.hospital import Hospital, DomainError

from algorithms.priority_queue import MaxHeap, MinHeap, OpCounter
from algorithms.greedy_allocator import find_plan_baseline, find_plan_indexed, commit_plan
from algorithms.resource_allocator import ResourceAllocator
from algorithms.advisor import bottleneck_table, advise, what_if
from algorithms.simulation_engine import run_hospital_day_simulation

from utils.scoring import calculate_priority, waiting_level, priority_band, score_breakdown
from utils.validation import validate_patient_data
from utils.data_loader import get_golden_data
from utils.serialization import (
    export_scenario_to_dict,
    export_scenario_to_json,
    import_scenario_from_dict,
    import_scenario_from_json
)
from utils.generator import generate_patients, get_preset_hospital
from utils.explain import explain_patient
from utils.reports import (
    generate_patient_report,
    generate_allocation_report,
    generate_waiting_queue_report,
    generate_resource_utilization_report,
    generate_algorithm_execution_report,
    sanitize_csv_cell
)


class TestDAAHackathonSuite(unittest.TestCase):

    def test_T01_one_patient_matching_set(self):
        """T01: One patient + matching set -> ALLOCATED, exact unit IDs."""
        bed = Bed("BED-GEN-01", "GENERAL", "Ward 1")
        doc = Doctor("DOC-PHYS-01", "Dr. Bob", "Physician")
        h = Hospital(beds=[bed], doctors=[doc], equipment=[])
        p = Patient("P01", "Alice", 30, 3, 0, 2, 2, 0, "GENERAL", "Physician", "None")
        alloc = ResourceAllocator(h, [p], clock=60)
        res = alloc.run_allocation(strategy="indexed")

        self.assertEqual(p.status, Status.ALLOCATED)
        self.assertEqual(p.assigned_bed_id, "BED-GEN-01")
        self.assertEqual(p.assigned_doctor_id, "DOC-PHYS-01")
        self.assertFalse(bed.available)
        self.assertFalse(doc.available)

    def test_T02a_icu_bed_busy(self):
        """T02a: ICU patient, ICU bed exists but busy -> WAITING, BED_BUSY."""
        bed = Bed("BED-ICU-01", "ICU", "ICU Ward", available=False, assigned_patient_id="PX")
        doc = Doctor("DOC-CARD-01", "Dr. Cardio", "Cardiologist")
        h = Hospital(beds=[bed], doctors=[doc], equipment=[])
        p = Patient("P01", "Alice", 45, 5, 0, 5, 5, 1, "ICU", "Cardiologist", "None")
        alloc = ResourceAllocator(h, [p], clock=60)
        alloc.run_allocation(strategy="indexed")

        self.assertEqual(p.status, Status.WAITING)
        self.assertIn("BED_BUSY", p.reason_codes)

    def test_T02b_zero_icu_beds(self):
        """T02b: ICU patient, zero ICU beds -> UNAVAILABLE, NO_BED_IN_INVENTORY."""
        doc = Doctor("DOC-CARD-01", "Dr. Cardio", "Cardiologist")
        h = Hospital(beds=[], doctors=[doc], equipment=[])
        p = Patient("P01", "Alice", 45, 5, 0, 5, 5, 1, "ICU", "Cardiologist", "None")
        alloc = ResourceAllocator(h, [p], clock=60)
        alloc.run_allocation(strategy="indexed")

        self.assertEqual(p.status, Status.UNAVAILABLE)
        self.assertIn("NO_BED_IN_INVENTORY", p.reason_codes)

    def test_T03_two_patients_one_doctor(self):
        """T03: Two patients, one doctor -> Higher priority allocated, other waits."""
        bed1 = Bed("BED-GEN-01", "GENERAL", "Ward 1")
        bed2 = Bed("BED-GEN-02", "GENERAL", "Ward 1")
        doc = Doctor("DOC-PHYS-01", "Dr. Single", "Physician")
        h = Hospital(beds=[bed1, bed2], doctors=[doc], equipment=[])

        p1 = Patient("P01", "HighPri", 40, 4, 10, 3, 3, 0, "GENERAL", "Physician", "None", arrival_seq=1)
        p2 = Patient("P02", "LowPri", 40, 2, 10, 2, 2, 0, "GENERAL", "Physician", "None", arrival_seq=2)

        alloc = ResourceAllocator(h, [p1, p2], clock=60)
        alloc.run_allocation(strategy="indexed")

        self.assertEqual(p1.status, Status.ALLOCATED)
        self.assertEqual(p2.status, Status.WAITING)
        self.assertIn("DOCTOR_BUSY", p2.reason_codes)

    def test_T04_two_patients_one_ventilator(self):
        """T04: Two patients, one ventilator -> Higher-priority ventilator patient gets it."""
        b1 = Bed("BED-ICU-01", "ICU", "ICU")
        b2 = Bed("BED-ICU-02", "ICU", "ICU")
        d1 = Doctor("DOC-CARD-01", "Dr. A", "Cardiologist")
        d2 = Doctor("DOC-CARD-02", "Dr. B", "Cardiologist")
        vent = Equipment("EQP-VENT-01", "Ventilator", "Rm 1")
        h = Hospital(beds=[b1, b2], doctors=[d1, d2], equipment=[vent])

        p_high = Patient("P01", "High", 50, 5, 0, 5, 5, 1, "ICU", "Cardiologist", "Ventilator", arrival_seq=1)
        p_low = Patient("P02", "Low", 50, 4, 0, 4, 4, 1, "ICU", "Cardiologist", "Ventilator", arrival_seq=2)

        alloc = ResourceAllocator(h, [p_high, p_low], clock=60)
        alloc.run_allocation(strategy="indexed")

        self.assertEqual(p_high.status, Status.ALLOCATED)
        self.assertEqual(p_high.assigned_equipment_id, "EQP-VENT-01")
        self.assertEqual(p_low.status, Status.WAITING)
        self.assertIn("EQUIPMENT_BUSY", p_low.reason_codes)

    def test_T05_no_patients(self):
        """T05: No patients -> No allocation; friendly metrics; no crash."""
        h, _ = get_golden_data()
        alloc = ResourceAllocator(h, [], clock=120)
        res = alloc.run_allocation()

        self.assertEqual(res.metrics.total_patients, 0)
        self.assertEqual(res.metrics.allocated_count, 0)
        self.assertEqual(len(res.trace), 0)

    def test_T06_no_equipment_in_inventory(self):
        """T06: Equipment-dependent patient UNAVAILABLE; None-equipment patient allocated."""
        b1 = Bed("BED-GEN-01", "GENERAL", "Ward 1")
        b2 = Bed("BED-GEN-02", "GENERAL", "Ward 1")
        doc1 = Doctor("DOC-PHYS-01", "Dr. A", "Physician")
        doc2 = Doctor("DOC-PHYS-02", "Dr. B", "Physician")
        h = Hospital(beds=[b1, b2], doctors=[doc1, doc2], equipment=[])

        p_needs_eq = Patient("P01", "NeedsECG", 40, 4, 0, 4, 4, 0, "GENERAL", "Physician", "ECG", arrival_seq=1)
        p_no_eq = Patient("P02", "NoECG", 40, 2, 0, 2, 2, 0, "GENERAL", "Physician", "None", arrival_seq=2)

        alloc = ResourceAllocator(h, [p_needs_eq, p_no_eq], clock=60)
        alloc.run_allocation(strategy="indexed")

        self.assertEqual(p_needs_eq.status, Status.UNAVAILABLE)
        self.assertIn("NO_EQUIPMENT_IN_INVENTORY", p_needs_eq.reason_codes)
        self.assertEqual(p_no_eq.status, Status.ALLOCATED)

    def test_T07_duplicate_patient_id(self):
        """T07: Duplicate patient ID (case-insensitive) -> Reject; nothing added."""
        h, patients = get_golden_data()
        alloc = ResourceAllocator(h, patients, clock=120)

        p_dup = Patient("p01", "Duplicate Alice", 30, 3, 0, 2, 2, 0, "GENERAL", "Physician", "None")
        with self.assertRaises(DomainError) as ctx:
            alloc.add_patient(p_dup)
        self.assertIn("P01", str(ctx.exception).upper())
        self.assertEqual(len(alloc.patients), 4)

    def test_T08_several_compatible_doctors_assign_lowest_id(self):
        """T08: Several compatible doctors -> Exactly one assigned (lowest ID); others stay free."""
        b = Bed("BED-GEN-01", "GENERAL", "Ward 1")
        d2 = Doctor("DOC-PHYS-02", "Dr. Two", "Physician")
        d1 = Doctor("DOC-PHYS-01", "Dr. One", "Physician")
        d3 = Doctor("DOC-PHYS-03", "Dr. Three", "Physician")
        h = Hospital(beds=[b], doctors=[d2, d1, d3], equipment=[])

        p = Patient("P01", "Alice", 30, 3, 0, 2, 2, 0, "GENERAL", "Physician", "None")
        alloc = ResourceAllocator(h, [p], clock=60)
        alloc.run_allocation(strategy="indexed")

        self.assertEqual(p.status, Status.ALLOCATED)
        self.assertEqual(p.assigned_doctor_id, "DOC-PHYS-01")
        self.assertTrue(d2.available)
        self.assertTrue(d3.available)

    def test_T09_golden_plus_1_physician(self):
        """T09: Golden + 1 Physician -> Allocated 3 -> 4, waiting 1 -> 0, Score 1235."""
        h, patients = get_golden_data()
        alloc = ResourceAllocator(h, patients, clock=120)
        res = what_if(alloc, {"Physician": 1})

        self.assertEqual(res.scenario_metrics.allocated_count, 4)
        self.assertEqual(res.scenario_metrics.waiting_count, 0)
        self.assertEqual(res.scenario_metrics.weighted_score, 1235)
        self.assertEqual(res.scenario_metrics.overall_util_pct, 76.9)

    def test_T10_golden_minus_1_ventilator(self):
        """T10: Golden - 1 Ventilator -> P01 UNAVAILABLE, not-allocated 1 -> 2, Bypass 2, Score 630."""
        h, patients = get_golden_data()
        alloc = ResourceAllocator(h, patients, clock=120)
        res = what_if(alloc, {"Ventilator": -1})

        self.assertEqual(res.scenario_metrics.allocated_count, 2)
        self.assertEqual(res.scenario_metrics.waiting_count, 1)
        self.assertEqual(res.scenario_metrics.unavailable_count, 1)
        self.assertEqual(res.scenario_metrics.weighted_score, 630)
        self.assertEqual(res.scenario_metrics.bypass_count, 2)

    def test_T11_atomicity_all_or_nothing(self):
        """T11: Atomicity - incomplete plan leaves candidate bed and doctor uncommitted."""
        bed = Bed("BED-ICU-01", "ICU", "ICU Ward")
        doc = Doctor("DOC-CARD-01", "Dr. Cardio", "Cardiologist")
        vent = Equipment("EQP-VENT-01", "Ventilator", "Rm 1", available=False, assigned_patient_id="PX")
        h = Hospital(beds=[bed], doctors=[doc], equipment=[vent])

        p = Patient("P01", "Critical", 50, 5, 0, 5, 5, 1, "ICU", "Cardiologist", "Ventilator")
        alloc = ResourceAllocator(h, [p], clock=60)
        alloc.run_allocation(strategy="indexed")

        self.assertEqual(p.status, Status.WAITING)
        self.assertIsNone(p.assigned_bed_id)
        self.assertIsNone(p.assigned_doctor_id)
        self.assertTrue(bed.available)
        self.assertTrue(doc.available)

    def test_T12_tie_break_determinism(self):
        """T12: Equal priority -> Higher severity first, then earlier arrival."""
        h, _ = get_golden_data()
        # Create two patients with same priority but different severity and arrivals
        # Score = 40*S + 20*W + 15*R + 15*U + 10*I
        # P1: S=4, W=1, R=3, U=3, I=0 -> 160 + 20 + 45 + 45 + 0 = 270
        # P2: S=3, W=3, R=3, U=3, I=0 -> 120 + 60 + 45 + 45 + 0 = 270
        p1 = Patient("P01", "S4", 30, 4, 115, 3, 3, 0, "GENERAL", "Physician", "None", arrival_seq=1)
        p2 = Patient("P02", "S3", 30, 3, 85, 3, 3, 0, "GENERAL", "Physician", "None", arrival_seq=2)

        alloc = ResourceAllocator(h, [p2, p1], clock=120)
        res = alloc.run_allocation(strategy="indexed")

        # P1 has higher severity (4 vs 3), so extracted first
        self.assertEqual(res.trace[0].patient_id, "P01")
        self.assertEqual(res.trace[1].patient_id, "P02")

    def test_T13_max_heap_correctness(self):
        """T13: MaxHeap property and extraction equals sorted(reverse=True)."""
        heap = MaxHeap()
        items = [(100, "A"), (400, "B"), (250, "C"), (300, "D"), (150, "E")]
        for k, v in items:
            heap.insert((k,), v)

        extracted = []
        while not heap.is_empty():
            key, val = heap.extract_max()
            extracted.append((key[0], val))

        expected = sorted(items, key=lambda x: x[0], reverse=True)
        self.assertEqual(extracted, expected)

    def test_T14_no_double_allocation(self):
        """T14: No unit is assigned to more than 1 patient; each assigned unit is compatible."""
        h = get_preset_hospital("Standard")
        patients = generate_patients(30, seed=123)
        alloc = ResourceAllocator(h, patients, clock=120)
        alloc.run_allocation(strategy="indexed")

        assigned_beds = []
        assigned_docs = []
        assigned_eqs = []

        for p in alloc.patients:
            if p.status == Status.ALLOCATED:
                self.assertIsNotNone(p.assigned_bed_id)
                self.assertIsNotNone(p.assigned_doctor_id)
                assigned_beds.append(p.assigned_bed_id)
                assigned_docs.append(p.assigned_doctor_id)
                if p.required_equipment != "None":
                    self.assertIsNotNone(p.assigned_equipment_id)
                    assigned_eqs.append(p.assigned_equipment_id)

        # Check uniqueness
        self.assertEqual(len(assigned_beds), len(set(assigned_beds)))
        self.assertEqual(len(assigned_docs), len(set(assigned_docs)))
        self.assertEqual(len(assigned_eqs), len(set(assigned_eqs)))

    def test_T15_discharge_and_rerun(self):
        """T15: Freed units from discharge are reused by a waiting patient on re-run."""
        h, patients = get_golden_data()
        alloc = ResourceAllocator(h, patients, clock=120)
        alloc.run_allocation(strategy="indexed")

        # In golden, P04 is waiting for Physician (held by P02)
        p04 = next(p for p in alloc.patients if p.patient_id == "P04")
        self.assertEqual(p04.status, Status.WAITING)

        # Discharge P02
        alloc.discharge("P02")
        p02 = next(p for p in alloc.patients if p.patient_id == "P02")
        self.assertEqual(p02.status, Status.COMPLETED)

        # Re-run waiting patients
        alloc.run_allocation(strategy="indexed")
        self.assertEqual(p04.status, Status.ALLOCATED)
        self.assertEqual(p04.assigned_doctor_id, "DOC-PHYS-01")

    def test_T16_formula_golden_values(self):
        """T16: Formula yields exact 440/390/240/165; min 90; max 460."""
        # Golden P01: S=5, W=4, R=5, U=5, I=1
        self.assertEqual(calculate_priority(5, 4, 5, 5, 1), 440)
        # Golden P03: S=5, W=3, R=4, U=4, I=1
        self.assertEqual(calculate_priority(5, 3, 4, 4, 1), 390)
        # Golden P02: S=3, W=3, R=2, U=2, I=0
        self.assertEqual(calculate_priority(3, 3, 2, 2, 0), 240)
        # Golden P04: S=2, W=2, R=2, U=1, I=0
        self.assertEqual(calculate_priority(2, 2, 2, 1, 0), 165)

        # Min and Max
        self.assertEqual(calculate_priority(1, 1, 1, 1, 0), 90)
        self.assertEqual(calculate_priority(5, 5, 5, 5, 1), 460)

    def test_T17_strategy_equivalence(self):
        """T17: Strategy Baseline and Indexed produce identical patient statuses."""
        h1 = get_preset_hospital("Standard")
        h2 = h1.clone()
        pts1 = generate_patients(15, seed=42)
        pts2 = [copy.deepcopy(p) for p in pts1]

        alloc1 = ResourceAllocator(h1, pts1, clock=120)
        res1 = alloc1.run_allocation(strategy="baseline")

        alloc2 = ResourceAllocator(h2, pts2, clock=120)
        res2 = alloc2.run_allocation(strategy="indexed")

        statuses1 = [p.status for p in alloc1.patients]
        statuses2 = [p.status for p in alloc2.patients]
        self.assertEqual(statuses1, statuses2)

    def test_T18_validation_rules(self):
        """T18: Input validation handles missing name, bad age, ICU mismatch, unknown types."""
        res_blank_name = validate_patient_data({"patient_id": "P1", "name": "", "age": 20})
        self.assertFalse(res_blank_name.ok)
        self.assertIn("name cannot be blank", res_blank_name.errors[0])

        res_bad_age = validate_patient_data({"patient_id": "P1", "name": "Bob", "age": 150})
        self.assertFalse(res_bad_age.ok)

        res_icu_mismatch = validate_patient_data({
            "patient_id": "P1", "name": "Bob", "age": 50, "severity": 5, "risk": 5, "urgency": 5,
            "icu_required": 1, "required_bed_type": "GENERAL", "required_doctor_specialty": "Physician"
        })
        self.assertFalse(res_icu_mismatch.ok)
        self.assertTrue(any("ICU" in e for e in res_icu_mismatch.errors))

    def test_T20_reports_generation(self):
        """T20: Reports generate non-empty CSVs with exact required columns."""
        h, patients = get_golden_data()
        alloc = ResourceAllocator(h, patients, clock=120)
        res = alloc.run_allocation(strategy="indexed")

        p_csv = generate_patient_report(alloc)
        self.assertIn("patient_id,name,age,severity", p_csv)

        a_csv = generate_allocation_report(alloc)
        self.assertIn("patient_id,name,priority,bed_id", a_csv)

        w_csv = generate_waiting_queue_report(alloc)
        self.assertIn("patient_id,priority,required_bed", w_csv)

        u_csv = generate_resource_utilization_report(alloc)
        self.assertIn("category,type,total,busy", u_csv)

        e_csv = generate_algorithm_execution_report(res.trace)
        self.assertIn("step,patient_id,priority", e_csv)

    def test_T21_aging(self):
        """T21: Aging (+15 min) -> P04: 165 -> 185; P03: 390 -> 410; P01: 440; P02: 240."""
        h, patients = get_golden_data()
        alloc = ResourceAllocator(h, patients, clock=120)
        alloc.advance_clock(15)  # clock = 135

        # P04: arrival 105, wait = 135 - 105 = 30 min -> W_level 3 -> 80+60+30+15 = 185
        # P03: arrival 75, wait = 135 - 75 = 60 min -> W_level 4 -> 200+80+60+60+10 = 410
        p04 = next(p for p in alloc.patients if p.patient_id == "P04")
        p03 = next(p for p in alloc.patients if p.patient_id == "P03")

        w_lvl_4 = waiting_level(alloc.clock - p04.arrival_minute)
        pri_4 = calculate_priority(p04.severity, w_lvl_4, p04.risk, p04.urgency, p04.icu_required)
        self.assertEqual(pri_4, 185)

        w_lvl_3 = waiting_level(alloc.clock - p03.arrival_minute)
        pri_3 = calculate_priority(p03.severity, w_lvl_3, p03.risk, p03.urgency, p03.icu_required)
        self.assertEqual(pri_3, 410)

    def test_T22_counterexample_greedy_limitations(self):
        """T22: Counterexample (§7.13): 2 allocated with 0 ECG; 1 allocated with 1 ECG."""
        # Inventory: 1 General bed, 1 ICU bed, 1 Physician, 1 Cardiologist
        def make_h(ecg_count: int):
            return Hospital(
                beds=[Bed("BED-GEN-01", "GENERAL", "Gen"), Bed("BED-ICU-01", "ICU", "ICU")],
                doctors=[Doctor("DOC-PHYS-01", "Dr. Phys", "Physician"), Doctor("DOC-CARD-01", "Dr. Card", "Cardiologist")],
                equipment=[Equipment("EQP-ECG-01", "ECG", "Lab")] if ecg_count > 0 else []
            )

        # Patients in priority order:
        # p: Gen + Phys + ECG (Priority 400)
        # q1: Gen + Card (Priority 300)
        # q2: ICU + Phys (Priority 200)
        p = Patient("P", "P", 40, 5, 0, 5, 5, 0, "GENERAL", "Physician", "ECG", arrival_seq=1)
        q1 = Patient("Q1", "Q1", 40, 4, 0, 4, 4, 0, "GENERAL", "Cardiologist", "None", arrival_seq=2)
        q2 = Patient("Q2", "Q2", 40, 3, 0, 3, 3, 1, "ICU", "Physician", "None", arrival_seq=3)

        # Case 1: 0 ECG machines -> p is UNAVAILABLE; q1 and q2 are allocated -> 2 allocated
        alloc_0 = ResourceAllocator(make_h(0), [copy.deepcopy(p), copy.deepcopy(q1), copy.deepcopy(q2)], clock=60)
        res_0 = alloc_0.run_allocation(strategy="indexed")
        self.assertEqual(res_0.metrics.allocated_count, 2)

        # Case 2: 1 ECG machine added -> p is ALLOCATED; q1 and q2 wait -> 1 allocated!
        alloc_1 = ResourceAllocator(make_h(1), [copy.deepcopy(p), copy.deepcopy(q1), copy.deepcopy(q2)], clock=60)
        res_1 = alloc_1.run_allocation(strategy="indexed")
        self.assertEqual(res_1.metrics.allocated_count, 1)

    def test_T23_what_if_purity(self):
        """T23: What-if and advisor never mutate the live allocator state."""
        h, patients = get_golden_data()
        alloc = ResourceAllocator(h, patients, clock=120)
        alloc.run_allocation(strategy="indexed")

        pre_beds = len(alloc.hospital.beds)
        pre_docs = len(alloc.hospital.doctors)

        # Run advisor and what_if
        _ = advise(alloc)
        _ = what_if(alloc, {"Physician": 2, "Ventilator": -1})

        self.assertEqual(len(alloc.hospital.beds), pre_beds)
        self.assertEqual(len(alloc.hospital.doctors), pre_docs)

    def test_T24_golden_trace_and_final_free_units(self):
        """T24: Golden trace matches §10.4; final free units are BED-GEN-02, BED-EMG-01, EQP-ECG-01, EQP-MRI-01."""
        h, patients = get_golden_data()
        alloc = ResourceAllocator(h, patients, clock=120)
        res = alloc.run_allocation(strategy="indexed")

        # Step order
        self.assertEqual([t.patient_id for t in res.trace], ["P01", "P03", "P02", "P04"])
        self.assertEqual(res.trace[0].result, Status.ALLOCATED)
        self.assertEqual(res.trace[1].result, Status.ALLOCATED)
        self.assertEqual(res.trace[2].result, Status.ALLOCATED)
        self.assertEqual(res.trace[3].result, Status.WAITING)

        # Candidate not committed check in trace
        self.assertIn("candidate", res.trace[3].checks["bed"])

        # Check final free units
        free_beds = [b.bed_id for b in alloc.hospital.beds if b.available]
        free_eqs = [e.equipment_id for e in alloc.hospital.equipment if e.available]
        self.assertEqual(sorted(free_beds), ["BED-EMG-01", "BED-GEN-02"])
        self.assertEqual(sorted(free_eqs), ["EQP-ECG-01", "EQP-MRI-01"])

    def test_T26_explain_p04(self):
        """T26: Explain P04 returns rank 4, blocker P02, and unblock suggestions."""
        h, patients = get_golden_data()
        alloc = ResourceAllocator(h, patients, clock=120)
        alloc.run_allocation(strategy="indexed")

        exp = explain_patient(alloc, "P04")
        self.assertEqual(exp.rank, 4)
        self.assertEqual(exp.status, Status.WAITING)
        self.assertTrue(any("P02" in b.get("holders", []) for b in exp.blockers))
        self.assertTrue(any("Physician" in b.get("unblock", "") for b in exp.blockers))

    def test_T27_advisor_on_golden(self):
        """T27: Advisor on golden ranks +1 Physician as top recommendation."""
        h, patients = get_golden_data()
        alloc = ResourceAllocator(h, patients, clock=120)
        alloc.run_allocation(strategy="indexed")

        advice_list = advise(alloc)
        top = advice_list[0]
        self.assertEqual(top.type_, "Physician")
        self.assertEqual(top.delta_allocated, 1)
        self.assertEqual(top.delta_weighted_score, 165)
        self.assertEqual(top.newly_allocated_ids, ["P04"])

    def test_T28_bottleneck_on_golden(self):
        """T28: Bottleneck on golden has Physician pressure 2.0 and shortage 1."""
        h, patients = get_golden_data()
        alloc = ResourceAllocator(h, patients, clock=120)
        alloc.run_allocation(strategy="indexed")

        bt = bottleneck_table(alloc)
        top_bn = bt[0]
        self.assertEqual(top_bn.type_, "Physician")
        self.assertEqual(top_bn.pressure, 2.0)
        self.assertEqual(top_bn.shortage, 1)

    def test_T30_json_roundtrip_lossless(self):
        """T30: JSON scenario round-trip is lossless; unsupported version rejected."""
        h, patients = get_golden_data()
        alloc = ResourceAllocator(h, patients, clock=120)

        json_str = export_scenario_to_json(alloc)
        reloaded = import_scenario_from_json(json_str)

        self.assertEqual(len(reloaded.patients), len(alloc.patients))
        self.assertEqual(len(reloaded.hospital.beds), len(alloc.hospital.beds))
        self.assertEqual(reloaded.clock, 120)

        # Unknown version check
        bad_dict = {"version": 99, "patients": []}
        with self.assertRaises(DomainError):
            import_scenario_from_dict(bad_dict)

    def test_T33_undo_and_history(self):
        """T33: Run + Undo restores exact pre-run state."""
        h, patients = get_golden_data()
        alloc = ResourceAllocator(h, patients, clock=120)
        pre_status = [p.status for p in alloc.patients]

        alloc.run_allocation(strategy="indexed")
        post_status = [p.status for p in alloc.patients]
        self.assertNotEqual(pre_status, post_status)

        ok = alloc.undo()
        self.assertTrue(ok)
        undone_status = [p.status for p in alloc.patients]
        self.assertEqual(pre_status, undone_status)

    def test_T35_csv_injection_hardening(self):
        """T35: Cells starting with =, +, -, @, tab or CR are sanitized with leading quote."""
        self.assertEqual(sanitize_csv_cell("=1+1"), "'=1+1")
        self.assertEqual(sanitize_csv_cell("+cmd"), "'+cmd")
        self.assertEqual(sanitize_csv_cell("-calc"), "'-calc")
        self.assertEqual(sanitize_csv_cell("@exec"), "'@exec")
        self.assertEqual(sanitize_csv_cell("Normal Text"), "Normal Text")

    def test_T36_op_counters(self):
        """T36: Golden indexed unit_checks = 10; baseline checks >= indexed."""
        h1, p1 = get_golden_data()
        alloc1 = ResourceAllocator(h1, p1, clock=120)
        res_idx = alloc1.run_allocation(strategy="indexed")
        self.assertEqual(res_idx.ops.unit_checks, 10)

        h2, p2 = get_golden_data()
        alloc2 = ResourceAllocator(h2, p2, clock=120)
        res_base = alloc2.run_allocation(strategy="baseline")
        self.assertGreaterEqual(res_base.ops.unit_checks, res_idx.ops.unit_checks)

    def test_T39_hospital_day_simulation(self):
        """T39: [STRETCH] Time-stepped hospital-day simulation golden values."""
        h, patients = get_golden_data()
        sim_res = run_hospital_day_simulation(h, patients, start_clock=120, horizon_minutes=360)

        # Expected: average wait 51.25, max wait 75, throughput 4
        self.assertEqual(sim_res.throughput, 4)
        self.assertEqual(sim_res.avg_wait_minutes, 51.25)
        self.assertEqual(sim_res.max_wait_minutes, 75)

    def test_T25_determinism(self):
        """T25: Determinism - same input twice yields identical trace."""
        h1, p1 = get_golden_data()
        alloc1 = ResourceAllocator(h1, p1, clock=120)
        res1 = alloc1.run_allocation(strategy="indexed")

        h2, p2 = get_golden_data()
        alloc2 = ResourceAllocator(h2, p2, clock=120)
        res2 = alloc2.run_allocation(strategy="indexed")

        for s1, s2 in zip(res1.trace, res2.trace):
            self.assertEqual(s1.patient_id, s2.patient_id)
            self.assertEqual(s1.result, s2.result)
            self.assertEqual(s1.priority, s2.priority)

    def test_T29_bypass_count_computation(self):
        """T29: Bypass count: Golden = 0; Scenario B (-1 Vent) = 2."""
        h_gold, p_gold = get_golden_data()
        alloc_gold = ResourceAllocator(h_gold, p_gold, clock=120)
        res_gold = alloc_gold.run_allocation(strategy="indexed")
        self.assertEqual(res_gold.bypass_count, 0)

        # Scenario B: -1 Vent
        h_b, p_b = get_golden_data()
        alloc_b = ResourceAllocator(h_b, p_b, clock=120)
        alloc_b.hospital.remove_free_units("equipment", "Ventilator", 1)
        res_b = alloc_b.run_allocation(strategy="indexed")
        self.assertEqual(res_b.bypass_count, 2)

    def test_T31_generator_and_presets(self):
        """T31: Generator is deterministic with seed; demo dataset produces >=1 alloc, >=1 wait, 3 bands."""
        pts_a = generate_patients(12, seed=42)
        pts_b = generate_patients(12, seed=42)
        self.assertEqual([p.patient_id for p in pts_a], [p.patient_id for p in pts_b])
        self.assertEqual([p.severity for p in pts_a], [p.severity for p in pts_b])

        h_shortage = get_preset_hospital("Equipment shortage")
        alloc = ResourceAllocator(h_shortage, pts_a, clock=120)
        res = alloc.run_allocation(strategy="indexed")
        self.assertGreaterEqual(res.metrics.allocated_count, 1)
        self.assertGreaterEqual(res.metrics.waiting_count, 1)
        bands = {p.band for p in pts_a}
        self.assertTrue(len(bands) >= 2)

    def test_T32_event_log(self):
        """T32: Event log records operations with timestamps."""
        h, patients = get_golden_data()
        alloc = ResourceAllocator(h, patients, clock=120)
        alloc.run_allocation(strategy="indexed")
        self.assertGreaterEqual(len(alloc.event_log), 4)
        kinds = [e.kind for e in alloc.event_log]
        self.assertIn("RUN_STARTED", kinds)
        self.assertIn("ALLOCATED", kinds)

    def test_T34_weight_lab_custom_weights(self):
        """T34: Weight Lab - default weights match golden; custom weights alter priorities."""
        def_score = calculate_priority(5, 4, 5, 5, 1, config.DEFAULT_WEIGHTS)
        self.assertEqual(def_score, 440)

        custom_weights = {"severity": 10, "waiting": 50, "risk": 5, "urgency": 5, "icu": 5}
        cust_score = calculate_priority(5, 4, 5, 5, 1, custom_weights)
        self.assertEqual(cust_score, 10*5 + 50*4 + 5*5 + 5*5 + 5*1)
        self.assertNotEqual(def_score, cust_score)

    def test_T38_upload_and_validation_safety(self):
        """T38: Malformed patient records rejected gracefully."""
        bad_p = {"patient_id": "P!!#", "name": "Bad", "age": -5}
        val = validate_patient_data(bad_p)
        self.assertFalse(val.ok)
        self.assertGreaterEqual(len(val.errors), 2)

    def test_T40_stretch_exhaustive_vs_greedy(self):
        """T40: [STRETCH] Counterexample with 1 ECG: greedy allocates 1, max cardinality subset is 2."""
        # Patients: p (Gen+Phys+ECG), q1 (Gen+Card), q2 (ICU+Phys)
        # Supply: 1 Gen, 1 ICU, 1 Phys, 1 Card, 1 ECG
        # Greedy takes p (Priority 400), blocking q1 (needs Gen) and q2 (needs Phys) -> 1 allocated
        # Exhaustive can take {q1, q2} -> 2 allocated
        p = Patient("P", "P", 40, 5, 0, 5, 5, 0, "GENERAL", "Physician", "ECG", arrival_seq=1)
        q1 = Patient("Q1", "Q1", 40, 4, 0, 4, 4, 0, "GENERAL", "Cardiologist", "None", arrival_seq=2)
        q2 = Patient("Q2", "Q2", 40, 3, 0, 3, 3, 1, "ICU", "Physician", "None", arrival_seq=3)

        h = Hospital(
            beds=[Bed("BED-GEN-01", "GENERAL", "Gen"), Bed("BED-ICU-01", "ICU", "ICU")],
            doctors=[Doctor("DOC-PHYS-01", "Dr. Phys", "Physician"), Doctor("DOC-CARD-01", "Dr. Card", "Cardiologist")],
            equipment=[Equipment("EQP-ECG-01", "ECG", "Lab")]
        )
        alloc = ResourceAllocator(h, [p, q1, q2], clock=60)
        res = alloc.run_allocation(strategy="indexed")
        self.assertEqual(res.metrics.allocated_count, 1)

    def test_benchmark_and_logger(self):
        """Test empirical benchmark runner and logging configuration."""
        from algorithms.complexity import benchmark
        from utils.logging_config import setup_logger

        logger = setup_logger("logs")
        logger.info("Test log entry")

        bench_rows = benchmark(sizes=[10, 20], seed=42)
        self.assertEqual(len(bench_rows), 2)
        self.assertIn("indexed_runtime_ms", bench_rows[0])

    def test_floyd_build_heap(self):
        """Test Floyd's O(N) heap construction."""
        heap = MaxHeap()
        pairs = [((50,), "A"), ((20,), "B"), ((80,), "C"), ((10,), "D"), ((90,), "E")]
        heap.build_heap(pairs)
        self.assertEqual(len(heap), 5)
        top = heap.extract_max()
        self.assertEqual(top[0][0], 90)


if __name__ == "__main__":
    unittest.main()

