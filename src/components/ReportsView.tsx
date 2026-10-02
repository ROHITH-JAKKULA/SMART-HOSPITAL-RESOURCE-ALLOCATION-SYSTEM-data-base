import React, { useState } from "react";
import { Patient, HospitalInventory, AllocationResult, AuditEvent } from "../types";
import { Download, FileSpreadsheet, Code, Check } from "lucide-react";

interface ReportsViewProps {
  hospital: HospitalInventory;
  patients: Patient[];
  lastResult?: AllocationResult;
  clock: number;
  eventLog: AuditEvent[];
  onImportScenario: (scenario: any) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  hospital,
  patients,
  lastResult,
  clock,
  eventLog,
  onImportScenario,
}) => {
  const [copiedJson, setCopiedJson] = useState(false);
  const [jsonInput, setJsonInput] = useState("");
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // CSV sanitization helper against formula injection
  const sanitize = (val: any): string => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str && ["=", "+", "-", "@", "\t", "\r"].includes(str[0])) {
      return `'${str}`;
    }
    return str;
  };

  const triggerDownload = (filename: string, content: string) => {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 1. Patient Report CSV
  const downloadPatientReport = () => {
    const headers = [
      "patient_id", "name", "age", "severity", "waiting_minutes", "waiting_level",
      "risk", "urgency", "icu_required", "bed_type", "doctor_specialty", "equipment",
      "priority", "band", "status"
    ];
    const rows = patients.map((p) => [
      sanitize(p.patient_id),
      sanitize(p.name),
      p.age,
      p.severity,
      p.waiting_minutes,
      p.waiting_level,
      p.risk,
      p.urgency,
      p.icu_required,
      sanitize(p.required_bed_type),
      sanitize(p.required_doctor_specialty),
      sanitize(p.required_equipment),
      p.priority,
      p.band,
      p.status
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    triggerDownload(`patient_report_${Date.now()}.csv`, csv);
  };

  // 2. Allocation Report CSV
  const downloadAllocationReport = () => {
    const headers = [
      "patient_id", "name", "priority", "bed_id", "doctor_id", "doctor_name",
      "equipment_id", "allocation_time", "wait_at_allocation", "status"
    ];
    const rows = patients.map((p) => {
      const doc = hospital.doctors.find((d) => d.doctor_id === p.assigned_doctor_id);
      return [
        sanitize(p.patient_id),
        sanitize(p.name),
        p.priority,
        sanitize(p.assigned_bed_id || ""),
        sanitize(p.assigned_doctor_id || ""),
        sanitize(doc?.name || ""),
        sanitize(p.assigned_equipment_id || ""),
        p.allocation_clock !== undefined ? p.allocation_clock : "",
        p.allocation_clock !== undefined ? p.allocation_clock - p.arrival_minute : "",
        p.status
      ];
    });
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    triggerDownload(`allocation_report_${Date.now()}.csv`, csv);
  };

  // 3. Waiting Queue Report CSV
  const downloadWaitingQueueReport = () => {
    const headers = ["patient_id", "priority", "required_bed", "required_doctor", "required_equipment", "status", "reason_codes"];
    const waiting = patients.filter((p) => p.status === "WAITING" || p.status === "UNAVAILABLE");
    const rows = waiting.map((p) => [
      sanitize(p.patient_id),
      p.priority,
      sanitize(p.required_bed_type),
      sanitize(p.required_doctor_specialty),
      sanitize(p.required_equipment),
      p.status,
      sanitize(p.reason_codes.join("; "))
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    triggerDownload(`waiting_queue_report_${Date.now()}.csv`, csv);
  };

  // 4. Resource Utilisation Report CSV
  const downloadUtilReport = () => {
    const headers = ["category", "type", "total", "busy", "free", "utilization_pct"];
    const rows: any[] = [];
    ["ICU", "EMERGENCY", "GENERAL"].forEach((bt) => {
      const units = hospital.beds.filter((b) => b.bed_type === bt);
      const busy = units.filter((b) => !b.available).length;
      rows.push(["Bed", bt, units.length, busy, units.length - busy, units.length > 0 ? ((busy / units.length) * 100).toFixed(1) : 0]);
    });
    ["Cardiologist", "Neurologist", "Physician", "Surgeon"].forEach((ds) => {
      const units = hospital.doctors.filter((d) => d.specialization === ds);
      const busy = units.filter((d) => !d.available).length;
      rows.push(["Doctor", ds, units.length, busy, units.length - busy, units.length > 0 ? ((busy / units.length) * 100).toFixed(1) : 0]);
    });
    ["Ventilator", "ECG", "Monitor", "MRI", "X-Ray"].forEach((et) => {
      const units = hospital.equipment.filter((e) => e.equipment_type === et);
      const busy = units.filter((e) => !e.available).length;
      rows.push(["Equipment", et, units.length, busy, units.length - busy, units.length > 0 ? ((busy / units.length) * 100).toFixed(1) : 0]);
    });
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    triggerDownload(`resource_utilization_report_${Date.now()}.csv`, csv);
  };

  // 5. Algorithm Execution Report CSV
  const downloadTraceReport = () => {
    if (!lastResult) return;
    const headers = [
      "step", "patient_id", "priority", "heap_size_before", "bed_check",
      "doctor_check", "equipment_check", "result", "assigned_units", "reason_codes", "unit_checks_used"
    ];
    const rows = lastResult.trace.map((t) => [
      t.step_no,
      sanitize(t.patient_id),
      t.priority,
      t.heap_size_before,
      sanitize(t.checks.bed),
      sanitize(t.checks.doctor),
      sanitize(t.checks.equipment),
      t.result,
      sanitize(Object.entries(t.assigned).filter(([_, v]) => v).map(([k, v]) => `${k}:${v}`).join("; ")),
      sanitize(t.reason_codes.join("; ")),
      t.unit_checks_used
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    triggerDownload(`algorithm_execution_report_${Date.now()}.csv`, csv);
  };

  // JSON Scenario Export
  const scenarioJson = JSON.stringify(
    {
      version: 1,
      clock,
      hospital,
      patients,
    },
    null,
    2
  );

  const handleCopyJson = () => {
    navigator.clipboard.writeText(scenarioJson);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const handleImportJson = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      if (parsed.version !== 1) {
        setImportStatus("Error: Unsupported scenario version. Expected version: 1.");
        return;
      }
      onImportScenario(parsed);
      setImportStatus("Success: Scenario imported successfully!");
    } catch (e: any) {
      setImportStatus(`Error: Invalid JSON syntax (${e.message})`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-3">
        <h2 className="text-sm font-bold text-slate-800">CSV Reports & JSON Scenario Data Exchange</h2>
        <p className="text-xs text-slate-500">
          Export verified algorithm outputs with built-in CSV formula injection protection.
        </p>
      </div>

      {/* CSV Reports Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Report 1 */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 text-slate-800 font-bold text-xs">
              <FileSpreadsheet className="w-4 h-4 text-blue-600" />
              <span>patient_report.csv</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Full patient census, demographics, severity, clinical requirements, and priority scores.
            </p>
          </div>
          <button
            onClick={downloadPatientReport}
            className="w-full mt-3 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 font-semibold text-xs rounded transition flex items-center justify-center space-x-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download CSV</span>
          </button>
        </div>

        {/* Report 2 */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 text-slate-800 font-bold text-xs">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>allocation_report.csv</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Assigned bed, doctor, and device IDs per patient with timestamps and wait times.
            </p>
          </div>
          <button
            onClick={downloadAllocationReport}
            className="w-full mt-3 py-1.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 font-semibold text-xs rounded transition flex items-center justify-center space-x-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download CSV</span>
          </button>
        </div>

        {/* Report 3 */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 text-slate-800 font-bold text-xs">
              <FileSpreadsheet className="w-4 h-4 text-amber-600" />
              <span>waiting_queue_report.csv</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              All waiting and unavailable patients with detailed diagnostic blocker reason codes.
            </p>
          </div>
          <button
            onClick={downloadWaitingQueueReport}
            className="w-full mt-3 py-1.5 bg-slate-100 hover:bg-amber-50 hover:text-amber-700 text-slate-700 font-semibold text-xs rounded transition flex items-center justify-center space-x-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download CSV</span>
          </button>
        </div>

        {/* Report 4 */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 text-slate-800 font-bold text-xs">
              <FileSpreadsheet className="w-4 h-4 text-purple-600" />
              <span>resource_utilization_report.csv</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Capacity breakdown across all 12 resource types with total, busy, free, and percentage utilisation.
            </p>
          </div>
          <button
            onClick={downloadUtilReport}
            className="w-full mt-3 py-1.5 bg-slate-100 hover:bg-purple-50 hover:text-purple-700 text-slate-700 font-semibold text-xs rounded transition flex items-center justify-center space-x-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download CSV</span>
          </button>
        </div>

        {/* Report 5 */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 text-slate-800 font-bold text-xs">
              <FileSpreadsheet className="w-4 h-4 text-rose-600" />
              <span>algorithm_execution_report.csv</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Full step-by-step trace showing priority extraction, constraint checks, and unit check ops.
            </p>
          </div>
          <button
            onClick={downloadTraceReport}
            disabled={!lastResult}
            className={`w-full mt-3 py-1.5 font-semibold text-xs rounded transition flex items-center justify-center space-x-1.5 ${
              lastResult
                ? "bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700"
                : "bg-slate-50 text-slate-300 cursor-not-allowed"
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>{lastResult ? "Download CSV" : "Run Allocation First"}</span>
          </button>
        </div>
      </section>

      {/* JSON SCENARIO ROUNDTRIP (§12.4, T30) */}
      <section className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
          <div className="flex items-center space-x-2">
            <Code className="w-4 h-4 text-slate-600" />
            <h3 className="text-sm font-bold text-slate-800">Lossless JSON Scenario Save & Load (F24)</h3>
          </div>
          <button
            onClick={handleCopyJson}
            className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded transition flex items-center space-x-1"
          >
            {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : null}
            <span>{copiedJson ? "Copied!" : "Copy Active Scenario JSON"}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
          {/* Current State Export Preview */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700">Export: Active State JSON (Version 1)</label>
            <textarea
              readOnly
              value={scenarioJson}
              className="w-full h-44 bg-slate-50 border border-slate-200 rounded p-2.5 font-mono text-[11px] text-slate-700 select-all"
            />
          </div>

          {/* Import Scenario Input */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700">Import: Paste Scenario JSON</label>
            <textarea
              placeholder="Paste valid JSON scenario with version: 1..."
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              className="w-full h-32 bg-white border border-slate-200 rounded p-2.5 font-mono text-[11px] text-slate-800 outline-hidden focus:ring-1 focus:ring-blue-500"
            />
            {importStatus && (
              <div
                className={`p-2 rounded text-[11px] font-medium ${
                  importStatus.startsWith("Success")
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}
              >
                {importStatus}
              </div>
            )}
            <button
              onClick={handleImportJson}
              className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded transition"
            >
              Validate & Load Scenario
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
