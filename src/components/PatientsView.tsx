import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Patient, ScoringWeights, BedType, DoctorSpecialty, EquipmentType, HospitalInventory } from "../types";
import { calculatePriority, scoreBreakdown, waitingLevel, DEFAULT_WEIGHTS } from "../algorithms/scoring";
import { UserPlus, Sliders, HelpCircle, AlertCircle, ArrowUp, ArrowDown, Minus } from "lucide-react";

interface PatientsViewProps {
  patients: Patient[];
  hospital: HospitalInventory;
  clock: number;
  weights: ScoringWeights;
  onUpdateWeights: (newWeights: ScoringWeights) => void;
  onResetWeights: () => void;
  onAddPatient: (p: Patient) => void;
  onDeletePatient: (patientId: string) => void;
}

export const PatientsView: React.FC<PatientsViewProps> = ({
  patients,
  hospital,
  clock,
  weights,
  onUpdateWeights,
  onResetWeights,
  onAddPatient,
  onDeletePatient,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeTab, setActiveTab] = useState<"list" | "weightLab">("list");

  // Add Patient Form State
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [newAge, setNewAge] = useState(45);
  const [newSeverity, setNewSeverity] = useState(3);
  const [newArrival, setNewArrival] = useState(clock);
  const [newRisk, setNewRisk] = useState(3);
  const [newUrgency, setNewUrgency] = useState(3);
  const [newIcu, setNewIcu] = useState(0);
  const [newBedType, setNewBedType] = useState<BedType>("GENERAL");
  const [newDoctor, setNewDoctor] = useState<DoctorSpecialty>("Physician");
  const [newEquipment, setNewEquipment] = useState<EquipmentType>("None");
  const [formError, setFormError] = useState<string | null>(null);

  // Auto-suggestion logic for Bed
  const handleIcuChange = (icuVal: number) => {
    setNewIcu(icuVal);
    if (icuVal === 1) {
      setNewBedType("ICU");
    } else if (newSeverity >= 4) {
      setNewBedType("EMERGENCY");
    } else {
      setNewBedType("GENERAL");
    }
  };

  const handleSeverityChange = (sevVal: number) => {
    setNewSeverity(sevVal);
    if (newIcu === 1) {
      setNewBedType("ICU");
    } else if (sevVal >= 4) {
      setNewBedType("EMERGENCY");
    } else {
      setNewBedType("GENERAL");
    }
  };

  const handleCreatePatient = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedId = newId.trim();
    if (!trimmedId) {
      setFormError("Patient ID cannot be blank.");
      return;
    }
    if (patients.some((p) => p.patient_id.toLowerCase() === trimmedId.toLowerCase())) {
      setFormError(`Patient ID '${trimmedId}' already exists.`);
      return;
    }
    if (!newName.trim()) {
      setFormError("Patient name cannot be blank.");
      return;
    }
    if (newIcu === 1 && newBedType !== "ICU") {
      setFormError("ICU requirement is 1, so bed type must be ICU.");
      return;
    }

    const newPatient: Patient = {
      patient_id: trimmedId,
      name: newName.trim(),
      age: Number(newAge),
      severity: Number(newSeverity),
      arrival_minute: Number(newArrival),
      risk: Number(newRisk),
      urgency: Number(newUrgency),
      icu_required: Number(newIcu),
      required_bed_type: newBedType,
      required_doctor_specialty: newDoctor,
      required_equipment: newEquipment,
      length_of_stay_min: 60,
      status: "NEW",
      arrival_seq: patients.length + 1,
      waiting_minutes: Math.max(0, clock - Number(newArrival)),
      waiting_level: waitingLevel(Math.max(0, clock - Number(newArrival))),
      priority: 0,
      band: "NORMAL",
      reason_codes: [],
    };

    onAddPatient(newPatient);
    setShowAddForm(false);
    setNewId("");
    setNewName("");
  };

  // Filtered patients
  const filtered = patients.filter(
    (p) =>
      p.patient_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.required_doctor_specialty.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Weight Lab rank comparison
  const defaultRanked = [...patients]
    .map((p) => {
      const wLvl = waitingLevel(clock - p.arrival_minute);
      const defScore = calculatePriority(p.severity, wLvl, p.risk, p.urgency, p.icu_required, DEFAULT_WEIGHTS);
      const custScore = calculatePriority(p.severity, wLvl, p.risk, p.urgency, p.icu_required, weights);
      return { patient: p, defScore, custScore };
    })
    .sort((a, b) => b.defScore - a.defScore)
    .map((item, defRank) => ({ ...item, defRank: defRank + 1 }));

  const customRanked = [...defaultRanked]
    .sort((a, b) => b.custScore - a.custScore)
    .map((item, custRank) => ({
      ...item,
      custRank: custRank + 1,
      deltaRank: item.defRank - (custRank + 1), // positive means moved up
    }));

  return (
    <div className="space-y-6">
      {/* View Tabs */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-2">
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab("list")}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition ${
              activeTab === "list"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Patient Directory & Triage ({patients.length})
          </button>
          <button
            onClick={() => setActiveTab("weightLab")}
            className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded transition ${
              activeTab === "weightLab"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Priority Weight Lab (§7.12)</span>
          </button>
        </div>

        {activeTab === "list" && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{showAddForm ? "Close Form" : "Add Patient"}</span>
          </button>
        )}
      </div>

      {/* ADD PATIENT FORM */}
      <AnimatePresence>
        {showAddForm && activeTab === "list" && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            onSubmit={handleCreatePatient}
            className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-4 overflow-hidden"
          >
          <div className="flex justify-between items-center border-b border-slate-200 pb-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              New Patient Intake & Clinical Constraints
            </h3>
            <span className="text-[11px] text-slate-500">Auto-suggests compatible bed type</span>
          </div>

          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block text-slate-600 font-medium mb-1">Patient ID *</label>
              <input
                type="text"
                placeholder="e.g. P13"
                value={newId}
                onChange={(e) => setNewId(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 font-mono outline-hidden focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Full Name *</label>
              <input
                type="text"
                placeholder="e.g. Robert Smith"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 outline-hidden focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Age (0 - 120)</label>
              <input
                type="number"
                min="0"
                max="120"
                value={newAge}
                onChange={(e) => setNewAge(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 outline-hidden focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Arrival Minute (min)</label>
              <input
                type="number"
                min="0"
                value={newArrival}
                onChange={(e) => setNewArrival(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 outline-hidden focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block text-slate-600 font-medium mb-1">Severity (1 to 5) *</label>
              <select
                value={newSeverity}
                onChange={(e) => handleSeverityChange(Number(e.target.value))}
                aria-label="Severity"
                className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 outline-hidden focus:ring-1 focus:ring-blue-500 font-medium"
              >
                {[1, 2, 3, 4, 5].map((s) => (
                  <option key={s} value={s}>{s} - {s === 5 ? "Critical" : s === 4 ? "Severe" : s === 3 ? "Moderate" : s === 2 ? "Low" : "Minor"}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Risk of Deterioration</label>
              <select
                value={newRisk}
                onChange={(e) => setNewRisk(Number(e.target.value))}
                aria-label="Risk of Deterioration"
                className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 outline-hidden focus:ring-1 focus:ring-blue-500"
              >
                {[1, 2, 3, 4, 5].map((r) => (
                  <option key={r} value={r}>Level {r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Resource Urgency</label>
              <select
                value={newUrgency}
                onChange={(e) => setNewUrgency(Number(e.target.value))}
                aria-label="Resource Urgency"
                className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 outline-hidden focus:ring-1 focus:ring-blue-500"
              >
                {[1, 2, 3, 4, 5].map((u) => (
                  <option key={u} value={u}>Level {u}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Needs ICU Bed?</label>
              <select
                value={newIcu}
                onChange={(e) => handleIcuChange(Number(e.target.value))}
                aria-label="Needs ICU Bed"
                className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 outline-hidden focus:ring-1 focus:ring-blue-500 font-medium"
              >
                <option value={0}>0 - No</option>
                <option value={1}>1 - Yes (Requires ICU Bed)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block text-slate-600 font-medium mb-1">Required Bed Type *</label>
              <select
                value={newBedType}
                onChange={(e) => setNewBedType(e.target.value as BedType)}
                aria-label="Required Bed Type"
                className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 outline-hidden focus:ring-1 focus:ring-blue-500 font-medium"
              >
                <option value="GENERAL">GENERAL</option>
                <option value="EMERGENCY">EMERGENCY</option>
                <option value="ICU">ICU</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Required Doctor *</label>
              <select
                value={newDoctor}
                onChange={(e) => setNewDoctor(e.target.value as DoctorSpecialty)}
                aria-label="Required Doctor"
                className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 outline-hidden focus:ring-1 focus:ring-blue-500 font-medium"
              >
                <option value="Physician">Physician</option>
                <option value="Cardiologist">Cardiologist</option>
                <option value="Neurologist">Neurologist</option>
                <option value="Surgeon">Surgeon</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Required Equipment</label>
              <select
                value={newEquipment}
                onChange={(e) => setNewEquipment(e.target.value as EquipmentType)}
                aria-label="Required Equipment"
                className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 outline-hidden focus:ring-1 focus:ring-blue-500 font-medium"
              >
                <option value="None">None</option>
                <option value="Ventilator">Ventilator</option>
                <option value="ECG">ECG</option>
                <option value="Monitor">Monitor</option>
                <option value="MRI">MRI</option>
                <option value="X-Ray">X-Ray</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-medium rounded transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded shadow-xs transition"
            >
              Add to Registry
            </button>
          </div>
        </motion.form>
      )}
    </AnimatePresence>

      {/* TAB 1: PATIENT LIST */}
      {activeTab === "list" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <input
              type="text"
              placeholder="Search by ID, Name, or Specialty..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white border border-slate-200 rounded px-3 py-1.5 text-xs text-slate-800 w-72 outline-hidden focus:ring-1 focus:ring-blue-500"
            />
            <span className="text-xs text-slate-500 font-medium">
              Showing {filtered.length} of {patients.length} patients
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Patient ID</th>
                  <th className="py-2.5 px-3">Name</th>
                  <th className="py-2.5 px-3">Age</th>
                  <th className="py-2.5 px-3">Severity</th>
                  <th className="py-2.5 px-3">Arrival</th>
                  <th className="py-2.5 px-3">Waited</th>
                  <th className="py-2.5 px-3">Requirements (Bed / Doc / Eq)</th>
                  <th className="py-2.5 px-3">Priority Score</th>
                  <th className="py-2.5 px-3">Band</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => {
                  const isSelected = selectedPatientId === p.patient_id;
                  const breakdown = scoreBreakdown(
                    p.severity,
                    waitingLevel(clock - p.arrival_minute),
                    p.risk,
                    p.urgency,
                    p.icu_required,
                    weights
                  );

                  return (
                    <React.Fragment key={p.patient_id}>
                      <tr className={`hover:bg-slate-50 transition ${isSelected ? "bg-blue-50/50" : ""}`}>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{p.patient_id}</td>
                        <td className="py-2.5 px-3 text-slate-800 font-medium">{p.name}</td>
                        <td className="py-2.5 px-3 text-slate-600">{p.age}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                              p.severity >= 4
                                ? "bg-red-100 text-red-700"
                                : p.severity === 3
                                ? "bg-amber-100 text-amber-700"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {p.severity} / 5
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 font-mono">T+{p.arrival_minute}m</td>
                        <td className="py-2.5 px-3 text-slate-600 font-mono">
                          {Math.max(0, clock - p.arrival_minute)}m (L{waitingLevel(clock - p.arrival_minute)})
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          <span className="font-semibold text-slate-900">{p.required_bed_type}</span> +{" "}
                          <span>{p.required_doctor_specialty}</span>
                          {p.required_equipment !== "None" && (
                            <span className="text-purple-700 font-medium"> + {p.required_equipment}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          <div className="flex items-center space-x-1.5">
                            <span>{p.priority || breakdown.total}</span>
                            <div className="w-16 bg-slate-100 h-2 rounded overflow-hidden">
                              <div
                                style={{ width: `${((p.priority || breakdown.total) / 460) * 100}%` }}
                                className="h-full bg-blue-600 rounded"
                              ></div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                              p.band === "CRITICAL"
                                ? "bg-red-100 text-red-700"
                                : p.band === "HIGH"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {p.band}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              p.status === "ALLOCATED"
                                ? "bg-emerald-100 text-emerald-800"
                                : p.status === "WAITING"
                                ? "bg-amber-100 text-amber-800"
                                : p.status === "UNAVAILABLE"
                                ? "bg-slate-100 text-slate-700"
                                : p.status === "COMPLETED"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-blue-50 text-blue-700"
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right space-x-2">
                          <button
                            onClick={() => setSelectedPatientId(isSelected ? null : p.patient_id)}
                            className="text-blue-600 hover:text-blue-800 font-medium text-[11px]"
                          >
                            {isSelected ? "Hide Why" : "Why?"}
                          </button>
                          <button
                            onClick={() => onDeletePatient(p.patient_id)}
                            className="text-red-500 hover:text-red-700 font-medium text-[11px]"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>

                      {/* Expandable Why & Score Breakdown row */}
                      {isSelected && (
                        <tr className="bg-blue-50/40">
                          <td colSpan={11} className="p-0 border-t border-blue-100">
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.22, ease: "easeOut" }}
                              className="p-3 text-xs text-slate-700 overflow-hidden"
                            >
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Left: Score breakdown */}
                                <div>
                                  <h4 className="font-bold text-slate-800 mb-1 flex items-center space-x-1">
                                    <span>Priority Score Breakdown ({p.priority || breakdown.total} pts):</span>
                                  </h4>
                                  <div className="space-y-1 text-[11px] font-mono">
                                    <div>• Severity: {p.severity} × {weights.severity} = <strong>{breakdown.severity}</strong></div>
                                    <div>• Waiting Level: L{waitingLevel(clock - p.arrival_minute)} × {weights.waiting} = <strong>{breakdown.waiting}</strong></div>
                                    <div>• Risk Deterioration: {p.risk} × {weights.risk} = <strong>{breakdown.risk}</strong></div>
                                    <div>• Resource Urgency: {p.urgency} × {weights.urgency} = <strong>{breakdown.urgency}</strong></div>
                                    <div>• ICU Flag: {p.icu_required} × {weights.icu} = <strong>{breakdown.icu}</strong></div>
                                  </div>
                                </div>

                                {/* Right: Diagnostic why */}
                                <div>
                                  <h4 className="font-bold text-slate-800 mb-1">Status Explanation & Blockers:</h4>
                                  {p.status === "ALLOCATED" ? (
                                    <p className="text-emerald-800 text-[11px]">
                                      ✓ Fully allocated: Bed {p.assigned_bed_id}, Doctor {p.assigned_doctor_id}
                                      {p.assigned_equipment_id ? `, Equipment ${p.assigned_equipment_id}` : ""}.
                                    </p>
                                  ) : p.status === "WAITING" || p.status === "UNAVAILABLE" ? (
                                    <div className="space-y-1 text-[11px]">
                                      <p className="text-amber-800 font-medium">
                                        {p.status === "WAITING" ? "⏳ Temporarily waiting for busy resources:" : "⛔ Inventory deficit:"}
                                      </p>
                                      <ul className="list-disc list-inside text-slate-700 space-y-0.5">
                                        {p.reason_codes.map((rc, i) => (
                                          <li key={i}>{rc.replace(/_/g, " ")}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  ) : (
                                    <p className="text-slate-500 text-[11px]">Patient loaded, awaiting allocation run.</p>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: WEIGHT LAB (§7.12) */}
      {activeTab === "weightLab" && (
        <div className="space-y-6 bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <div className="flex flex-wrap justify-between items-center border-b border-slate-200 pb-3 gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Priority Weight Lab & Sensitivity Analysis</h3>
              <p className="text-xs text-slate-500">
                Adjust scoring terms to observe live rank shifts and ethical policy trade-offs.
              </p>
            </div>
            <button
              onClick={onResetWeights}
              className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded transition"
            >
              Reset to Defaults (40 / 20 / 15 / 15 / 10)
            </button>
          </div>

          {/* Weight Sliders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs">
            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span>Severity ($S$):</span>
                <strong className="text-blue-600">{weights.severity}</strong>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={weights.severity}
                onChange={(e) => onUpdateWeights({ ...weights, severity: Number(e.target.value) })}
                className="w-full cursor-pointer accent-blue-600"
              />
            </div>
            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span>Waiting Aging ($W$):</span>
                <strong className="text-blue-600">{weights.waiting}</strong>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={weights.waiting}
                onChange={(e) => onUpdateWeights({ ...weights, waiting: Number(e.target.value) })}
                className="w-full cursor-pointer accent-blue-600"
              />
            </div>
            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span>Risk Factor ($R$):</span>
                <strong className="text-blue-600">{weights.risk}</strong>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={weights.risk}
                onChange={(e) => onUpdateWeights({ ...weights, risk: Number(e.target.value) })}
                className="w-full cursor-pointer accent-blue-600"
              />
            </div>
            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span>Urgency ($U$):</span>
                <strong className="text-blue-600">{weights.urgency}</strong>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={weights.urgency}
                onChange={(e) => onUpdateWeights({ ...weights, urgency: Number(e.target.value) })}
                className="w-full cursor-pointer accent-blue-600"
              />
            </div>
            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span>ICU Need ($I$):</span>
                <strong className="text-blue-600">{weights.icu}</strong>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={weights.icu}
                onChange={(e) => onUpdateWeights({ ...weights, icu: Number(e.target.value) })}
                className="w-full cursor-pointer accent-blue-600"
              />
            </div>
          </div>

          {/* Rank Shift Comparison Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3">Patient</th>
                  <th className="py-2 px-3">Default Score</th>
                  <th className="py-2 px-3">Custom Score</th>
                  <th className="py-2 px-3 text-center">Default Rank</th>
                  <th className="py-2 px-3 text-center">Custom Rank</th>
                  <th className="py-2 px-3 text-center">Δ Rank</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {customRanked.map((item) => {
                  return (
                    <tr key={item.patient.patient_id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 text-slate-900 font-bold">
                        {item.patient.patient_id} ({item.patient.name})
                      </td>
                      <td className="py-2 px-3 text-slate-600">{item.defScore}</td>
                      <td className="py-2 px-3 text-blue-700 font-bold">{item.custScore}</td>
                      <td className="py-2 px-3 text-center text-slate-500">#{item.defRank}</td>
                      <td className="py-2 px-3 text-center font-bold text-slate-800">#{item.custRank}</td>
                      <td className="py-2 px-3 text-center">
                        {item.deltaRank > 0 ? (
                          <span className="text-emerald-600 font-bold flex items-center justify-center space-x-0.5">
                            <ArrowUp className="w-3.5 h-3.5" />
                            <span>+{item.deltaRank}</span>
                          </span>
                        ) : item.deltaRank < 0 ? (
                          <span className="text-red-500 font-bold flex items-center justify-center space-x-0.5">
                            <ArrowDown className="w-3.5 h-3.5" />
                            <span>{item.deltaRank}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 flex items-center justify-center">
                            <Minus className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
