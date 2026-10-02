/**
 * Core type definitions for Smart Hospital Resource Allocation System.
 */

export type BedType = "ICU" | "EMERGENCY" | "GENERAL";
export type DoctorSpecialty = "Cardiologist" | "Neurologist" | "Physician" | "Surgeon";
export type EquipmentType = "Ventilator" | "ECG" | "Monitor" | "MRI" | "X-Ray" | "None";

export type PatientStatus = "NEW" | "ALLOCATED" | "WAITING" | "UNAVAILABLE" | "COMPLETED";
export type PriorityBand = "CRITICAL" | "HIGH" | "NORMAL";

export interface Patient {
  patient_id: string;
  name: string;
  age: number;
  severity: number;
  arrival_minute: number;
  risk: number;
  urgency: number;
  icu_required: number;
  required_bed_type: BedType;
  required_doctor_specialty: DoctorSpecialty;
  required_equipment: EquipmentType;
  length_of_stay_min?: number;

  // Runtime fields
  status: PatientStatus;
  arrival_seq: number;
  waiting_minutes: number;
  waiting_level: number;
  priority: number;
  band: PriorityBand;
  assigned_bed_id?: string;
  assigned_doctor_id?: string;
  assigned_equipment_id?: string;
  allocation_clock?: number;
  reason_codes: string[];
}

export interface Bed {
  bed_id: string;
  bed_type: BedType;
  ward: string;
  available: boolean;
  assigned_patient_id?: string;
}

export interface Doctor {
  doctor_id: string;
  name: string;
  specialization: DoctorSpecialty;
  available: boolean;
  assigned_patient_id?: string;
}

export interface Equipment {
  equipment_id: string;
  equipment_type: EquipmentType;
  location: string;
  available: boolean;
  assigned_patient_id?: string;
}

export interface HospitalInventory {
  beds: Bed[];
  doctors: Doctor[];
  equipment: Equipment[];
}

export interface ScoringWeights {
  severity: number;
  waiting: number;
  risk: number;
  urgency: number;
  icu: number;
}

export interface TraceStep {
  step_no: number;
  patient_id: string;
  patient_name: string;
  priority: number;
  band: PriorityBand;
  heap_size_before: number;
  heap_snapshot?: Array<{
    index: number;
    key: [number, number, number];
    patient_id: string;
    name: string;
    priority: number;
    parent_idx?: number;
    left_idx?: number;
    right_idx?: number;
  }>;
  required: {
    bed: string;
    doctor: string;
    equipment: string;
  };
  checks: {
    bed: string;
    doctor: string;
    equipment: string;
  };
  result: PatientStatus;
  assigned: {
    bed?: string;
    doctor?: string;
    equipment?: string;
  };
  reason_codes: string[];
  unit_checks_used: number;
}

export interface Metrics {
  total_patients: number;
  allocated_count: number;
  waiting_count: number;
  unavailable_count: number;
  completed_count: number;
  not_arrived_count: number;

  beds_total: number;
  beds_busy: number;
  beds_util_pct: number;

  doctors_total: number;
  doctors_busy: number;
  doctors_util_pct: number;

  equipment_total: number;
  equipment_busy: number;
  equipment_util_pct: number;

  overall_total: number;
  overall_busy: number;
  overall_util_pct: number;

  allocation_rate: number;
  avg_priority_all: number;
  avg_priority_allocated: number;
  avg_priority_unserved: number;

  avg_wait_allocated: number;
  avg_wait_unserved: number;
  max_wait_allocated: number;
  max_wait_unserved: number;

  weighted_score: number;
  bypass_count: number;
}

export interface AllocationResult {
  trace: TraceStep[];
  metrics: Metrics;
  ops: {
    heap_comparisons: number;
    unit_checks: number;
  };
  runtime_ms: number;
  strategy: string;
  order: string;
  clock: number;
  bypass_count: number;
}

export interface BottleneckRow {
  kind: "bed" | "doctor" | "equipment";
  type: string;
  demand: number;
  supply: number;
  busy: number;
  blocked: number;
  shortage: number;
  pressure: number;
  pressure_str: string;
}

export interface Advice {
  kind: string;
  type: string;
  delta_allocated: number;
  delta_weighted_score: number;
  newly_allocated_ids: string[];
  newly_unserved_ids: string[];
  reduces_count: boolean;
}

export interface AuditEvent {
  clock: number;
  kind: string;
  details: string;
  timestamp?: string;
}
