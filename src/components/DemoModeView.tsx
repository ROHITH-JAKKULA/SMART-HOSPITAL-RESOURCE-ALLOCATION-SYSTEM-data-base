import React, { useState } from "react";
import { HospitalInventory, Patient, AllocationResult } from "../types";
import { ChevronLeft, ChevronRight, RotateCcw, Target, Sparkles, CheckCircle2 } from "lucide-react";

interface DemoModeViewProps {
  hospital: HospitalInventory;
  patients: Patient[];
  lastResult?: AllocationResult;
  clock: number;
  onRunAllocation: () => void;
  onRunWhatIf: (changes: { [key: string]: number }) => void;
}

export const DemoModeView: React.FC<DemoModeViewProps> = ({
  hospital,
  patients,
  lastResult,
  clock,
  onRunAllocation,
  onRunWhatIf,
}) => {
  const [currentStep, setCurrentStep] = useState(1);

  const steps = [
    {
      num: 1,
      title: "Load Demo Hospital Inventory",
      sayThis:
        "We begin by loading our verified hospital inventory: 2 ICU beds, 2 General beds, 1 Emergency bed, 3 specialist doctors, and 4 specialized diagnostic units.",
      content: (
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="bg-slate-50 p-3 rounded border border-slate-200">
            <span className="font-bold text-slate-700 block mb-1">Beds (5 Total)</span>
            <div className="text-slate-600 font-mono text-[11px]">
              • 2 ICU (BED-ICU-01, 02)<br />
              • 2 General (BED-GEN-01, 02)<br />
              • 1 Emergency (BED-EMG-01)
            </div>
          </div>
          <div className="bg-slate-50 p-3 rounded border border-slate-200">
            <span className="font-bold text-slate-700 block mb-1">Doctors (3 Total)</span>
            <div className="text-slate-600 font-mono text-[11px]">
              • Cardiologist (DOC-CARD-01)<br />
              • Neurologist (DOC-NEUR-01)<br />
              • Physician (DOC-PHYS-01)
            </div>
          </div>
          <div className="bg-slate-50 p-3 rounded border border-slate-200">
            <span className="font-bold text-slate-700 block mb-1">Equipment (4 Total)</span>
            <div className="text-slate-600 font-mono text-[11px]">
              • Ventilator (EQP-VENT-01)<br />
              • ECG (EQP-ECG-01)<br />
              • Monitor (EQP-MON-01)<br />
              • MRI (EQP-MRI-01)
            </div>
          </div>
        </div>
      ),
    },
    {
      num: 2,
      title: "Arriving Patients & Clinical Requirements",
      sayThis:
        "Four patients arrive at staggered timestamps. Notice their heterogeneous requirements: P01 needs ICU, Cardiologist, and Ventilator; P04 needs General bed and Physician.",
      content: (
        <div className="overflow-x-auto text-xs">
          <table className="w-full text-left font-mono border border-slate-200 rounded">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="p-2">ID</th>
                <th className="p-2">Arrival</th>
                <th className="p-2">Severity</th>
                <th className="p-2">Required Triad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {patients.slice(0, 4).map((p) => (
                <tr key={p.patient_id}>
                  <td className="p-2 font-bold text-blue-700">{p.patient_id}</td>
                  <td className="p-2">T+{p.arrival_minute}m</td>
                  <td className="p-2">{p.severity}/5</td>
                  <td className="p-2">
                    {p.required_bed_type} + {p.required_doctor_specialty}
                    {p.required_equipment !== "None" ? ` + ${p.required_equipment}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ),
    },
    {
      num: 3,
      title: "Dynamic Priority & Aging Computation",
      sayThis:
        "At Clock T+120, each patient's waiting time is dynamically converted into waiting levels, calculating priorities: P01 is 440, P03 is 390, P02 is 240, and P04 is 165.",
      content: (
        <div className="space-y-2 text-xs font-mono">
          <div className="bg-red-50 p-2 rounded border border-red-200 text-red-900">
            • <strong>P01:</strong> 40(5) + 20(4) + 15(5) + 15(5) + 10(1) = <strong>440 pts</strong> (CRITICAL)
          </div>
          <div className="bg-red-50 p-2 rounded border border-red-200 text-red-900">
            • <strong>P03:</strong> 40(5) + 20(3) + 15(4) + 15(4) + 10(1) = <strong>390 pts</strong> (CRITICAL)
          </div>
          <div className="bg-amber-50 p-2 rounded border border-amber-200 text-amber-900">
            • <strong>P02:</strong> 40(3) + 20(3) + 15(2) + 15(2) + 10(0) = <strong>240 pts</strong> (HIGH)
          </div>
          <div className="bg-blue-50 p-2 rounded border border-blue-200 text-blue-900">
            • <strong>P04:</strong> 40(2) + 20(2) + 15(2) + 15(1) + 10(0) = <strong>165 pts</strong> (NORMAL)
          </div>
        </div>
      ),
    },
    {
      num: 4,
      title: "Binary Max-Heap Construction",
      sayThis:
        "Patients are inserted into our array-based binary MaxHeap. Tuple keys (priority, severity, -arrival_seq) guarantee total ordering without comparing Patient objects.",
      content: (
        <div className="bg-slate-50 p-4 rounded border border-slate-200 text-center font-mono text-xs space-y-2">
          <span className="text-slate-500 font-bold block">MaxHeap Array Representation:</span>
          <div className="flex justify-center space-x-2">
            <span className="px-2.5 py-1 bg-blue-700 text-white font-bold rounded shadow-xs">
              [0] P01: 440 (Root)
            </span>
            <span className="px-2.5 py-1 bg-blue-600 text-white font-bold rounded">
              [1] P03: 390
            </span>
            <span className="px-2.5 py-1 bg-blue-600 text-white font-bold rounded">
              [2] P02: 240
            </span>
            <span className="px-2.5 py-1 bg-blue-600 text-white font-bold rounded">
              [3] P04: 165
            </span>
          </div>
          <p className="text-[11px] text-slate-500 pt-1">
            Parent(i) &ge; Children(i). Root always holds highest priority patient.
          </p>
        </div>
      ),
    },
    {
      num: 5,
      title: "Sequential Extract-Max Operation",
      sayThis:
        "We extract the root element in O(log N). The last element replaces root and sifts down to restore the heap property. Extractions proceed: P01, then P03, then P02, then P04.",
      content: (
        <div className="space-y-1.5 text-xs font-mono text-slate-700">
          <div>1. extract_max() &rarr; <strong>P01 (440)</strong> | Heap: [P03: 390, P04: 165, P02: 240]</div>
          <div>2. extract_max() &rarr; <strong>P03 (390)</strong> | Heap: [P02: 240, P04: 165]</div>
          <div>3. extract_max() &rarr; <strong>P02 (240)</strong> | Heap: [P04: 165]</div>
          <div>4. extract_max() &rarr; <strong>P04 (165)</strong> | Heap: [] (Empty)</div>
        </div>
      ),
    },
    {
      num: 6,
      title: "Two-Phase Allocation & Atomicity Proof",
      sayThis:
        "Step 4 demonstrates our atomicity guarantee: General Bed 02 is free, but the Physician is busy with P02. General Bed 02 remains free (candidate not committed) and P04 waits cleanly.",
      content: (
        <div className="space-y-2 text-xs font-mono">
          <div className="bg-emerald-50 p-2 rounded text-emerald-900 border border-emerald-200">
            ✓ Step 1: P01 ALLOCATED &rarr; BED-ICU-01, DOC-CARD-01, EQP-VENT-01
          </div>
          <div className="bg-emerald-50 p-2 rounded text-emerald-900 border border-emerald-200">
            ✓ Step 2: P03 ALLOCATED &rarr; BED-ICU-02, DOC-NEUR-01, EQP-MON-01
          </div>
          <div className="bg-emerald-50 p-2 rounded text-emerald-900 border border-emerald-200">
            ✓ Step 3: P02 ALLOCATED &rarr; BED-GEN-01, DOC-PHYS-01
          </div>
          <div className="bg-amber-50 p-2 rounded text-amber-900 border border-amber-200">
            ⏳ Step 4: P04 WAITING &rarr; Bed: candidate BED-GEN-02 (not committed) | Doctor: Physician busy
          </div>
        </div>
      ),
    },
    {
      num: 7,
      title: "Explainability: 'Why is P04 Waiting?'",
      sayThis:
        "The explainability engine pinpoints that P04 is blocked because the single Physician is busy with P02. To unblock: discharge P02 or add 1 Physician.",
      content: (
        <div className="bg-slate-50 p-3 rounded border border-slate-200 text-xs space-y-1.5">
          <span className="font-bold text-slate-800">Diagnostic Explanation for P04:</span>
          <p className="text-slate-700 leading-snug">
            Processed 4th of 4. General Bed 02 was free but held back to guarantee atomicity. Blocked by:
            <strong> Physician (1 unit busy, held by P02)</strong>.
          </p>
          <div className="font-semibold text-blue-700">
            Actionable Unblocking: Discharge P02 OR Add 1 Physician unit to hospital inventory.
          </div>
        </div>
      ),
    },
    {
      num: 8,
      title: "Capacity Utilisation & Bottleneck",
      sayThis:
        "Overall utilization reaches 66.7%, but Doctor utilization is 100%. Our Bottleneck Table highlights Physician pressure at 2.0 with a shortage of 1.",
      content: (
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-slate-50 p-3 rounded border border-slate-200">
            <span className="font-bold text-slate-800 block mb-1">Category Utilisation</span>
            <div className="space-y-1 font-mono text-[11px]">
              <div>• Beds: 3/5 (60.0%)</div>
              <div className="text-red-700 font-bold">• Doctors: 3/3 (100.0%)</div>
              <div>• Equipment: 2/4 (50.0%)</div>
              <div>• Overall: 8/12 (66.7%)</div>
            </div>
          </div>
          <div className="bg-amber-50 p-3 rounded border border-amber-200">
            <span className="font-bold text-amber-900 block mb-1">Primary Bottleneck</span>
            <div className="space-y-1 text-[11px] text-amber-900">
              <div>• Resource: <strong>Physician</strong></div>
              <div>• Demand: 2 | Supply: 1</div>
              <div>• Pressure: <strong>2.0 (Highest)</strong></div>
              <div>• Shortage: 1 Specialist</div>
            </div>
          </div>
        </div>
      ),
    },
    {
      num: 9,
      title: "Simulate Solution: Add +1 Physician",
      sayThis:
        "Our Resource Advisor identifies +1 Physician as the highest marginal benefit recommendation. Let's execute this What-If change now.",
      content: (
        <div className="bg-blue-50 p-4 rounded border border-blue-200 text-center space-y-3">
          <p className="text-xs text-blue-900 font-medium">
            Applying <strong>+1 Physician</strong> will create unit <strong>DOC-PHYS-02</strong>.
          </p>
          <button
            onClick={() => onRunWhatIf({ Physician: 1 })}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded shadow-xs transition"
          >
            Execute +1 Physician What-If Simulation
          </button>
        </div>
      ),
    },
    {
      num: 10,
      title: "Before vs After: Unblocked Surge",
      sayThis:
        "With +1 Physician added, P04 is immediately allocated. Total patients served increases from 3 to 4, waiting drops to 0, and weighted score climbs to 1,235!",
      content: (
        <div className="bg-emerald-50 p-4 rounded border border-emerald-200 text-xs space-y-2">
          <div className="flex items-center space-x-1.5 text-emerald-800 font-bold text-sm">
            <CheckCircle2 className="w-4 h-4" />
            <span>Surge Resolved: 100% Patient Allocation</span>
          </div>
          <div className="grid grid-cols-2 gap-2 font-mono text-[11px] text-emerald-900">
            <div>• Allocated: 3 &rarr; <strong>4 (All served)</strong></div>
            <div>• Waiting: 1 &rarr; <strong>0 (Queue empty)</strong></div>
            <div>• Weighted Score: 1070 &rarr; <strong>1235 (+165)</strong></div>
            <div>• Overall Util: 66.7% &rarr; <strong>76.9%</strong></div>
          </div>
        </div>
      ),
    },
  ];

  const current = steps[currentStep - 1];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Stepper Header */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
        <div className="flex flex-wrap justify-between items-center border-b border-slate-100 pb-3 gap-2">
          <div className="flex items-center space-x-2">
            <Target className="w-5 h-5 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">
              Hackathon 10-Step Interactive Presentation Stepper
            </h2>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-500 font-mono">
              Step {currentStep} of {steps.length}
            </span>
            <button
              onClick={() => setCurrentStep(1)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded"
              title="Reset to step 1"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
          <div
            style={{ width: `${(currentStep / steps.length) * 100}%` }}
            className="h-full bg-blue-600 transition-all duration-300 rounded-full"
          ></div>
        </div>
      </div>

      {/* Main Step Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-xs space-y-5">
        <div className="flex items-center space-x-2">
          <span className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xs font-mono">
            {current.num}
          </span>
          <h3 className="text-base font-bold text-slate-900">{current.title}</h3>
        </div>

        {/* Presenter Talking Point */}
        <div className="bg-blue-50/80 border-l-4 border-blue-600 p-3.5 rounded-r">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800 block mb-1">
            Say This:
          </span>
          <p className="text-xs text-blue-950 font-medium italic leading-relaxed">
            "{current.sayThis}"
          </p>
        </div>

        {/* Interactive Step Content */}
        <div className="pt-2">{current.content}</div>

        {/* Navigation Buttons */}
        <div className="flex justify-between items-center pt-4 border-t border-slate-100">
          <button
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
            className={`flex items-center space-x-1 px-3.5 py-1.5 text-xs font-semibold rounded transition ${
              currentStep === 1
                ? "text-slate-300 cursor-not-allowed"
                : "text-slate-700 bg-slate-100 hover:bg-slate-200"
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous Step</span>
          </button>

          <button
            onClick={() => setCurrentStep(Math.min(steps.length, currentStep + 1))}
            disabled={currentStep === steps.length}
            className={`flex items-center space-x-1 px-4 py-1.5 text-xs font-semibold rounded shadow-xs transition ${
              currentStep === steps.length
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          >
            <span>Next Step</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
