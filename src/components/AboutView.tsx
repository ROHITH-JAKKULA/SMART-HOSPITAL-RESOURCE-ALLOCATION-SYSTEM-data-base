import React from "react";
import { Info, ShieldAlert, Award, FileCode2, Users } from "lucide-react";

export const AboutView: React.FC = () => {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
          <Info className="w-5 h-5 text-blue-600" />
          <h2 className="text-base font-bold text-slate-900">
            About the Smart Hospital Resource Allocation System
          </h2>
        </div>

        <p className="text-xs text-slate-700 leading-relaxed">
          The <strong>Smart Hospital Resource Allocation System</strong> is a comprehensive academic software project
          developed for the <strong>Design and Analysis of Algorithms (DAA) Hackathon (v3.0)</strong>. The system models a
          hospital operating under resource saturation, allocating constrained beds, doctors, and diagnostic devices to
          incoming patients according to strict priority criteria and atomicity constraints.
        </p>

        {/* Concept Map */}
        <div className="space-y-2 pt-2">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center space-x-1.5">
            <FileCode2 className="w-4 h-4 text-blue-600" />
            <span>DAA Concept Map: "Where Is It in the Code?" (§6)</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border border-slate-200 rounded">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="py-2 px-3">DAA Concept</th>
                  <th className="py-2 px-3">File & Function / Class</th>
                  <th className="py-2 px-3">UI Presentation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                <tr>
                  <td className="py-2 px-3 font-bold text-slate-800 font-sans">Priority Formula</td>
                  <td className="py-2 px-3 text-blue-700">utils/scoring.py &rarr; calculate_priority()</td>
                  <td className="py-2 px-3 font-sans text-slate-600">Patients Page (Stacked Breakdown)</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-bold text-slate-800 font-sans">Binary Max-Heap</td>
                  <td className="py-2 px-3 text-blue-700">algorithms/priority_queue.py &rarr; MaxHeap</td>
                  <td className="py-2 px-3 font-sans text-slate-600">Algorithm Page (SVG Binary Tree + Array)</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-bold text-slate-800 font-sans">Extract-Max Order</td>
                  <td className="py-2 px-3 text-blue-700">MaxHeap.extract_max()</td>
                  <td className="py-2 px-3 font-sans text-slate-600">Trace Table & Step Slider</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-bold text-slate-800 font-sans">All-or-Nothing Commit</td>
                  <td className="py-2 px-3 text-blue-700">algorithms/greedy_allocator.py &rarr; commit_plan()</td>
                  <td className="py-2 px-3 font-sans text-slate-600">Trace: "Candidate not committed"</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-bold text-slate-800 font-sans">Resource Indexing</td>
                  <td className="py-2 px-3 text-blue-700">models/hospital.py &rarr; free_units() deque</td>
                  <td className="py-2 px-3 font-sans text-slate-600">Strategy A vs C Comparison Panel</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-bold text-slate-800 font-sans">Bottleneck Analysis</td>
                  <td className="py-2 px-3 text-blue-700">algorithms/advisor.py &rarr; bottleneck_table()</td>
                  <td className="py-2 px-3 font-sans text-slate-600">Dashboard Chart 8 (Demand vs Supply)</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-bold text-slate-800 font-sans">Marginal-Benefit Advisor</td>
                  <td className="py-2 px-3 text-blue-700">algorithms/advisor.py &rarr; advise()</td>
                  <td className="py-2 px-3 font-sans text-slate-600">Simulation Page (Advisor Ranking)</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-bold text-slate-800 font-sans">Discrete Event Sim</td>
                  <td className="py-2 px-3 text-blue-700">algorithms/simulation_engine.py &rarr; MinHeap</td>
                  <td className="py-2 px-3 font-sans text-slate-600">Simulation (Hospital-Day Timeline)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Honest Limitations & Counterexample */}
        <div className="bg-amber-50/80 border border-amber-200 rounded p-4 space-y-2 text-xs text-amber-900">
          <h3 className="font-bold flex items-center space-x-1.5">
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <span>Honest Algorithmic Limitations & Counterexample (§7.13)</span>
          </h3>
          <p className="leading-relaxed">
            1. <strong>Greedy by Priority is NOT Throughput-Optimal:</strong> Serving the highest-priority patient first can
            consume shared resources that would otherwise serve multiple lower-priority patients.
          </p>
          <p className="leading-relaxed">
            2. <strong>Adding Resources Does Not Always Increase Total Allocations:</strong> In our counterexample with 3
            interdependent patients, adding 1 ECG machine enables a high-priority patient to take a General Bed and Physician,
            blocking two other patients and reducing total served patients from 2 down to 1.
          </p>
          <p className="leading-relaxed">
            3. <strong>Bypassing vs Starvation:</strong> Dynamic aging increases priority monotonically to eliminate starvation,
            but priority inversions (bypassing) still occur when a higher-urgency patient is held back by a scarce resource.
          </p>
        </div>

        {/* Academic Disclaimer & Security */}
        <div className="bg-slate-50 border border-slate-200 rounded p-4 space-y-2 text-xs text-slate-700">
          <h3 className="font-bold text-slate-900 uppercase tracking-wide">
            Privacy, Security & Academic Disclaimer (§20)
          </h3>
          <ul className="list-disc list-inside space-y-1 text-slate-600">
            <li><strong>Fictional Demo Data:</strong> All patient records, identifiers, and clinical values are synthetic.</li>
            <li><strong>Academic Model:</strong> The priority scoring formula is an academic simulation heuristic, not a certified clinical triage protocol. It must never be used for real medical decisions.</li>
            <li><strong>Security Hardening:</strong> Exported CSV files contain formula-injection defenses (prepending single quotes to formula trigger characters). Uploads are strictly capped and schema-validated.</li>
          </ul>
        </div>

        {/* Team Details */}
        <div className="border-t border-slate-100 pt-3 text-xs text-slate-500 flex justify-between items-center">
          <div className="flex items-center space-x-1.5">
            <Users className="w-4 h-4 text-slate-400" />
            <span>Team: Smart Hospital DAA Hackathon Team (4 Members)</span>
          </div>
          <span>Repository: Smart-Hospital-Resource-Allocation</span>
        </div>
      </div>
    </div>
  );
};
