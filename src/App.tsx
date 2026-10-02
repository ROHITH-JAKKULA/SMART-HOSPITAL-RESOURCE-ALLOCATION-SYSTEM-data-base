import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  HospitalInventory,
  Patient,
  AllocationResult,
  ScoringWeights,
  AuditEvent,
} from "./types";
import { DEFAULT_WEIGHTS } from "./algorithms/scoring";
import {
  getGoldenHospital,
  getGoldenPatients,
  getDemoHospital,
  getDemoPatients,
} from "./data/goldenDataset";
import { runAllocationEngine, computeBottleneckTable } from "./algorithms/greedyAllocator";

import { HeaderBanner } from "./components/HeaderBanner";
import { DashboardView } from "./components/DashboardView";
import { PatientsView } from "./components/PatientsView";
import { ResourcesView } from "./components/ResourcesView";
import { AllocationView } from "./components/AllocationView";
import { AlgorithmView } from "./components/AlgorithmView";
import { SimulationView } from "./components/SimulationView";
import { ReportsView } from "./components/ReportsView";
import { FirebaseAuthPanel } from "./components/FirebaseAuthPanel";
import { DemoModeView } from "./components/DemoModeView";
import { VivaPrepView } from "./components/VivaPrepView";
import { AboutView } from "./components/AboutView";

import {
  LayoutDashboard,
  Users,
  BedDouble,
  Zap,
  Cpu,
  FlaskConical,
  FileSpreadsheet,
  GraduationCap,
  Info,
  Target,
} from "lucide-react";

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState<
    | "demoMode"
    | "dashboard"
    | "patients"
    | "resources"
    | "allocation"
    | "algorithm"
    | "simulation"
    | "reports"
    | "viva"
    | "about"
  >("dashboard");

  // Core Simulation State (Pre-loaded with Golden Dataset per §15.1 Cold Start)
  const [datasetName, setDatasetName] = useState<"golden" | "demo">("golden");
  const [hospital, setHospital] = useState<HospitalInventory>(getGoldenHospital());
  const [patients, setPatients] = useState<Patient[]>(getGoldenPatients());
  const [clock, setClock] = useState<number>(120);
  const [weights, setWeights] = useState<ScoringWeights>(DEFAULT_WEIGHTS);

  // Allocator Options
  const [strategy, setStrategy] = useState<"indexed" | "baseline">("indexed");
  const [order, setOrder] = useState<"priority" | "fcfs">("priority");

  // Results & History State
  const [lastResult, setLastResult] = useState<AllocationResult | undefined>();
  const [undoStack, setUndoStack] = useState<
    Array<{
      hospital: HospitalInventory;
      patients: Patient[];
      clock: number;
      weights: ScoringWeights;
    }>
  >([]);
  const [eventLog, setEventLog] = useState<AuditEvent[]>([
    {
      clock: 120,
      kind: "SCENARIO_LOADED",
      details: "Golden scenario loaded (4 patients, 5 beds, 3 doctors, 4 equipment)",
    },
  ]);
  const [toast, setToast] = useState<{ message: string; type?: "info" | "success" } | null>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  // Log audit events & fire toast
  const addEvent = useCallback((kind: string, details: string) => {
    setEventLog((prev) => [{ clock, kind, details }, ...prev]);
    setToast({
      message: `${kind.replace(/_/g, " ")}: ${details}`,
      type: "info",
    });
  }, [clock]);

  // Push undo snapshot
  const pushUndo = useCallback(() => {
    setUndoStack((prev) => [
      {
        hospital: JSON.parse(JSON.stringify(hospital)),
        patients: JSON.parse(JSON.stringify(patients)),
        clock,
        weights: { ...weights },
      },
      ...prev.slice(0, 9), // Depth 10
    ]);
  }, [hospital, patients, clock, weights]);

  // Undo Handler
  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const [last, ...remaining] = undoStack;
    setHospital(last.hospital);
    setPatients(last.patients);
    setClock(last.clock);
    setWeights(last.weights);
    setUndoStack(remaining);
    addEvent("UNDO", `Reverted to clock T+${last.clock}m`);
  };

  // Run Allocation Handler
  const handleRunAllocation = () => {
    pushUndo();
    const result = runAllocationEngine(hospital, patients, clock, weights, strategy, order);
    setLastResult(result);

    // Apply allocated state back to patients and hospital
    const updatedPatients = [...patients].map((p) => {
      const traceMatch = result.trace.find((t) => t.patient_id === p.patient_id);
      if (traceMatch) {
        return {
          ...p,
          status: traceMatch.result,
          assigned_bed_id: traceMatch.assigned.bed,
          assigned_doctor_id: traceMatch.assigned.doctor,
          assigned_equipment_id: traceMatch.assigned.equipment,
          allocation_clock: traceMatch.result === "ALLOCATED" ? clock : undefined,
          reason_codes: traceMatch.reason_codes,
          priority: traceMatch.priority,
          band: traceMatch.band,
        };
      }
      return p;
    });

    const updatedHospital: HospitalInventory = {
      beds: hospital.beds.map((b) => {
        const allocP = updatedPatients.find((p) => p.assigned_bed_id === b.bed_id && p.status === "ALLOCATED");
        return {
          ...b,
          available: !allocP,
          assigned_patient_id: allocP ? allocP.patient_id : undefined,
        };
      }),
      doctors: hospital.doctors.map((d) => {
        const allocP = updatedPatients.find((p) => p.assigned_doctor_id === d.doctor_id && p.status === "ALLOCATED");
        return {
          ...d,
          available: !allocP,
          assigned_patient_id: allocP ? allocP.patient_id : undefined,
        };
      }),
      equipment: hospital.equipment.map((e) => {
        const allocP = updatedPatients.find(
          (p) => p.assigned_equipment_id === e.equipment_id && p.status === "ALLOCATED"
        );
        return {
          ...e,
          available: !allocP,
          assigned_patient_id: allocP ? allocP.patient_id : undefined,
        };
      }),
    };

    setPatients(updatedPatients);
    setHospital(updatedHospital);
    addEvent("ALLOCATION_RUN", `Strategy: ${strategy.toUpperCase()}, Served: ${result.metrics.allocated_count}`);
  };

  // Clock Advance Handler (Aging)
  const handleAdvanceClock = (mins: number) => {
    pushUndo();
    const newClock = clock + mins;
    setClock(newClock);
    addEvent("CLOCK_ADVANCED", `+${mins}m -> Clock T+${newClock}m`);
  };

  // Reset Allocations
  const handleReset = () => {
    pushUndo();
    const resetH: HospitalInventory = {
      beds: hospital.beds.map((b) => ({ ...b, available: true, assigned_patient_id: undefined })),
      doctors: hospital.doctors.map((d) => ({ ...d, available: true, assigned_patient_id: undefined })),
      equipment: hospital.equipment.map((e) => ({ ...e, available: true, assigned_patient_id: undefined })),
    };
    const resetP = patients.map((p) => ({
      ...p,
      status: p.status === "COMPLETED" ? ("COMPLETED" as const) : ("NEW" as const),
      assigned_bed_id: undefined,
      assigned_doctor_id: undefined,
      assigned_equipment_id: undefined,
      reason_codes: [],
    }));

    setHospital(resetH);
    setPatients(resetP);
    setLastResult(undefined);
    addEvent("ALLOCATIONS_RESET", "Freed all units, reset uncompleted patients");
  };

  // Discharge Patient
  const handleDischargePatient = (patientId: string) => {
    pushUndo();
    const target = patients.find((p) => p.patient_id === patientId);
    if (!target || target.status !== "ALLOCATED") return;

    const newH: HospitalInventory = {
      beds: hospital.beds.map((b) =>
        b.bed_id === target.assigned_bed_id ? { ...b, available: true, assigned_patient_id: undefined } : b
      ),
      doctors: hospital.doctors.map((d) =>
        d.doctor_id === target.assigned_doctor_id ? { ...d, available: true, assigned_patient_id: undefined } : d
      ),
      equipment: hospital.equipment.map((e) =>
        e.equipment_id === target.assigned_equipment_id
          ? { ...e, available: true, assigned_patient_id: undefined }
          : e
      ),
    };

    const newP = patients.map((p) =>
      p.patient_id === patientId
        ? {
            ...p,
            status: "COMPLETED" as const,
            assigned_bed_id: undefined,
            assigned_doctor_id: undefined,
            assigned_equipment_id: undefined,
          }
        : p
    );

    setHospital(newH);
    setPatients(newP);
    addEvent("DISCHARGED", patientId);
  };

  // Switch Dataset
  const handleSelectDataset = (name: "golden" | "demo") => {
    setDatasetName(name);
    if (name === "golden") {
      setHospital(getGoldenHospital());
      setPatients(getGoldenPatients());
    } else {
      setHospital(getDemoHospital());
      setPatients(getDemoPatients());
    }
    setClock(120);
    setLastResult(undefined);
    setUndoStack([]);
    addEvent("DATASET_CHANGED", name.toUpperCase());
  };

  // What-If Execution
  const handleRunWhatIf = (changes: { [key: string]: number }) => {
    pushUndo();
    const clonedH = JSON.parse(JSON.stringify(hospital)) as HospitalInventory;
    // Free all for what-if trial
    clonedH.beds.forEach((b) => {
      b.available = true;
      b.assigned_patient_id = undefined;
    });
    clonedH.doctors.forEach((d) => {
      d.available = true;
      d.assigned_patient_id = undefined;
    });
    clonedH.equipment.forEach((e) => {
      e.available = true;
      e.assigned_patient_id = undefined;
    });

    for (const [type, delta] of Object.entries(changes)) {
      if (delta > 0) {
        if (["ICU", "EMERGENCY", "GENERAL"].includes(type)) {
          for (let i = 1; i <= delta; i++) {
            clonedH.beds.push({
              bed_id: `BED-${type.substring(0, 3)}-${clonedH.beds.length + 1}`,
              bed_type: type as any,
              ward: `${type} Ward`,
              available: true,
            });
          }
        } else if (["Cardiologist", "Neurologist", "Physician", "Surgeon"].includes(type)) {
          for (let i = 1; i <= delta; i++) {
            clonedH.doctors.push({
              doctor_id: `DOC-${type.substring(0, 4).toUpperCase()}-${clonedH.doctors.length + 1}`,
              name: `Dr. Extra ${type}`,
              specialization: type as any,
              available: true,
            });
          }
        } else {
          for (let i = 1; i <= delta; i++) {
            clonedH.equipment.push({
              equipment_id: `EQP-${type.substring(0, 4).toUpperCase()}-${clonedH.equipment.length + 1}`,
              equipment_type: type as any,
              location: "New Wing",
              available: true,
            });
          }
        }
      } else if (delta < 0) {
        const absDelta = Math.abs(delta);
        if (["ICU", "EMERGENCY", "GENERAL"].includes(type)) {
          const matching = clonedH.beds.filter((b) => b.bed_type === type);
          const toRemove = matching.slice(-absDelta).map((b) => b.bed_id);
          clonedH.beds = clonedH.beds.filter((b) => !toRemove.includes(b.bed_id));
        } else if (["Cardiologist", "Neurologist", "Physician", "Surgeon"].includes(type)) {
          const matching = clonedH.doctors.filter((d) => d.specialization === type);
          const toRemove = matching.slice(-absDelta).map((d) => d.doctor_id);
          clonedH.doctors = clonedH.doctors.filter((d) => !toRemove.includes(d.doctor_id));
        } else {
          const matching = clonedH.equipment.filter((e) => e.equipment_type === type);
          const toRemove = matching.slice(-absDelta).map((e) => e.equipment_id);
          clonedH.equipment = clonedH.equipment.filter((e) => !toRemove.includes(e.equipment_id));
        }
      }
    }

    const resetPatients = patients.map((p) => ({
      ...p,
      status: p.status === "COMPLETED" ? ("COMPLETED" as const) : ("NEW" as const),
      assigned_bed_id: undefined,
      assigned_doctor_id: undefined,
      assigned_equipment_id: undefined,
    }));

    setHospital(clonedH);
    setPatients(resetPatients);

    const res = runAllocationEngine(clonedH, resetPatients, clock, weights, "indexed");
    setLastResult(res);

    // Apply allocated statuses
    const updated = resetPatients.map((p) => {
      const match = res.trace.find((t) => t.patient_id === p.patient_id);
      if (match) {
        return {
          ...p,
          status: match.result,
          assigned_bed_id: match.assigned.bed,
          assigned_doctor_id: match.assigned.doctor,
          assigned_equipment_id: match.assigned.equipment,
          allocation_clock: match.result === "ALLOCATED" ? clock : undefined,
          reason_codes: match.reason_codes,
          priority: match.priority,
          band: match.band,
        };
      }
      return p;
    });

    setPatients(updated);
    addEvent("WHAT_IF_RUN", `Simulated changes: ${JSON.stringify(changes)}`);
    setActiveTab("dashboard");
  };

  const customWeightsActive =
    weights.severity !== DEFAULT_WEIGHTS.severity ||
    weights.waiting !== DEFAULT_WEIGHTS.waiting ||
    weights.risk !== DEFAULT_WEIGHTS.risk ||
    weights.urgency !== DEFAULT_WEIGHTS.urgency ||
    weights.icu !== DEFAULT_WEIGHTS.icu;

  const bottlenecks = computeBottleneckTable(hospital, patients, clock);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900">
      {/* Top Banner and System Toolbar */}
      <HeaderBanner
        clock={clock}
        onAdvanceClock={handleAdvanceClock}
        onRunAllocation={handleRunAllocation}
        onReset={handleReset}
        onUndo={handleUndo}
        canUndo={undoStack.length > 0}
        datasetName={datasetName}
        onSelectDataset={handleSelectDataset}
        customWeightsActive={customWeightsActive}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* SIDEBAR NAVIGATION (§15.1) */}
        <aside className="w-60 bg-white border-r border-slate-200 flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-200">
            {/* Hackathon Demo Mode button at very top */}
            <button
              onClick={() => setActiveTab("demoMode")}
              className={`w-full py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-between transition ${
                activeTab === "demoMode"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-blue-50 text-blue-700 hover:bg-blue-100"
              }`}
            >
              <span className="flex items-center space-x-1.5">
                <Target className="w-4 h-4 fill-current" />
                <span>Demo Mode (3-5m)</span>
              </span>
              <span className="bg-blue-200/50 text-blue-900 text-[10px] px-1.5 py-0.5 rounded uppercase">
                Featured
              </span>
            </button>
          </div>

          <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto text-xs font-medium">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-md transition ${
                activeTab === "dashboard" ? "bg-slate-100 text-blue-700 font-bold" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard & KPIs</span>
            </button>

            <button
              onClick={() => setActiveTab("patients")}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-md transition ${
                activeTab === "patients" ? "bg-slate-100 text-blue-700 font-bold" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Patients & Weight Lab</span>
            </button>

            <button
              onClick={() => setActiveTab("resources")}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-md transition ${
                activeTab === "resources" ? "bg-slate-100 text-blue-700 font-bold" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <BedDouble className="w-4 h-4" />
              <span>Resource Inventory</span>
            </button>

            <button
              onClick={() => setActiveTab("allocation")}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-md transition ${
                activeTab === "allocation" ? "bg-slate-100 text-blue-700 font-bold" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>Allocation & Trace</span>
            </button>

            <button
              onClick={() => setActiveTab("algorithm")}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-md transition ${
                activeTab === "algorithm" ? "bg-slate-100 text-blue-700 font-bold" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Cpu className="w-4 h-4" />
              <span>Algorithm Visualizer</span>
            </button>

            <button
              onClick={() => setActiveTab("simulation")}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-md transition ${
                activeTab === "simulation" ? "bg-slate-100 text-blue-700 font-bold" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <FlaskConical className="w-4 h-4" />
              <span>Simulation & Advisor</span>
            </button>

            <button
              onClick={() => setActiveTab("reports")}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-md transition ${
                activeTab === "reports" ? "bg-slate-100 text-blue-700 font-bold" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Reports & Cloud DB</span>
            </button>

            <div className="pt-2 pb-1 border-t border-slate-200">
              <span className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Evaluation</span>
            </div>

            <button
              onClick={() => setActiveTab("viva")}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-md transition ${
                activeTab === "viva" ? "bg-slate-100 text-blue-700 font-bold" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span>Viva Preparation (50+)</span>
            </button>

            <button
              onClick={() => setActiveTab("about")}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-md transition ${
                activeTab === "about" ? "bg-slate-100 text-blue-700 font-bold" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Info className="w-4 h-4" />
              <span>About & Concept Map</span>
            </button>
          </nav>
        </aside>

        {/* MAIN VIEWPORT */}
        <main className="flex-1 overflow-y-auto p-6 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {activeTab === "demoMode" && (
                <DemoModeView
                  hospital={hospital}
                  patients={patients}
                  lastResult={lastResult}
                  clock={clock}
                  onRunAllocation={handleRunAllocation}
                  onRunWhatIf={handleRunWhatIf}
                />
              )}

              {activeTab === "dashboard" && (
                <DashboardView
                  hospital={hospital}
                  patients={patients}
                  lastResult={lastResult}
                  bottlenecks={bottlenecks}
                  onNavigateToAlgorithm={() => setActiveTab("algorithm")}
                  onNavigateToAllocation={() => setActiveTab("allocation")}
                  onNavigateToSimulation={() => setActiveTab("simulation")}
                />
              )}

              {activeTab === "patients" && (
                <PatientsView
                  patients={patients}
                  hospital={hospital}
                  clock={clock}
                  weights={weights}
                  onUpdateWeights={setWeights}
                  onResetWeights={() => setWeights(DEFAULT_WEIGHTS)}
                  onAddPatient={(newP) => {
                    pushUndo();
                    setPatients([...patients, newP]);
                    addEvent("PATIENT_ADDED", newP.patient_id);
                  }}
                  onDeletePatient={(pid) => {
                    pushUndo();
                    setPatients(patients.filter((p) => p.patient_id !== pid));
                    addEvent("PATIENT_DELETED", pid);
                  }}
                />
              )}

              {activeTab === "resources" && (
                <ResourcesView
                  hospital={hospital}
                  onNavigateToSimulator={() => setActiveTab("simulation")}
                />
              )}

              {activeTab === "allocation" && (
                <AllocationView
                  lastResult={lastResult}
                  patients={patients}
                  strategy={strategy}
                  order={order}
                  onSetStrategy={setStrategy}
                  onSetOrder={setOrder}
                  onRunAllocation={handleRunAllocation}
                  onReset={handleReset}
                  onDischargePatient={handleDischargePatient}
                  eventLog={eventLog}
                />
              )}

              {activeTab === "algorithm" && (
                <AlgorithmView
                  patients={patients}
                  lastResult={lastResult}
                  clock={clock}
                />
              )}

              {activeTab === "simulation" && (
                <SimulationView
                  hospital={hospital}
                  patients={patients}
                  clock={clock}
                  onApplyInventory={(newH) => {
                    pushUndo();
                    setHospital(newH);
                    handleReset();
                    addEvent("INVENTORY_UPDATED", `${newH.beds.length} beds, ${newH.doctors.length} docs`);
                  }}
                  onRunWhatIf={handleRunWhatIf}
                />
              )}

              {activeTab === "reports" && (
                <div className="space-y-6">
                  <FirebaseAuthPanel
                    hospital={hospital}
                    patients={patients}
                    clock={clock}
                    weights={weights}
                    onLoadScenario={(scenario) => {
                      pushUndo();
                      setHospital(scenario.hospital);
                      setPatients(scenario.patients);
                      setClock(scenario.clock || 120);
                      if (scenario.weights) setWeights(scenario.weights);
                      addEvent("CLOUD_SCENARIO_LOADED", `Loaded ${scenario.name || "Cloud Scenario"}`);
                    }}
                  />
                  <ReportsView
                    hospital={hospital}
                    patients={patients}
                    lastResult={lastResult}
                    clock={clock}
                    eventLog={eventLog}
                    onImportScenario={(scenario) => {
                      pushUndo();
                      setHospital(scenario.hospital);
                      setPatients(scenario.patients);
                      setClock(scenario.clock || 120);
                      addEvent("SCENARIO_IMPORTED", "Imported from JSON");
                    }}
                  />
                </div>
              )}

              {activeTab === "viva" && <VivaPrepView />}

              {activeTab === "about" && <AboutView />}
            </motion.div>
          </AnimatePresence>

          {/* Floating animated toast notification */}
          <AnimatePresence>
            {toast && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="fixed bottom-5 right-5 z-50 bg-slate-900/95 text-white text-xs font-medium px-4 py-2.5 rounded-lg shadow-xl flex items-center space-x-2.5 border border-slate-700 backdrop-blur-xs pointer-events-none"
              >
                <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0 animate-ping" />
                <span className="max-w-xs truncate">{toast.message}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
