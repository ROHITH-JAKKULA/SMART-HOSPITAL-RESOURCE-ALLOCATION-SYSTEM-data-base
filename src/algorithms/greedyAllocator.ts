import {
  Patient,
  HospitalInventory,
  AllocationResult,
  TraceStep,
  Metrics,
  BottleneckRow,
  Advice,
  ScoringWeights,
} from "../types";
import { calculatePriority, waitingLevel, priorityBand, DEFAULT_WEIGHTS } from "./scoring";
import { MaxHeap, HeapKey } from "./priorityQueue";

export function runAllocationEngine(
  hospital: HospitalInventory,
  patients: Patient[],
  clock: number = 120,
  weights: ScoringWeights = DEFAULT_WEIGHTS,
  strategy: "indexed" | "baseline" = "indexed",
  order: "priority" | "fcfs" = "priority"
): AllocationResult {
  const t0 = performance.now();
  let unitChecks = 0;

  // Clone hospital state
  const beds = hospital.beds.map((b) => ({ ...b }));
  const doctors = hospital.doctors.map((d) => ({ ...d }));
  const equipment = hospital.equipment.map((e) => ({ ...e }));

  // Dynamic Aging and Priority recomputation for arrived patients
  const activePatients = patients.map((p) => {
    const copy = { ...p };
    if (copy.status !== "COMPLETED") {
      copy.waiting_minutes = Math.max(0, clock - copy.arrival_minute);
      copy.waiting_level = waitingLevel(copy.waiting_minutes);
      copy.priority = calculatePriority(
        copy.severity,
        copy.waiting_level,
        copy.risk,
        copy.urgency,
        copy.icu_required,
        weights
      );
      copy.band = priorityBand(copy.priority);
      copy.reason_codes = [];
    }
    return copy;
  });

  const pool = activePatients.filter(
    (p) =>
      (p.status === "NEW" || p.status === "WAITING" || p.status === "UNAVAILABLE") &&
      p.arrival_minute <= clock
  );

  const heap = new MaxHeap<Patient>();
  let extractionOrder: Array<{ patient: Patient; heapSizeBefore: number; snapshot?: any }> = [];

  if (order === "priority") {
    pool.forEach((p) => {
      const key: HeapKey = [p.priority, p.severity, -p.arrival_seq];
      heap.insert(key, p);
    });

    while (!heap.isEmpty()) {
      const snap = pool.length <= 50 ? heap.snapshot() : undefined;
      const sizeBefore = heap.size;
      const node = heap.extractMax();
      extractionOrder.push({ patient: node.item, heapSizeBefore: sizeBefore, snapshot: snap });
    }
  } else {
    // FCFS
    const sorted = [...pool].sort((a, b) => {
      if (a.arrival_minute !== b.arrival_minute) return a.arrival_minute - b.arrival_minute;
      return a.arrival_seq - b.arrival_seq;
    });
    extractionOrder = sorted.map((p, i) => ({
      patient: p,
      heapSizeBefore: sorted.length - i,
    }));
  }

  const trace: TraceStep[] = [];
  let unservedSoFar = 0;
  let bypassCount = 0;
  let stepNo = 0;

  for (const { patient: p, heapSizeBefore, snapshot } of extractionOrder) {
    stepNo++;
    const checksBefore = unitChecks;

    let candidateBed: (typeof beds)[0] | undefined;
    let candidateDoc: (typeof doctors)[0] | undefined;
    let candidateEq: (typeof equipment)[0] | undefined;

    const needsEq = p.required_equipment && p.required_equipment !== "None";

    if (strategy === "baseline") {
      // Strategy A: Triple nested search
      const sortedBeds = [...beds].sort((a, b) => a.bed_id.localeCompare(b.bed_id));
      const sortedDocs = [...doctors].sort((a, b) => a.doctor_id.localeCompare(b.doctor_id));
      const sortedEqs = needsEq
        ? [...equipment].sort((a, b) => a.equipment_id.localeCompare(b.equipment_id))
        : [null];

      let found = false;
      for (const b of sortedBeds) {
        if (found) break;
        for (const d of sortedDocs) {
          if (found) break;
          for (const e of sortedEqs) {
            unitChecks++;
            const bOk = b.available && b.bed_type === p.required_bed_type;
            const dOk = d.available && d.specialization === p.required_doctor_specialty;
            const eOk = !needsEq || (e !== null && e.available && e.equipment_type === p.required_equipment);

            if (bOk && dOk && eOk) {
              candidateBed = b;
              candidateDoc = d;
              candidateEq = e || undefined;
              found = true;
              break;
            }
          }
        }
      }
    } else {
      // Strategy C: Indexed candidate lookup O(1)
      unitChecks++;
      candidateBed = beds
        .filter((b) => b.available && b.bed_type === p.required_bed_type)
        .sort((a, b) => a.bed_id.localeCompare(b.bed_id))[0];

      unitChecks++;
      candidateDoc = doctors
        .filter((d) => d.available && d.specialization === p.required_doctor_specialty)
        .sort((a, b) => a.doctor_id.localeCompare(b.doctor_id))[0];

      if (needsEq) {
        unitChecks++;
        candidateEq = equipment
          .filter((e) => e.available && e.equipment_type === p.required_equipment)
          .sort((a, b) => a.equipment_id.localeCompare(b.equipment_id))[0];
      }
    }

    const eqSatisfied = !needsEq || candidateEq !== undefined;
    const isComplete = candidateBed !== undefined && candidateDoc !== undefined && eqSatisfied;

    const checksMap = {
      bed: "—",
      doctor: "—",
      equipment: "—",
    };
    const assignedMap: { bed?: string; doctor?: string; equipment?: string } = {};

    if (isComplete) {
      // Atomic commit
      candidateBed!.available = false;
      candidateBed!.assigned_patient_id = p.patient_id;
      candidateDoc!.available = false;
      candidateDoc!.assigned_patient_id = p.patient_id;
      if (candidateEq) {
        candidateEq.available = false;
        candidateEq.assigned_patient_id = p.patient_id;
      }

      p.status = "ALLOCATED";
      p.assigned_bed_id = candidateBed!.bed_id;
      p.assigned_doctor_id = candidateDoc!.doctor_id;
      p.assigned_equipment_id = candidateEq ? candidateEq.equipment_id : undefined;
      p.allocation_clock = clock;
      p.reason_codes = [];

      checksMap.bed = `✓ ${candidateBed!.bed_id}`;
      checksMap.doctor = `✓ ${candidateDoc!.doctor_id}`;
      checksMap.equipment = candidateEq ? `✓ ${candidateEq.equipment_id}` : "—";

      assignedMap.bed = candidateBed!.bed_id;
      assignedMap.doctor = candidateDoc!.doctor_id;
      assignedMap.equipment = candidateEq ? candidateEq.equipment_id : undefined;

      bypassCount += unservedSoFar;
    } else {
      // Incomplete: diagnose reasons
      const missingCodes: string[] = [];

      // Bed check diagnose
      const totalBeds = beds.filter((b) => b.bed_type === p.required_bed_type).length;
      if (totalBeds === 0) {
        missingCodes.push("NO_BED_IN_INVENTORY");
        checksMap.bed = `✗ ${p.required_bed_type} Bed: none in inventory`;
      } else if (!candidateBed) {
        const holders = beds
          .filter((b) => b.bed_type === p.required_bed_type && b.assigned_patient_id)
          .map((b) => b.assigned_patient_id!);
        missingCodes.push("BED_BUSY");
        checksMap.bed = `✗ ${p.required_bed_type} Bed: all ${totalBeds} units busy (held by ${holders.join(", ")})`;
      } else {
        checksMap.bed = `✓ candidate ${candidateBed.bed_id} (not committed)`;
      }

      // Doctor check diagnose
      const totalDocs = doctors.filter((d) => d.specialization === p.required_doctor_specialty).length;
      if (totalDocs === 0) {
        missingCodes.push("NO_DOCTOR_IN_INVENTORY");
        checksMap.doctor = `✗ ${p.required_doctor_specialty}: none in inventory`;
      } else if (!candidateDoc) {
        const holders = doctors
          .filter((d) => d.specialization === p.required_doctor_specialty && d.assigned_patient_id)
          .map((d) => d.assigned_patient_id!);
        missingCodes.push("DOCTOR_BUSY");
        checksMap.doctor = `✗ ${p.required_doctor_specialty}: all ${totalDocs} unit${
          totalDocs > 1 ? "s" : ""
        } busy (held by ${holders.join(", ")})`;
      } else {
        checksMap.doctor = `✓ candidate ${candidateDoc.doctor_id} (not committed)`;
      }

      // Equipment check diagnose
      if (needsEq) {
        const totalEqs = equipment.filter((e) => e.equipment_type === p.required_equipment).length;
        if (totalEqs === 0) {
          missingCodes.push("NO_EQUIPMENT_IN_INVENTORY");
          checksMap.equipment = `✗ ${p.required_equipment}: none in inventory`;
        } else if (!candidateEq) {
          const holders = equipment
            .filter((e) => e.equipment_type === p.required_equipment && e.assigned_patient_id)
            .map((e) => e.assigned_patient_id!);
          missingCodes.push("EQUIPMENT_BUSY");
          checksMap.equipment = `✗ ${p.required_equipment}: all ${totalEqs} unit${
            totalEqs > 1 ? "s" : ""
          } busy (held by ${holders.join(", ")})`;
        } else {
          checksMap.equipment = `✓ candidate ${candidateEq.equipment_id} (not committed)`;
        }
      }

      const isUnavailable = missingCodes.some((code) => code.endsWith("_IN_INVENTORY"));
      p.status = isUnavailable ? "UNAVAILABLE" : "WAITING";
      p.reason_codes = missingCodes;
      unservedSoFar++;
    }

    trace.push({
      step_no: stepNo,
      patient_id: p.patient_id,
      patient_name: p.name,
      priority: p.priority,
      band: p.band,
      heap_size_before: heapSizeBefore,
      heap_snapshot: snapshot,
      required: {
        bed: p.required_bed_type,
        doctor: p.required_doctor_specialty,
        equipment: p.required_equipment,
      },
      checks: checksMap,
      result: p.status,
      assigned: assignedMap,
      reason_codes: p.reason_codes,
      unit_checks_used: unitChecks - checksBefore,
    });
  }

  // Calculate Metrics
  const allocated = activePatients.filter((p) => p.status === "ALLOCATED");
  const waiting = activePatients.filter((p) => p.status === "WAITING");
  const unavailable = activePatients.filter((p) => p.status === "UNAVAILABLE");
  const completed = activePatients.filter((p) => p.status === "COMPLETED");
  const notArrived = activePatients.filter((p) => p.arrival_minute > clock);

  const bedsBusy = beds.filter((b) => !b.available).length;
  const docsBusy = doctors.filter((d) => !d.available).length;
  const eqsBusy = equipment.filter((e) => !e.available).length;

  const totalRes = beds.length + doctors.length + equipment.length;
  const busyRes = bedsBusy + docsBusy + eqsBusy;

  const allocWaits = allocated.map((p) =>
    p.allocation_clock !== undefined ? p.allocation_clock - p.arrival_minute : p.waiting_minutes
  );
  const unservedWaits = [...waiting, ...unavailable].map((p) => p.waiting_minutes);

  const avgWaitAlloc = allocWaits.length > 0 ? allocWaits.reduce((a, b) => a + b, 0) / allocWaits.length : 0;
  const avgWaitUnserved =
    unservedWaits.length > 0 ? unservedWaits.reduce((a, b) => a + b, 0) / unservedWaits.length : 0;

  const metrics: Metrics = {
    total_patients: activePatients.length,
    allocated_count: allocated.length,
    waiting_count: waiting.length,
    unavailable_count: unavailable.length,
    completed_count: completed.length,
    not_arrived_count: notArrived.length,

    beds_total: beds.length,
    beds_busy: bedsBusy,
    beds_util_pct: beds.length > 0 ? Math.round((bedsBusy / beds.length) * 1000) / 10 : 0,

    doctors_total: doctors.length,
    doctors_busy: docsBusy,
    doctors_util_pct: doctors.length > 0 ? Math.round((docsBusy / doctors.length) * 1000) / 10 : 0,

    equipment_total: equipment.length,
    equipment_busy: eqsBusy,
    equipment_util_pct: equipment.length > 0 ? Math.round((eqsBusy / equipment.length) * 1000) / 10 : 0,

    overall_total: totalRes,
    overall_busy: busyRes,
    overall_util_pct: totalRes > 0 ? Math.round((busyRes / totalRes) * 1000) / 10 : 0,

    allocation_rate: pool.length > 0 ? Math.round((allocated.length / pool.length) * 1000) / 1000 : 0,
    avg_priority_all:
      pool.length > 0 ? Math.round((pool.reduce((sum, p) => sum + p.priority, 0) / pool.length) * 10) / 10 : 0,
    avg_priority_allocated:
      allocated.length > 0
        ? Math.round((allocated.reduce((sum, p) => sum + p.priority, 0) / allocated.length) * 10) / 10
        : 0,
    avg_priority_unserved:
      waiting.length + unavailable.length > 0
        ? Math.round(
            ([...waiting, ...unavailable].reduce((sum, p) => sum + p.priority, 0) /
              (waiting.length + unavailable.length)) *
              10
          ) / 10
        : 0,

    avg_wait_allocated: Math.round(avgWaitAlloc * 10) / 10,
    avg_wait_unserved: Math.round(avgWaitUnserved * 10) / 10,
    max_wait_allocated: allocWaits.length > 0 ? Math.max(...allocWaits) : 0,
    max_wait_unserved: unservedWaits.length > 0 ? Math.max(...unservedWaits) : 0,

    weighted_score: allocated.reduce((sum, p) => sum + p.priority, 0),
    bypass_count: bypassCount,
  };

  const runtimeMs = performance.now() - t0;

  return {
    trace,
    metrics,
    ops: {
      heap_comparisons: heap.comparisons,
      unit_checks: unitChecks,
    },
    runtime_ms: Math.round(runtimeMs * 100) / 100,
    strategy,
    order,
    clock,
    bypass_count: bypassCount,
  };
}

export function computeBottleneckTable(
  hospital: HospitalInventory,
  patients: Patient[],
  clock: number
): BottleneckRow[] {
  const activePatients = patients.filter((p) => p.status !== "COMPLETED" && p.arrival_minute <= clock);
  const rows: BottleneckRow[] = [];

  const types: Array<{ kind: "bed" | "doctor" | "equipment"; type: string }> = [
    { kind: "bed", type: "ICU" },
    { kind: "bed", type: "EMERGENCY" },
    { kind: "bed", type: "GENERAL" },
    { kind: "doctor", type: "Cardiologist" },
    { kind: "doctor", type: "Neurologist" },
    { kind: "doctor", type: "Physician" },
    { kind: "doctor", type: "Surgeon" },
    { kind: "equipment", type: "Ventilator" },
    { kind: "equipment", type: "ECG" },
    { kind: "equipment", type: "Monitor" },
    { kind: "equipment", type: "MRI" },
    { kind: "equipment", type: "X-Ray" },
  ];

  for (const { kind, type } of types) {
    let supply = 0;
    let busy = 0;
    let demand = 0;
    let blocked = 0;

    if (kind === "bed") {
      const units = hospital.beds.filter((b) => b.bed_type === type);
      supply = units.length;
      busy = units.filter((b) => !b.available).length;
      demand = activePatients.filter((p) => p.required_bed_type === type).length;
      blocked = activePatients.filter(
        (p) => (p.status === "WAITING" || p.status === "UNAVAILABLE") && p.required_bed_type === type
      ).length;
    } else if (kind === "doctor") {
      const units = hospital.doctors.filter((d) => d.specialization === type);
      supply = units.length;
      busy = units.filter((d) => !d.available).length;
      demand = activePatients.filter((p) => p.required_doctor_specialty === type).length;
      blocked = activePatients.filter(
        (p) => (p.status === "WAITING" || p.status === "UNAVAILABLE") && p.required_doctor_specialty === type
      ).length;
    } else {
      const units = hospital.equipment.filter((e) => e.equipment_type === type);
      supply = units.length;
      busy = units.filter((e) => !e.available).length;
      demand = activePatients.filter((p) => p.required_equipment === type).length;
      blocked = activePatients.filter(
        (p) => (p.status === "WAITING" || p.status === "UNAVAILABLE") && p.required_equipment === type
      ).length;
    }

    const shortage = Math.max(0, demand - supply);
    const pressure = supply === 0 ? (demand > 0 ? Infinity : 0) : Math.round((demand / supply) * 10) / 10;
    const pressureStr = supply === 0 ? (demand > 0 ? "∞ (none in inventory)" : "0.0") : pressure.toFixed(1);

    rows.push({
      kind,
      type,
      demand,
      supply,
      busy,
      blocked,
      shortage,
      pressure,
      pressure_str: pressureStr,
    });
  }

  // Sort: highest pressure first, then shortage, then demand
  return rows.sort((a, b) => {
    if (a.pressure !== b.pressure) return b.pressure - a.pressure;
    if (a.shortage !== b.shortage) return b.shortage - a.shortage;
    return b.demand - a.demand;
  });
}

export function computeAdvisor(
  hospital: HospitalInventory,
  patients: Patient[],
  clock: number,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): Advice[] {
  // Baseline clean run
  const cleanBeds = hospital.beds.map((b) => ({ ...b, available: true, assigned_patient_id: undefined }));
  const cleanDocs = hospital.doctors.map((d) => ({ ...d, available: true, assigned_patient_id: undefined }));
  const cleanEqs = hospital.equipment.map((e) => ({ ...e, available: true, assigned_patient_id: undefined }));
  const cleanPatients = patients.map((p) => ({
    ...p,
    status: p.status === "COMPLETED" ? ("COMPLETED" as const) : ("NEW" as const),
    assigned_bed_id: undefined,
    assigned_doctor_id: undefined,
    assigned_equipment_id: undefined,
  }));

  const baseRes = runAllocationEngine(
    { beds: cleanBeds, doctors: cleanDocs, equipment: cleanEqs },
    cleanPatients,
    clock,
    weights,
    "indexed"
  );
  const baseAllocated = new Set(
    baseRes.trace.filter((t) => t.result === "ALLOCATED").map((t) => t.patient_id)
  );

  const adviceList: Advice[] = [];
  const types: Array<{ kind: "bed" | "doctor" | "equipment"; type: string }> = [
    { kind: "bed", type: "ICU" },
    { kind: "bed", type: "EMERGENCY" },
    { kind: "bed", type: "GENERAL" },
    { kind: "doctor", type: "Cardiologist" },
    { kind: "doctor", type: "Neurologist" },
    { kind: "doctor", type: "Physician" },
    { kind: "doctor", type: "Surgeon" },
    { kind: "equipment", type: "Ventilator" },
    { kind: "equipment", type: "ECG" },
    { kind: "equipment", type: "Monitor" },
    { kind: "equipment", type: "MRI" },
    { kind: "equipment", type: "X-Ray" },
  ];

  for (const { kind, type } of types) {
    const testBeds = cleanBeds.map((b) => ({ ...b }));
    const testDocs = cleanDocs.map((d) => ({ ...d }));
    const testEqs = cleanEqs.map((e) => ({ ...e }));

    if (kind === "bed") {
      testBeds.push({
        bed_id: `BED-${type.substring(0, 3)}-${testBeds.length + 1}`,
        bed_type: type as any,
        ward: `${type} Ward`,
        available: true,
        assigned_patient_id: undefined,
      });
    } else if (kind === "doctor") {
      testDocs.push({
        doctor_id: `DOC-${type.substring(0, 4).toUpperCase()}-${testDocs.length + 1}`,
        name: `Dr. Extra ${type}`,
        specialization: type as any,
        available: true,
        assigned_patient_id: undefined,
      });
    } else {
      testEqs.push({
        equipment_id: `EQP-${type.substring(0, 4).toUpperCase()}-${testEqs.length + 1}`,
        equipment_type: type as any,
        location: `Room ${testEqs.length + 1}01`,
        available: true,
        assigned_patient_id: undefined,
      });
    }

    const testPatients = patients.map((p) => ({
      ...p,
      status: p.status === "COMPLETED" ? ("COMPLETED" as const) : ("NEW" as const),
      assigned_bed_id: undefined,
      assigned_doctor_id: undefined,
      assigned_equipment_id: undefined,
    }));

    const testRes = runAllocationEngine(
      { beds: testBeds, doctors: testDocs, equipment: testEqs },
      testPatients,
      clock,
      weights,
      "indexed"
    );
    const testAllocated = new Set(
      testRes.trace.filter((t) => t.result === "ALLOCATED").map((t) => t.patient_id)
    );

    const newlyAllocated: string[] = [];
    testAllocated.forEach((id) => {
      if (!baseAllocated.has(id)) newlyAllocated.push(id);
    });

    const newlyUnserved: string[] = [];
    baseAllocated.forEach((id) => {
      if (!testAllocated.has(id)) newlyUnserved.push(id);
    });

    const deltaAlloc = testRes.metrics.allocated_count - baseRes.metrics.allocated_count;
    const deltaScore = testRes.metrics.weighted_score - baseRes.metrics.weighted_score;

    adviceList.push({
      kind,
      type,
      delta_allocated: deltaAlloc,
      delta_weighted_score: deltaScore,
      newly_allocated_ids: newlyAllocated,
      newly_unserved_ids: newlyUnserved,
      reduces_count: deltaAlloc < 0,
    });
  }

  // Sort by delta_weighted_score desc, delta_allocated desc, type asc
  return adviceList.sort((a, b) => {
    if (a.delta_weighted_score !== b.delta_weighted_score) return b.delta_weighted_score - a.delta_weighted_score;
    if (a.delta_allocated !== b.delta_allocated) return b.delta_allocated - a.delta_allocated;
    return a.type.localeCompare(b.type);
  });
}
