import React from "react";
import { motion } from "motion/react";
import {
  Patient,
  HospitalInventory,
  Metrics,
  AllocationResult,
  BottleneckRow,
} from "../types";
import {
  Activity,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  Bed as BedIcon,
  UserCheck,
  Stethoscope,
  TrendingUp,
  Percent,
} from "lucide-react";

interface DashboardViewProps {
  hospital: HospitalInventory;
  patients: Patient[];
  lastResult?: AllocationResult;
  bottlenecks: BottleneckRow[];
  onNavigateToAlgorithm: () => void;
  onNavigateToAllocation: () => void;
  onNavigateToSimulation: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  hospital,
  patients,
  lastResult,
  bottlenecks,
  onNavigateToAlgorithm,
  onNavigateToAllocation,
  onNavigateToSimulation,
}) => {
  const metrics = lastResult?.metrics;

  // Question 1: Who needs help? (Top 5 by priority)
  const topPatients = [...patients]
    .filter((p) => p.status !== "COMPLETED")
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 5);

  // Question 2: What is available?
  const freeBeds = hospital.beds.filter((b) => b.available).length;
  const freeDocs = hospital.doctors.filter((d) => d.available).length;
  const freeEqs = hospital.equipment.filter((e) => e.available).length;

  // Question 3: Who got allocated?
  const allocatedPatients = patients.filter((p) => p.status === "ALLOCATED");

  // Question 4: Who is waiting?
  const waitingPatients = patients.filter((p) => p.status === "WAITING" || p.status === "UNAVAILABLE");

  // Question 5: Why are they waiting? (Aggregate reason codes)
  const reasonSummary: { [code: string]: number } = {};
  waitingPatients.forEach((p) => {
    p.reason_codes.forEach((rc) => {
      reasonSummary[rc] = (reasonSummary[rc] || 0) + 1;
    });
  });
  const topReasons = Object.entries(reasonSummary).map(([code, count]) => {
    const formatted = code.replace(/_/g, " ").toLowerCase();
    return `${formatted} (×${count})`;
  });

  const topBottleneck = bottlenecks[0];

  return (
    <div className="space-y-6">
      {/* 1. SIX-QUESTION STRIP (§15.3) */}
      <section className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
            <Activity className="w-4 h-4 text-blue-600" />
            <span>Executive Triage Strip — Six Core Operational Questions</span>
          </h2>
          <span className="text-xs text-slate-500 font-medium">Real-time dynamic synthesis</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 divide-y md:divide-y-0 md:divide-x divide-slate-200 text-xs">
          {/* Q1 */}
          <div className="p-3 hover:bg-slate-50 transition">
            <span className="font-semibold text-slate-500 block mb-1">1. WHO NEEDS HELP?</span>
            <div className="space-y-1">
              {topPatients.map((p) => (
                <div key={p.patient_id} className="flex justify-between items-center">
                  <span className="font-mono font-medium text-slate-800">{p.patient_id}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded font-bold text-[10px] ${
                      p.band === "CRITICAL"
                        ? "bg-red-100 text-red-700"
                        : p.band === "HIGH"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {p.priority}
                  </span>
                </div>
              ))}
              {topPatients.length === 0 && <span className="text-slate-400">No active patients</span>}
            </div>
          </div>

          {/* Q2 */}
          <div className="p-3 hover:bg-slate-50 transition">
            <span className="font-semibold text-slate-500 block mb-1">2. WHAT IS AVAILABLE?</span>
            <div className="space-y-1 text-slate-700">
              <div className="flex justify-between">
                <span>Beds free:</span>
                <strong className="font-mono">{freeBeds}/{hospital.beds.length}</strong>
              </div>
              <div className="flex justify-between">
                <span>Doctors free:</span>
                <strong className="font-mono">{freeDocs}/{hospital.doctors.length}</strong>
              </div>
              <div className="flex justify-between">
                <span>Equipment free:</span>
                <strong className="font-mono">{freeEqs}/{hospital.equipment.length}</strong>
              </div>
            </div>
          </div>

          {/* Q3 */}
          <div className="p-3 hover:bg-slate-50 transition">
            <span className="font-semibold text-slate-500 block mb-1">3. WHO GOT ALLOCATED?</span>
            <div className="text-slate-800">
              <strong className="text-lg font-bold text-emerald-700">{allocatedPatients.length}</strong>
              <span className="text-slate-500 ml-1">of {patients.length}</span>
              <div className="mt-1 text-[11px] text-slate-600 truncate">
                {allocatedPatients.length > 0
                  ? allocatedPatients.map((p) => p.patient_id).join(", ")
                  : "None yet allocated"}
              </div>
            </div>
          </div>

          {/* Q4 */}
          <div className="p-3 hover:bg-slate-50 transition">
            <span className="font-semibold text-slate-500 block mb-1">4. WHO IS WAITING?</span>
            <div className="text-slate-800">
              <strong className="text-lg font-bold text-amber-600">{waitingPatients.length}</strong>
              <span className="text-slate-500 ml-1">patients</span>
              <div className="mt-1 text-[11px] text-slate-600 truncate">
                {waitingPatients.length > 0
                  ? waitingPatients.map((p) => p.patient_id).join(", ")
                  : "Queue is empty"}
              </div>
            </div>
          </div>

          {/* Q5 */}
          <div className="p-3 hover:bg-slate-50 transition">
            <span className="font-semibold text-slate-500 block mb-1">5. WHY ARE THEY WAITING?</span>
            <div className="space-y-1 text-slate-700">
              {topReasons.length > 0 ? (
                topReasons.slice(0, 3).map((r, i) => (
                  <div key={i} className="truncate text-[11px] text-amber-800">
                    • {r}
                  </div>
                ))
              ) : (
                <span className="text-emerald-700 font-medium">No resource conflicts</span>
              )}
            </div>
          </div>

          {/* Q6 */}
          <div className="p-3 hover:bg-slate-50 transition">
            <span className="font-semibold text-slate-500 block mb-1">6. HOW WAS IT DECIDED?</span>
            <p className="text-slate-700 text-[11px] leading-tight mb-2">
              Hand-written MaxHeap extracts highest priority; atomic greedy matcher assigns Bed + Doc + Eq in $O(1)$.
            </p>
            <button
              onClick={onNavigateToAlgorithm}
              className="text-blue-600 hover:text-blue-800 font-medium text-[11px] underline"
            >
              Inspect Heap & Trace →
            </button>
          </div>
        </div>
      </section>

      {/* 2. TEN KPI CARDS (§15.3) */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.15 }} className="bg-white border border-slate-200 rounded p-3 shadow-xs">
          <div className="flex justify-between items-center text-slate-500 text-xs font-medium">
            <span>Total Patients</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <motion.div
            key={metrics ? metrics.total_patients : patients.length}
            initial={{ scale: 1.15 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.25 }}
            className="text-2xl font-bold font-mono text-slate-800 mt-1"
          >
            {metrics ? metrics.total_patients : patients.length}
          </motion.div>
          <span className="text-[11px] text-slate-400">In hospital registry</span>
        </motion.div>

        <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.15 }} className="bg-white border border-slate-200 rounded p-3 shadow-xs">
          <div className="flex justify-between items-center text-emerald-600 text-xs font-medium">
            <span>Allocated</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <motion.div
            key={metrics ? metrics.allocated_count : allocatedPatients.length}
            initial={{ scale: 1.15 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.25 }}
            className="text-2xl font-bold font-mono text-emerald-700 mt-1"
          >
            {metrics ? metrics.allocated_count : allocatedPatients.length}
          </motion.div>
          <span className="text-[11px] text-emerald-600">
            {metrics ? `${(metrics.allocation_rate * 100).toFixed(0)}% allocation rate` : "Ready to run"}
          </span>
        </motion.div>

        <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.15 }} className="bg-white border border-slate-200 rounded p-3 shadow-xs">
          <div className="flex justify-between items-center text-amber-600 text-xs font-medium">
            <span>Waiting</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <motion.div
            key={metrics ? metrics.waiting_count : waitingPatients.filter((p) => p.status === "WAITING").length}
            initial={{ scale: 1.15 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.25 }}
            className="text-2xl font-bold font-mono text-amber-700 mt-1"
          >
            {metrics ? metrics.waiting_count : waitingPatients.filter((p) => p.status === "WAITING").length}
          </motion.div>
          <span className="text-[11px] text-amber-600">Temporary conflict</span>
        </motion.div>

        <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.15 }} className="bg-white border border-slate-200 rounded p-3 shadow-xs">
          <div className="flex justify-between items-center text-slate-500 text-xs font-medium">
            <span>Unavailable</span>
            <AlertCircle className="w-4 h-4 text-slate-400" />
          </div>
          <motion.div
            key={metrics ? metrics.unavailable_count : waitingPatients.filter((p) => p.status === "UNAVAILABLE").length}
            initial={{ scale: 1.15 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.25 }}
            className="text-2xl font-bold font-mono text-slate-700 mt-1"
          >
            {metrics ? metrics.unavailable_count : waitingPatients.filter((p) => p.status === "UNAVAILABLE").length}
          </motion.div>
          <span className="text-[11px] text-slate-500">Zero inventory deficit</span>
        </motion.div>

        <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.15 }} className="bg-white border border-slate-200 rounded p-3 shadow-xs">
          <div className="flex justify-between items-center text-blue-600 text-xs font-medium">
            <span>Available Beds</span>
            <BedIcon className="w-4 h-4 text-blue-500" />
          </div>
          <motion.div
            key={freeBeds}
            initial={{ scale: 1.15 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.25 }}
            className="text-2xl font-bold font-mono text-blue-700 mt-1"
          >
            {freeBeds} / {hospital.beds.length}
          </motion.div>
          <span className="text-[11px] text-slate-500">
            {metrics ? `${metrics.beds_util_pct}% utilized` : "Inventory ready"}
          </span>
        </motion.div>

        <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.15 }} className="bg-white border border-slate-200 rounded p-3 shadow-xs">
          <div className="flex justify-between items-center text-indigo-600 text-xs font-medium">
            <span>Available Doctors</span>
            <UserCheck className="w-4 h-4 text-indigo-500" />
          </div>
          <motion.div
            key={freeDocs}
            initial={{ scale: 1.15 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.25 }}
            className="text-2xl font-bold font-mono text-indigo-700 mt-1"
          >
            {freeDocs} / {hospital.doctors.length}
          </motion.div>
          <span className="text-[11px] text-slate-500">
            {metrics ? `${metrics.doctors_util_pct}% utilized` : "Specialists on call"}
          </span>
        </motion.div>

        <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.15 }} className="bg-white border border-slate-200 rounded p-3 shadow-xs">
          <div className="flex justify-between items-center text-purple-600 text-xs font-medium">
            <span>Available Equipment</span>
            <Stethoscope className="w-4 h-4 text-purple-500" />
          </div>
          <motion.div
            key={freeEqs}
            initial={{ scale: 1.15 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.25 }}
            className="text-2xl font-bold font-mono text-purple-700 mt-1"
          >
            {freeEqs} / {hospital.equipment.length}
          </motion.div>
          <span className="text-[11px] text-slate-500">
            {metrics ? `${metrics.equipment_util_pct}% utilized` : "Devices online"}
          </span>
        </motion.div>

        <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.15 }} className="bg-white border border-slate-200 rounded p-3 shadow-xs">
          <div className="flex justify-between items-center text-slate-600 text-xs font-medium">
            <span>Overall Utilisation</span>
            <Percent className="w-4 h-4 text-teal-600" />
          </div>
          <motion.div
            key={metrics?.overall_util_pct ?? 0}
            initial={{ scale: 1.15 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.25 }}
            className="text-2xl font-bold font-mono text-teal-800 mt-1"
          >
            {metrics ? `${metrics.overall_util_pct}%` : "—"}
          </motion.div>
          <span className="text-[11px] text-slate-500">All categories combined</span>
        </motion.div>

        <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.15 }} className="bg-white border border-slate-200 rounded p-3 shadow-xs">
          <div className="flex justify-between items-center text-slate-600 text-xs font-medium">
            <span>Average Priority</span>
            <TrendingUp className="w-4 h-4 text-sky-600" />
          </div>
          <motion.div
            key={metrics?.avg_priority_all ?? 0}
            initial={{ scale: 1.15 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.25 }}
            className="text-2xl font-bold font-mono text-sky-800 mt-1"
          >
            {metrics ? metrics.avg_priority_all : "—"}
          </motion.div>
          <span className="text-[11px] text-slate-500">
            Allocated: {metrics ? metrics.avg_priority_allocated : "—"}
          </span>
        </motion.div>

        <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.15 }} className="bg-white border border-slate-200 rounded p-3 shadow-xs">
          <div className="flex justify-between items-center text-slate-600 text-xs font-medium">
            <span>Average Wait</span>
            <Clock className="w-4 h-4 text-rose-600" />
          </div>
          <motion.div
            key={metrics?.avg_wait_allocated ?? 0}
            initial={{ scale: 1.15 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.25 }}
            className="text-2xl font-bold font-mono text-rose-800 mt-1"
          >
            {metrics ? `${metrics.avg_wait_allocated} m` : "—"}
          </motion.div>
          <span className="text-[11px] text-slate-500">
            Max wait: {metrics ? `${metrics.max_wait_allocated} m` : "—"}
          </span>
        </motion.div>
      </section>

      {/* 3. CHARTS 1 & 2: PRIORITY RANKING & STATUS DISTRIBUTION */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Chart 1: Priority Ranking Stacked Bars */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Chart 1: Priority Ranking & Factor Breakdown</h3>
              <p className="text-xs text-slate-500">Who needs help first, and why? (Stacked by 5 terms)</p>
            </div>
            <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
              Highest: {topPatients[0]?.patient_id} ({topPatients[0]?.priority})
            </span>
          </div>

          <div className="space-y-3">
            {topPatients.map((p) => {
              const sTerm = p.severity * 40;
              const wTerm = p.waiting_level * 20;
              const rTerm = p.risk * 15;
              const uTerm = p.urgency * 15;
              const iTerm = p.icu_required * 10;
              const total = p.priority;

              return (
                <div key={p.patient_id} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-mono font-medium text-slate-800">
                      {p.patient_id} ({p.name})
                    </span>
                    <span className="font-bold text-slate-900">{total} pts</span>
                  </div>
                  {/* Multi-segment stacked bar */}
                  <div className="h-4 bg-slate-100 rounded flex overflow-hidden text-[9px] text-white font-mono text-center font-bold">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(sTerm / 460) * 100}%` }}
                      transition={{ duration: 0.55, ease: "easeOut" }}
                      className="bg-red-500 overflow-hidden"
                      title={`Severity: ${sTerm} pts`}
                    >
                      S
                    </motion.div>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(wTerm / 460) * 100}%` }}
                      transition={{ duration: 0.55, ease: "easeOut", delay: 0.04 }}
                      className="bg-amber-500 overflow-hidden"
                      title={`Waiting: ${wTerm} pts`}
                    >
                      W
                    </motion.div>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(rTerm / 460) * 100}%` }}
                      transition={{ duration: 0.55, ease: "easeOut", delay: 0.08 }}
                      className="bg-indigo-500 overflow-hidden"
                      title={`Risk: ${rTerm} pts`}
                    >
                      R
                    </motion.div>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(uTerm / 460) * 100}%` }}
                      transition={{ duration: 0.55, ease: "easeOut", delay: 0.12 }}
                      className="bg-purple-500 overflow-hidden"
                      title={`Urgency: ${uTerm} pts`}
                    >
                      U
                    </motion.div>
                    {iTerm > 0 && (
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(iTerm / 460) * 100}%` }}
                        transition={{ duration: 0.55, ease: "easeOut", delay: 0.16 }}
                        className="bg-rose-700 overflow-hidden"
                        title={`ICU: ${iTerm} pts`}
                      >
                        I
                      </motion.div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-500 mt-4 pt-2 border-t border-slate-100">
            <span className="flex items-center"><span className="w-2 h-2 bg-red-500 rounded-full mr-1"></span> Severity (×40)</span>
            <span className="flex items-center"><span className="w-2 h-2 bg-amber-500 rounded-full mr-1"></span> Waiting (×20)</span>
            <span className="flex items-center"><span className="w-2 h-2 bg-indigo-500 rounded-full mr-1"></span> Risk (×15)</span>
            <span className="flex items-center"><span className="w-2 h-2 bg-purple-500 rounded-full mr-1"></span> Urgency (×15)</span>
            <span className="flex items-center"><span className="w-2 h-2 bg-rose-700 rounded-full mr-1"></span> ICU (×10)</span>
          </div>
        </div>

        {/* Chart 2: Status Breakdown */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Chart 2: Patient Allocation Statuses</h3>
              <p className="text-xs text-slate-500">How many were served vs waiting vs unavailable?</p>
            </div>
            <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
              {metrics ? `${metrics.allocated_count} of ${metrics.total_patients} allocated` : "Not evaluated"}
            </span>
          </div>

          <div className="h-44 flex items-end justify-around pb-2">
            <div className="text-center space-y-1">
              <motion.div
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="w-16 h-28 origin-bottom bg-emerald-100 rounded-t flex items-end justify-center pb-2 border-b-2 border-emerald-600 shadow-2xs"
              >
                <motion.span
                  key={metrics ? metrics.allocated_count : allocatedPatients.length}
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                  className="font-bold text-emerald-800 text-lg"
                >
                  {metrics ? metrics.allocated_count : allocatedPatients.length}
                </motion.span>
              </motion.div>
              <span className="text-xs font-semibold text-emerald-800 block">Allocated</span>
              <span className="text-[10px] text-slate-500">Complete plan committed</span>
            </div>

            <div className="text-center space-y-1">
              <motion.div
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.5, ease: "easeOut", delay: 0.08 }}
                className="w-16 h-28 origin-bottom bg-amber-100 rounded-t flex items-end justify-center pb-2 border-b-2 border-amber-600 shadow-2xs"
              >
                <motion.span
                  key={metrics ? metrics.waiting_count : waitingPatients.filter((p) => p.status === "WAITING").length}
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                  className="font-bold text-amber-800 text-lg"
                >
                  {metrics ? metrics.waiting_count : waitingPatients.filter((p) => p.status === "WAITING").length}
                </motion.span>
              </motion.div>
              <span className="text-xs font-semibold text-amber-800 block">Waiting</span>
              <span className="text-[10px] text-slate-500">Units busy</span>
            </div>

            <div className="text-center space-y-1">
              <motion.div
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.5, ease: "easeOut", delay: 0.16 }}
                className="w-16 h-28 origin-bottom bg-slate-100 rounded-t flex items-end justify-center pb-2 border-b-2 border-slate-500 shadow-2xs"
              >
                <motion.span
                  key={metrics ? metrics.unavailable_count : waitingPatients.filter((p) => p.status === "UNAVAILABLE").length}
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                  className="font-bold text-slate-800 text-lg"
                >
                  {metrics ? metrics.unavailable_count : waitingPatients.filter((p) => p.status === "UNAVAILABLE").length}
                </motion.span>
              </motion.div>
              <span className="text-xs font-semibold text-slate-700 block">Unavailable</span>
              <span className="text-[10px] text-slate-500">Zero inventory</span>
            </div>
          </div>

          <div className="mt-4 pt-2 border-t border-slate-100 text-xs text-slate-600 flex justify-between">
            <span>Priority-Weighted Score: <strong>{metrics ? metrics.weighted_score : 0}</strong></span>
            <span>Bypass Count: <strong>{metrics ? metrics.bypass_count : 0}</strong></span>
          </div>
        </div>
      </section>

      {/* 4. CHARTS 3, 4, 5: RESOURCE CATEGORY UTILISATION */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Chart 3: Bed Utilisation */}
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Chart 3: Bed Utilisation</h3>
          <p className="text-[11px] text-slate-500 mb-2">Busy vs Available by Bed Type</p>
          <div className="space-y-2">
            {["ICU", "EMERGENCY", "GENERAL"].map((bt) => {
              const units = hospital.beds.filter((b) => b.bed_type === bt);
              const busy = units.filter((b) => !b.available).length;
              const total = units.length;
              const pct = total > 0 ? (busy / total) * 100 : 0;
              return (
                <div key={bt}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="font-medium text-slate-700">{bt}</span>
                    <span className="text-slate-500 font-mono">{busy}/{total} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.65, ease: "easeOut" }}
                      className="h-full bg-blue-600 rounded"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chart 4: Doctor Utilisation */}
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Chart 4: Doctor Utilisation</h3>
          <p className="text-[11px] text-slate-500 mb-2">Busy vs Available by Specialty</p>
          <div className="space-y-2">
            {["Cardiologist", "Neurologist", "Physician", "Surgeon"].map((spec) => {
              const units = hospital.doctors.filter((d) => d.specialization === spec);
              const busy = units.filter((d) => !d.available).length;
              const total = units.length;
              const pct = total > 0 ? (busy / total) * 100 : 0;
              return (
                <div key={spec}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="font-medium text-slate-700">{spec}</span>
                    <span className="text-slate-500 font-mono">{busy}/{total} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.65, ease: "easeOut" }}
                      className="h-full bg-indigo-600 rounded"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chart 5: Equipment Utilisation */}
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Chart 5: Equipment Utilisation</h3>
          <p className="text-[11px] text-slate-500 mb-2">Busy vs Available by Device</p>
          <div className="space-y-2">
            {["Ventilator", "ECG", "Monitor", "MRI", "X-Ray"].map((eq) => {
              const units = hospital.equipment.filter((e) => e.equipment_type === eq);
              const busy = units.filter((e) => !e.available).length;
              const total = units.length;
              const pct = total > 0 ? (busy / total) * 100 : 0;
              return (
                <div key={eq}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="font-medium text-slate-700">{eq}</span>
                    <span className="text-slate-500 font-mono">{busy}/{total} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.65, ease: "easeOut" }}
                      className="h-full bg-purple-600 rounded"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. CHART 8: DEMAND VS SUPPLY (BOTTLENECK ANALYSIS) */}
      <section className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
        <div className="flex flex-wrap justify-between items-center border-b border-slate-100 pb-2 mb-3 gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Chart 8: Resource Bottleneck Analysis (Demand vs Supply)</h3>
            <p className="text-xs text-slate-500">Which resource type is creating the primary clinical bottleneck?</p>
          </div>
          {topBottleneck && (
            <div className="bg-amber-50 border border-amber-200 px-3 py-1 rounded text-xs text-amber-900 flex items-center space-x-1.5">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <span>
                <strong>Primary Bottleneck:</strong> {topBottleneck.type} (Pressure: {topBottleneck.pressure_str}, Shortage: {topBottleneck.shortage})
              </span>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2 px-3">Resource Type</th>
                <th className="py-2 px-3">Category</th>
                <th className="py-2 px-3 text-right">Demand</th>
                <th className="py-2 px-3 text-right">Supply</th>
                <th className="py-2 px-3 text-right">Busy</th>
                <th className="py-2 px-3 text-right">Blocked</th>
                <th className="py-2 px-3 text-right">Shortage</th>
                <th className="py-2 px-3 text-right">Pressure</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bottlenecks.map((r) => {
                const isTop = topBottleneck && r.type === topBottleneck.type && r.kind === topBottleneck.kind && r.demand > 0;
                return (
                  <tr key={`${r.kind}-${r.type}`} className={isTop ? "bg-amber-50/70 font-semibold" : "hover:bg-slate-50"}>
                    <td className="py-2 px-3 text-slate-900 flex items-center space-x-1">
                      {isTop && <span className="text-amber-600">⚡</span>}
                      <span>{r.type}</span>
                    </td>
                    <td className="py-2 px-3 text-slate-500 capitalize">{r.kind}</td>
                    <td className="py-2 px-3 text-right font-mono text-slate-800">{r.demand}</td>
                    <td className="py-2 px-3 text-right font-mono text-slate-800">{r.supply}</td>
                    <td className="py-2 px-3 text-right font-mono text-slate-800">{r.busy}</td>
                    <td className="py-2 px-3 text-right font-mono text-amber-700">{r.blocked}</td>
                    <td className="py-2 px-3 text-right font-mono text-red-600 font-bold">{r.shortage}</td>
                    <td className="py-2 px-3 text-right font-mono">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                          r.pressure >= 2.0
                            ? "bg-red-100 text-red-800"
                            : r.pressure > 1.0
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {r.pressure_str}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Footer disclaimer */}
      <footer className="text-center text-xs text-slate-400 pt-4 pb-2 border-t border-slate-100">
        Academic simulation for Design and Analysis of Algorithms evaluation. Not a clinical triage protocol. Do not use for real medical decisions.
      </footer>
    </div>
  );
};
