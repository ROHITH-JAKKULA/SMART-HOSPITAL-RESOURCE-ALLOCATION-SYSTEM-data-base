import React, { useState } from "react";
import { HospitalInventory, Patient, Advice, BedType, DoctorSpecialty, EquipmentType } from "../types";
import { computeAdvisor } from "../algorithms/greedyAllocator";
import { Sliders, Sparkles, TrendingUp, AlertTriangle, ArrowRight, Play, CheckCircle2 } from "lucide-react";

interface SimulationViewProps {
  hospital: HospitalInventory;
  patients: Patient[];
  clock: number;
  onApplyInventory: (newInventory: HospitalInventory) => void;
  onRunWhatIf: (changes: { [key: string]: number }) => void;
}

export const SimulationView: React.FC<SimulationViewProps> = ({
  hospital,
  patients,
  clock,
  onApplyInventory,
  onRunWhatIf,
}) => {
  const [activeTab, setActiveTab] = useState<"advisor" | "whatIf" | "simulator">("advisor");

  // Editable inventory for simulator
  const [bedCounts, setBedCounts] = useState<{ [key in BedType]: number }>({
    ICU: hospital.beds.filter((b) => b.bed_type === "ICU").length,
    EMERGENCY: hospital.beds.filter((b) => b.bed_type === "EMERGENCY").length,
    GENERAL: hospital.beds.filter((b) => b.bed_type === "GENERAL").length,
  });

  const [docCounts, setDocCounts] = useState<{ [key in DoctorSpecialty]: number }>({
    Cardiologist: hospital.doctors.filter((d) => d.specialization === "Cardiologist").length,
    Neurologist: hospital.doctors.filter((d) => d.specialization === "Neurologist").length,
    Physician: hospital.doctors.filter((d) => d.specialization === "Physician").length,
    Surgeon: hospital.doctors.filter((d) => d.specialization === "Surgeon").length,
  });

  const [eqCounts, setEqCounts] = useState<{ [key in Exclude<EquipmentType, "None">]: number }>({
    Ventilator: hospital.equipment.filter((e) => e.equipment_type === "Ventilator").length,
    ECG: hospital.equipment.filter((e) => e.equipment_type === "ECG").length,
    Monitor: hospital.equipment.filter((e) => e.equipment_type === "Monitor").length,
    MRI: hospital.equipment.filter((e) => e.equipment_type === "MRI").length,
    "X-Ray": hospital.equipment.filter((e) => e.equipment_type === "X-Ray").length,
  });

  const adviceList = computeAdvisor(hospital, patients, clock);

  const handleApplySimulator = () => {
    const newBeds = [];
    for (const [type, count] of Object.entries(bedCounts)) {
      for (let i = 1; i <= count; i++) {
        newBeds.push({
          bed_id: `BED-${type.substring(0, 3)}-${i < 10 ? "0" + i : i}`,
          bed_type: type as BedType,
          ward: `${type} Ward`,
          available: true,
        });
      }
    }

    const newDocs = [];
    for (const [spec, count] of Object.entries(docCounts)) {
      for (let i = 1; i <= count; i++) {
        newDocs.push({
          doctor_id: `DOC-${spec.substring(0, 4).toUpperCase()}-${i < 10 ? "0" + i : i}`,
          name: `Dr. ${spec} ${i}`,
          specialization: spec as DoctorSpecialty,
          available: true,
        });
      }
    }

    const newEqs = [];
    for (const [eqType, count] of Object.entries(eqCounts)) {
      for (let i = 1; i <= count; i++) {
        newEqs.push({
          equipment_id: `EQP-${eqType.substring(0, 4).toUpperCase()}-${i < 10 ? "0" + i : i}`,
          equipment_type: eqType as EquipmentType,
          location: `Room ${i}01`,
          available: true,
        });
      }
    }

    onApplyInventory({ beds: newBeds, doctors: newDocs, equipment: newEqs });
  };

  return (
    <div className="space-y-6">
      {/* Simulation Navigation Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab("advisor")}
          className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded transition ${
            activeTab === "advisor"
              ? "bg-blue-600 text-white shadow-xs"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Resource Advisor (§7.11)</span>
        </button>

        <button
          onClick={() => setActiveTab("whatIf")}
          className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded transition ${
            activeTab === "whatIf"
              ? "bg-blue-600 text-white shadow-xs"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>What-If Analysis Presets (§10.6)</span>
        </button>

        <button
          onClick={() => setActiveTab("simulator")}
          className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded transition ${
            activeTab === "simulator"
              ? "bg-blue-600 text-white shadow-xs"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Inventory Simulator & Scaling</span>
        </button>
      </div>

      {/* TAB 1: RESOURCE ADVISOR (§7.11) */}
      {activeTab === "advisor" && (
        <section className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Resource Advisor: Marginal Benefit Ranking
              </h3>
              <p className="text-xs text-slate-500">
                Evaluates marginal gain of adding +1 unit for all 12 types in isolated $O(T \cdot N \log N)$ simulation.
              </p>
            </div>
            <span className="text-[11px] text-blue-700 font-medium bg-blue-50 px-2 py-0.5 rounded">
              Pure simulation: live hospital state is untouched
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Resource Type</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3 text-center">Δ Patients Served</th>
                  <th className="py-2.5 px-3 text-center">Δ Priority Score</th>
                  <th className="py-2.5 px-3">Newly Allocated Patient IDs</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {adviceList.map((adv) => {
                  const isPositive = adv.delta_allocated > 0 || adv.delta_weighted_score > 0;
                  return (
                    <tr
                      key={`${adv.kind}-${adv.type}`}
                      className={isPositive ? "bg-emerald-50/50 hover:bg-emerald-50 font-medium" : "hover:bg-slate-50"}
                    >
                      <td className="py-2.5 px-3 font-bold text-slate-900 flex items-center space-x-1.5">
                        {isPositive && <span className="text-emerald-600">★</span>}
                        <span>{adv.type}</span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 capitalize">{adv.kind}</td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold">
                        {adv.delta_allocated > 0 ? (
                          <span className="text-emerald-700">+{adv.delta_allocated}</span>
                        ) : adv.delta_allocated < 0 ? (
                          <span className="text-red-600">{adv.delta_allocated}</span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold">
                        {adv.delta_weighted_score > 0 ? (
                          <span className="text-emerald-700">+{adv.delta_weighted_score}</span>
                        ) : adv.delta_weighted_score < 0 ? (
                          <span className="text-red-600">{adv.delta_weighted_score}</span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 font-mono">
                        {adv.newly_allocated_ids.length > 0 ? (
                          <span className="text-emerald-800 font-bold">{adv.newly_allocated_ids.join(", ")}</span>
                        ) : (
                          <span className="text-slate-400">None (no effect)</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => onRunWhatIf({ [adv.type]: 1 })}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded text-[11px] transition inline-flex items-center space-x-1"
                        >
                          <span>Try +1</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="bg-amber-50 border border-amber-200 p-3 rounded text-xs text-amber-900 flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="leading-snug">
              <strong>Academic Note:</strong> Marginal benefit suggestions are computed via isolated counterfactual simulation
              under strict greedy priority criteria. They do not constitute formal medical or equipment procurement advice.
            </p>
          </div>
        </section>
      )}

      {/* TAB 2: WHAT-IF PRESETS (§10.6) */}
      {activeTab === "whatIf" && (
        <section className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h3 className="text-sm font-bold text-slate-800">What-If Counterfactual Scenarios (§10.6)</h3>
            <p className="text-xs text-slate-500">
              Instantly execute and verify the four hand-calculated scenarios from §10.6 on clean state.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Scenario A: +1 Physician */}
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 hover:border-blue-400 transition space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-900 text-xs">Scenario A: +1 Physician</span>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded text-[10px]">
                  Unblocks Bottleneck
                </span>
              </div>
              <p className="text-slate-600 text-xs">
                Adds 1 Physician (DOC-PHYS-02). P04 is allocated. All 4 patients served!
              </p>
              <div className="text-[11px] font-mono text-slate-700 bg-white p-2 rounded border border-slate-200">
                Expected: Allocated 4, Waiting 0 | Score: 1235 (+165) | Overall Util: 76.9%
              </div>
              <button
                onClick={() => onRunWhatIf({ Physician: 1 })}
                className="w-full mt-2 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded transition flex items-center justify-center space-x-1"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Execute Scenario A</span>
              </button>
            </div>

            {/* Scenario B: -1 Ventilator */}
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 hover:border-blue-400 transition space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-900 text-xs">Scenario B: −1 Ventilator (0 left)</span>
                <span className="px-2 py-0.5 bg-red-100 text-red-800 font-bold rounded text-[10px]">
                  Creates Deficit
                </span>
              </div>
              <p className="text-slate-600 text-xs">
                Ventilator inventory drops to 0. P01 becomes UNAVAILABLE. P03 and P02 allocated.
              </p>
              <div className="text-[11px] font-mono text-slate-700 bg-white p-2 rounded border border-slate-200">
                Expected: Allocated 2, Waiting 1, Unavail 1 | Score: 630 | Bypass: 2
              </div>
              <button
                onClick={() => onRunWhatIf({ Ventilator: -1 })}
                className="w-full mt-2 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded transition flex items-center justify-center space-x-1"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Execute Scenario B</span>
              </button>
            </div>

            {/* Scenario C: +1 Cardiologist */}
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 hover:border-blue-400 transition space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-900 text-xs">Scenario C: +1 Cardiologist</span>
                <span className="px-2 py-0.5 bg-slate-200 text-slate-700 font-bold rounded text-[10px]">
                  No Effect (Non-Bottleneck)
                </span>
              </div>
              <p className="text-slate-600 text-xs">
                Nobody is waiting for a Cardiologist; the bottleneck is the Physician.
              </p>
              <div className="text-[11px] font-mono text-slate-700 bg-white p-2 rounded border border-slate-200">
                Expected: No change in allocated count or score.
              </div>
              <button
                onClick={() => onRunWhatIf({ Cardiologist: 1 })}
                className="w-full mt-2 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded transition flex items-center justify-center space-x-1"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Execute Scenario C</span>
              </button>
            </div>

            {/* Scenario D: +1 ICU Bed */}
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 hover:border-blue-400 transition space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-900 text-xs">Scenario D: +1 ICU Bed</span>
                <span className="px-2 py-0.5 bg-slate-200 text-slate-700 font-bold rounded text-[10px]">
                  No Effect (Non-Bottleneck)
                </span>
              </div>
              <p className="text-slate-600 text-xs">
                ICU bed supply is already sufficient for P01 and P03.
              </p>
              <div className="text-[11px] font-mono text-slate-700 bg-white p-2 rounded border border-slate-200">
                Expected: No change in allocated count or score.
              </div>
              <button
                onClick={() => onRunWhatIf({ ICU: 1 })}
                className="w-full mt-2 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded transition flex items-center justify-center space-x-1"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Execute Scenario D</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* TAB 3: INVENTORY SIMULATOR (§16.1) */}
      {activeTab === "simulator" && (
        <section className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-5">
          <div className="border-b border-slate-100 pb-2">
            <h3 className="text-sm font-bold text-slate-800">Hospital Resource Capacity Simulator</h3>
            <p className="text-xs text-slate-500">
              Directly adjust unit counts across all 12 categories. Applying resets allocations and evaluates new capacity.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
            {/* Beds */}
            <div className="space-y-3 bg-slate-50 p-3 rounded border border-slate-200">
              <h4 className="font-bold text-slate-800 uppercase tracking-wide">Beds Capacity</h4>
              {(["ICU", "EMERGENCY", "GENERAL"] as BedType[]).map((bt) => (
                <div key={bt} className="flex justify-between items-center">
                  <span className="font-medium text-slate-700">{bt} Beds:</span>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={bedCounts[bt]}
                    onChange={(e) => setBedCounts({ ...bedCounts, [bt]: Math.max(0, Number(e.target.value)) })}
                    className="w-16 bg-white border border-slate-200 rounded px-2 py-1 text-center font-mono font-bold"
                  />
                </div>
              ))}
            </div>

            {/* Doctors */}
            <div className="space-y-3 bg-slate-50 p-3 rounded border border-slate-200">
              <h4 className="font-bold text-slate-800 uppercase tracking-wide">Doctor Specialists</h4>
              {(["Cardiologist", "Neurologist", "Physician", "Surgeon"] as DoctorSpecialty[]).map((ds) => (
                <div key={ds} className="flex justify-between items-center">
                  <span className="font-medium text-slate-700">{ds}:</span>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={docCounts[ds]}
                    onChange={(e) => setDocCounts({ ...docCounts, [ds]: Math.max(0, Number(e.target.value)) })}
                    className="w-16 bg-white border border-slate-200 rounded px-2 py-1 text-center font-mono font-bold"
                  />
                </div>
              ))}
            </div>

            {/* Equipment */}
            <div className="space-y-3 bg-slate-50 p-3 rounded border border-slate-200">
              <h4 className="font-bold text-slate-800 uppercase tracking-wide">Medical Devices</h4>
              {(["Ventilator", "ECG", "Monitor", "MRI", "X-Ray"] as const).map((eq) => (
                <div key={eq} className="flex justify-between items-center">
                  <span className="font-medium text-slate-700">{eq}:</span>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={eqCounts[eq]}
                    onChange={(e) => setEqCounts({ ...eqCounts, [eq]: Math.max(0, Number(e.target.value)) })}
                    className="w-16 bg-white border border-slate-200 rounded px-2 py-1 text-center font-mono font-bold"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-200">
            <button
              onClick={handleApplySimulator}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded shadow-xs transition flex items-center space-x-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Apply Capacity & Re-Run Allocation</span>
            </button>
          </div>
        </section>
      )}
    </div>
  );
};
