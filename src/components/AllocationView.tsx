import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AllocationResult, Patient, AuditEvent } from "../types";
import { Play, RotateCcw, UserMinus, History, FileText } from "lucide-react";

interface AllocationViewProps {
  lastResult?: AllocationResult;
  patients: Patient[];
  strategy: "indexed" | "baseline";
  order: "priority" | "fcfs";
  onSetStrategy: (s: "indexed" | "baseline") => void;
  onSetOrder: (o: "priority" | "fcfs") => void;
  onRunAllocation: () => void;
  onReset: () => void;
  onDischargePatient: (patientId: string) => void;
  eventLog: AuditEvent[];
}

export const AllocationView: React.FC<AllocationViewProps> = ({
  lastResult,
  patients,
  strategy,
  order,
  onSetStrategy,
  onSetOrder,
  onRunAllocation,
  onReset,
  onDischargePatient,
  eventLog,
}) => {
  const [showLog, setShowLog] = useState(false);

  const waitingQueue = patients
    .filter((p) => p.status === "WAITING" || p.status === "UNAVAILABLE")
    .sort((a, b) => b.priority - a.priority);

  const allocatedPatients = patients.filter((p) => p.status === "ALLOCATED");

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2 text-xs">
            <span className="font-semibold text-slate-700">Strategy:</span>
            <select
              value={strategy}
              onChange={(e) => onSetStrategy(e.target.value as any)}
              aria-label="Strategy"
              className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-slate-800 font-medium outline-hidden"
            >
              <option value="indexed">Strategy C: Indexed Lookups (O(1))</option>
              <option value="baseline">Strategy A: Baseline Combinatorial (O(B·D·E))</option>
            </select>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <span className="font-semibold text-slate-700">Order:</span>
            <select
              value={order}
              onChange={(e) => onSetOrder(e.target.value as any)}
              aria-label="Order"
              className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-slate-800 font-medium outline-hidden"
            >
              <option value="priority">Priority Queue (MaxHeap)</option>
              <option value="fcfs">First-Come, First-Served (FCFS)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onRunAllocation}
            className="flex items-center space-x-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded shadow-xs transition"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Run Allocation</span>
          </button>
          <button
            onClick={onReset}
            className="flex items-center space-x-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* EXECUTION TRACE TABLE */}
      <section className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              DAA Step-by-Step Execution Trace Table
            </h3>
            <p className="text-[11px] text-slate-500">
              Deterministic sequential decisions extracted from MaxHeap root.
            </p>
          </div>
          {lastResult && (
            <div className="text-xs text-slate-600 flex items-center space-x-3 font-mono">
              <span>Unit checks: <strong>{lastResult.ops.unit_checks}</strong></span>
              <span>Runtime: <strong>{lastResult.runtime_ms} ms</strong></span>
            </div>
          )}
        </div>

        {lastResult && lastResult.trace.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/60 text-slate-500 font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-2.5 px-3">Step</th>
                  <th className="py-2.5 px-3">Patient</th>
                  <th className="py-2.5 px-3">Priority</th>
                  <th className="py-2.5 px-3">Bed Check</th>
                  <th className="py-2.5 px-3">Doctor Check</th>
                  <th className="py-2.5 px-3">Equipment Check</th>
                  <th className="py-2.5 px-3">Result</th>
                  <th className="py-2.5 px-3 text-right">Checks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {lastResult.trace.map((t) => (
                  <motion.tr
                    key={t.step_no}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.28, delay: t.step_no * 0.04 }}
                    className="hover:bg-slate-50 transition"
                  >
                    <td className="py-2.5 px-3 font-bold text-slate-400">#{t.step_no}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      {t.patient_id} ({t.patient_name})
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                          t.band === "CRITICAL"
                            ? "bg-red-100 text-red-700"
                            : t.band === "HIGH"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {t.priority}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[11px]">
                      <span
                        className={
                          t.checks.bed.startsWith("✓")
                            ? "text-emerald-700 font-medium"
                            : t.checks.bed.includes("candidate")
                            ? "text-blue-700 font-medium"
                            : "text-red-600"
                        }
                      >
                        {t.checks.bed}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[11px]">
                      <span
                        className={
                          t.checks.doctor.startsWith("✓")
                            ? "text-emerald-700 font-medium"
                            : t.checks.doctor.includes("candidate")
                            ? "text-blue-700 font-medium"
                            : "text-red-600"
                        }
                      >
                        {t.checks.doctor}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[11px]">
                      <span
                        className={
                          t.checks.equipment.startsWith("✓")
                            ? "text-emerald-700 font-medium"
                            : t.checks.equipment.includes("candidate")
                            ? "text-blue-700 font-medium"
                            : t.checks.equipment === "—"
                            ? "text-slate-400"
                            : "text-red-600"
                        }
                      >
                        {t.checks.equipment}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.result === "ALLOCATED"
                            ? "bg-emerald-100 text-emerald-800"
                            : t.result === "WAITING"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {t.result}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-slate-500">
                      {t.unit_checks_used}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400 text-xs">
            Run the allocation to generate the full step-by-step DAA execution trace.
          </div>
        )}
      </section>

      {/* WAITING QUEUE & DISCHARGE ACTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Waiting Queue */}
        <section className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Waiting Queue with Blocker Reasons ({waitingQueue.length})
            </h3>
            <span className="text-[11px] text-slate-500 font-medium">Sorted by priority desc</span>
          </div>

          {waitingQueue.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="py-2 px-3">Patient</th>
                    <th className="py-2 px-3">Priority</th>
                    <th className="py-2 px-3">Requirements</th>
                    <th className="py-2 px-3">Blocker Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {waitingQueue.map((p) => (
                    <tr key={p.patient_id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono font-bold text-slate-800">
                        {p.patient_id} ({p.name})
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-slate-900">{p.priority}</td>
                      <td className="py-2 px-3 text-slate-600">
                        {p.required_bed_type} + {p.required_doctor_specialty}
                        {p.required_equipment !== "None" ? ` + ${p.required_equipment}` : ""}
                      </td>
                      <td className="py-2 px-3 text-amber-700 font-medium">
                        {p.reason_codes.join(", ") || "Waiting for unit availability"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 text-center text-slate-400 text-xs">Waiting queue is empty.</div>
          )}
        </section>

        {/* Active Allocations & Discharge */}
        <section className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Active Allocations & Discharge ({allocatedPatients.length})
            </h3>
            <span className="text-[11px] text-slate-500 font-medium">Discharge frees units</span>
          </div>

          {allocatedPatients.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="py-2 px-3">Patient</th>
                    <th className="py-2 px-3">Assigned Units</th>
                    <th className="py-2 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allocatedPatients.map((p) => (
                    <tr key={p.patient_id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono font-bold text-slate-800">
                        {p.patient_id} ({p.name})
                      </td>
                      <td className="py-2 px-3 text-slate-600 font-mono text-[11px]">
                        {p.assigned_bed_id} | {p.assigned_doctor_id}
                        {p.assigned_equipment_id ? ` | ${p.assigned_equipment_id}` : ""}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button
                          onClick={() => onDischargePatient(p.patient_id)}
                          className="flex items-center space-x-1 px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium text-[11px] rounded transition ml-auto"
                        >
                          <UserMinus className="w-3 h-3" />
                          <span>Discharge</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 text-center text-slate-400 text-xs">No patients currently allocated.</div>
          )}
        </section>
      </div>

      {/* EVENT LOG AUDIT TRAIL */}
      <section className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <History className="w-4 h-4 text-slate-500" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Event Log & State Audit Trail ({eventLog.length} events)
            </h3>
          </div>
          <button
            onClick={() => setShowLog(!showLog)}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            {showLog ? "Hide Log" : "View Log"}
          </button>
        </div>

        <AnimatePresence>
          {showLog && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="mt-3 bg-slate-50 rounded border border-slate-200 p-3 max-h-48 overflow-y-auto font-mono text-[11px] space-y-1">
                {eventLog.map((e, idx) => (
                  <div key={idx} className="flex space-x-3 text-slate-700">
                    <span className="text-slate-400 font-semibold">[T+{e.clock}m]</span>
                    <span className="font-bold text-blue-700">{e.kind}</span>
                    <span className="text-slate-600">{e.details}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  );
};
