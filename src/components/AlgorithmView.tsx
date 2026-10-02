import React, { useState } from "react";
import { motion } from "motion/react";
import { Patient, AllocationResult } from "../types";
import { MaxHeap, HeapKey } from "../algorithms/priorityQueue";
import { GitBranch, Layers, Play, CheckCircle2, Zap } from "lucide-react";

interface AlgorithmViewProps {
  patients: Patient[];
  lastResult?: AllocationResult;
  clock: number;
}

export const AlgorithmView: React.FC<AlgorithmViewProps> = ({
  patients,
  lastResult,
  clock,
}) => {
  const [heapStep, setHeapStep] = useState(0);
  const [selectedNodeIdx, setSelectedNodeIdx] = useState<number | null>(null);

  // Compute live MaxHeap from arrived patients
  const pool = patients.filter((p) => p.status !== "COMPLETED" && p.arrival_minute <= clock);
  const liveHeap = new MaxHeap<Patient>();
  pool.forEach((p) => {
    const key: HeapKey = [p.priority, p.severity, -p.arrival_seq];
    liveHeap.insert(key, p);
  });
  const nodes = liveHeap.snapshot();

  // 7-step pipeline stages
  const pipelineSteps = [
    { title: "1. Intake & Validate", desc: "Check constraints & rules" },
    { title: "2. Dynamic Aging", desc: "Compute wait & priority" },
    { title: "3. Build MaxHeap", desc: "Key: (Pri, Sev, -Seq)" },
    { title: "4. Extract Root", desc: "Top priority patient" },
    { title: "5. Find Plan", desc: "Read-only feasibility" },
    { title: "6. Atomic Commit", desc: "Bed + Doc + Eq or wait" },
    { title: "7. Metrics & Trace", desc: "Utilisation & bypass" },
  ];

  return (
    <div className="space-y-6">
      {/* 1. SEVEN-STEP PIPELINE STRIP */}
      <section className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-3 flex items-center space-x-1.5">
          <GitBranch className="w-4 h-4 text-blue-600" />
          <span>DAA End-to-End Algorithmic Pipeline</span>
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {pipelineSteps.map((step, idx) => (
            <motion.div
              key={idx}
              whileHover={{ y: -2, scale: 1.02 }}
              transition={{ duration: 0.15 }}
              className="bg-slate-50 border border-slate-200 rounded p-2.5 text-center hover:border-blue-400 hover:shadow-2xs transition"
            >
              <div className="w-5 h-5 mx-auto mb-1 bg-blue-100 text-blue-700 font-bold text-[10px] rounded-full flex items-center justify-center font-mono">
                {idx + 1}
              </div>
              <h4 className="text-xs font-bold text-slate-800 leading-tight">{step.title}</h4>
              <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* 2. INTERACTIVE BINARY HEAP TREE & ARRAY TABLE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Interactive Binary Heap SVG Visualizer */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Binary Max-Heap Tree Visualization</h3>
              <p className="text-xs text-slate-500">
                Root stores maximum priority key; parent key $\ge$ children keys ($O(\log N)$ extraction).
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
              Size: {nodes.length} nodes
            </span>
          </div>

          {nodes.length > 0 ? (
            <div className="overflow-x-auto py-2">
              <svg className="w-full min-w-[500px] h-64 mx-auto select-none">
                {/* Draw Parent-to-Child connecting lines */}
                {nodes.map((node, i) => {
                  // Coordinate layout for binary tree levels (up to 4 levels)
                  const level = Math.floor(Math.log2(i + 1));
                  const posInLevel = i - (Math.pow(2, level) - 1);
                  const totalInLevel = Math.pow(2, level);

                  const x = (500 / (totalInLevel + 1)) * (posInLevel + 1);
                  const y = 35 + level * 55;

                  const lines = [];
                  if (node.left_idx !== undefined && node.left_idx < nodes.length) {
                    const lLevel = level + 1;
                    const lPos = node.left_idx - (Math.pow(2, lLevel) - 1);
                    const lTotal = Math.pow(2, lLevel);
                    const lx = (500 / (lTotal + 1)) * (lPos + 1);
                    const ly = 35 + lLevel * 55;
                    lines.push(
                      <line
                        key={`line-l-${i}`}
                        x1={x}
                        y1={y}
                        x2={lx}
                        y2={ly}
                        stroke="#CBD5E1"
                        strokeWidth="2"
                      />
                    );
                  }
                  if (node.right_idx !== undefined && node.right_idx < nodes.length) {
                    const rLevel = level + 1;
                    const rPos = node.right_idx - (Math.pow(2, rLevel) - 1);
                    const rTotal = Math.pow(2, rLevel);
                    const rx = (500 / (rTotal + 1)) * (rPos + 1);
                    const ly = 35 + rLevel * 55;
                    lines.push(
                      <line
                        key={`line-r-${i}`}
                        x1={x}
                        y1={y}
                        x2={rx}
                        y2={ly}
                        stroke="#CBD5E1"
                        strokeWidth="2"
                      />
                    );
                  }

                  return <g key={`edge-${i}`}>{lines}</g>;
                })}

                {/* Draw Nodes */}
                {nodes.map((node, i) => {
                  const level = Math.floor(Math.log2(i + 1));
                  const posInLevel = i - (Math.pow(2, level) - 1);
                  const totalInLevel = Math.pow(2, level);

                  const x = (500 / (totalInLevel + 1)) * (posInLevel + 1);
                  const y = 35 + level * 55;

                  const isRoot = i === 0;
                  const isSelected = selectedNodeIdx === i;

                  return (
                    <motion.g
                      key={`node-${i}`}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.35, delay: i * 0.04 }}
                      onClick={() => setSelectedNodeIdx(isSelected ? null : i)}
                      className="cursor-pointer"
                    >
                      {isRoot && (
                        <circle
                          cx={x}
                          cy={y}
                          r={26}
                          fill="none"
                          stroke="#3B82F6"
                          strokeWidth="2"
                          strokeDasharray="4 2"
                          className="animate-spin origin-center"
                          style={{ transformOrigin: `${x}px ${y}px` }}
                        />
                      )}
                      <circle
                        cx={x}
                        cy={y}
                        r={isRoot ? 20 : isSelected ? 19 : 17}
                        fill={isRoot ? "#1E40AF" : isSelected ? "#0D9488" : "#2563EB"}
                        stroke={isSelected ? "#5EEAD4" : "#FFFFFF"}
                        strokeWidth="2.5"
                        className="transition-all hover:opacity-90 shadow-sm"
                      />
                      <text
                        x={x}
                        y={y - 2}
                        textAnchor="middle"
                        fill="#FFFFFF"
                        fontSize={isRoot ? "11px" : "10px"}
                        fontWeight="bold"
                        fontFamily="monospace"
                      >
                        {node.patient_id}
                      </text>
                      <text
                        x={x}
                        y={y + 10}
                        textAnchor="middle"
                        fill="#BFDBFE"
                        fontSize="9px"
                        fontWeight="bold"
                        fontFamily="monospace"
                      >
                        {node.priority}
                      </text>
                    </motion.g>
                  );
                })}
              </svg>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400 text-xs">No active patients in heap.</div>
          )}

          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono">
            <span>Root = Max key [Priority, Severity, -Seq]</span>
            <span>Invariant: Parent(i) $\ge$ Children(i)</span>
          </div>
        </section>

        {/* Right: Heap Array Representation Table */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Heap Array & Index Arithmetic</h3>
              <p className="text-xs text-slate-500">Contiguous memory representation without pointer overhead.</p>
            </div>
          </div>

          <div className="overflow-x-auto max-h-64">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2 px-2.5">Idx</th>
                  <th className="py-2 px-2.5">Patient</th>
                  <th className="py-2 px-2.5">Key (Pri, S, -Seq)</th>
                  <th className="py-2 px-2.5 text-center">Parent</th>
                  <th className="py-2 px-2.5 text-center">Left</th>
                  <th className="py-2 px-2.5 text-center">Right</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {nodes.map((node) => (
                  <tr key={node.index} className={node.index === 0 ? "bg-blue-50/70 font-semibold" : "hover:bg-slate-50"}>
                    <td className="py-2 px-2.5 font-bold text-slate-500">[{node.index}]</td>
                    <td className="py-2 px-2.5 font-bold text-slate-900">{node.patient_id}</td>
                    <td className="py-2 px-2.5 text-[11px] text-blue-700">
                      ({node.key[0]}, {node.key[1]}, {node.key[2]})
                    </td>
                    <td className="py-2 px-2.5 text-center text-slate-500">
                      {node.parent_idx !== undefined ? `[${node.parent_idx}]` : "—"}
                    </td>
                    <td className="py-2 px-2.5 text-center text-slate-500">
                      {node.left_idx !== undefined ? `[${node.left_idx}]` : "—"}
                    </td>
                    <td className="py-2 px-2.5 text-center text-slate-500">
                      {node.right_idx !== undefined ? `[${node.right_idx}]` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-600 space-y-1">
            <div className="font-semibold text-slate-800">Array Index Formulas:</div>
            <div>• Parent index: $\lfloor (i - 1) / 2 \rfloor$</div>
            <div>• Left child index: $2i + 1$</div>
            <div>• Right child index: $2i + 2$</div>
          </div>
        </section>
      </div>

      {/* 3. BASELINE VS INDEXED EMPIRICAL COMPARISON */}
      <section className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
        <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Empirical Complexity: Strategy A vs Strategy C</h3>
            <p className="text-xs text-slate-500">
              Comparing exhaustive combinatorial search with indexed constant-time matching.
            </p>
          </div>
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded flex items-center space-x-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Both strategies produce identical allocation statuses (T17)</span>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-800">Strategy A: Baseline (Exhaustive)</span>
              <span className="font-mono text-xs bg-slate-200 px-2 py-0.5 rounded font-semibold text-slate-700">
                O(N · B · D · E)
              </span>
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Iterates over all beds $\times$ doctors $\times$ equipment combinations in nested loops.
              Wasteful because bed, doctor, and equipment constraints are independent orthogonal checks.
            </p>
            <div className="pt-2 border-t border-slate-200 flex justify-between text-slate-700 font-mono">
              <span>Unit checks on Golden:</span>
              <strong className="text-slate-900">&ge; 10 checks</strong>
            </div>
          </div>

          <div className="bg-blue-50/60 border border-blue-200 rounded-lg p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-bold text-blue-900 flex items-center space-x-1">
                <Zap className="w-3.5 h-3.5 text-blue-600 fill-current" />
                <span>Strategy C: Indexed (Our Implementation)</span>
              </span>
              <span className="font-mono text-xs bg-blue-600 text-white px-2 py-0.5 rounded font-semibold">
                O(N log N)
              </span>
            </div>
            <p className="text-blue-950 text-[11px] leading-relaxed">
              Maintains type-based double-ended queues ($deque$). Candidate check examines the front of each required
              queue in $O(1)$ time, reducing multi-resource allocation overhead to pure heap extractions.
            </p>
            <div className="pt-2 border-t border-blue-200 flex justify-between text-blue-900 font-mono">
              <span>Unit checks on Golden:</span>
              <strong className="text-blue-700">Exactly 10 checks (T36)</strong>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
