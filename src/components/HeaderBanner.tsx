import React from "react";
import { Play, RotateCcw, Undo2, Plus, AlertTriangle, Clock, Database } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface HeaderBannerProps {
  clock: number;
  onAdvanceClock: (mins: number) => void;
  onRunAllocation: () => void;
  onReset: () => void;
  onUndo: () => void;
  canUndo: boolean;
  datasetName: string;
  onSelectDataset: (name: "golden" | "demo") => void;
  customWeightsActive: boolean;
}

export const HeaderBanner: React.FC<HeaderBannerProps> = ({
  clock,
  onAdvanceClock,
  onRunAllocation,
  onReset,
  onUndo,
  canUndo,
  datasetName,
  onSelectDataset,
  customWeightsActive,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      {/* Disclaimer strip */}
      <div className="bg-blue-50 border-b border-blue-100 px-4 py-1.5 flex items-center justify-between text-xs text-blue-900">
        <div className="flex items-center space-x-2">
          <span className="font-bold tracking-wide uppercase px-1.5 py-0.5 bg-blue-200 text-blue-800 rounded">
            DEMO DATA — FICTIONAL
          </span>
          <span className="text-blue-700 hidden sm:inline">
            Academic simulation for DAA evaluation. Not clinical triage advice.
          </span>
        </div>
        <div className="flex items-center space-x-2 font-mono font-medium">
          <Clock className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
          <motion.span
            key={clock}
            initial={{ scale: 1.2, color: "#2563eb" }}
            animate={{ scale: 1, color: "#1e293b" }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="inline-block"
          >
            Clock: T+{clock} min
          </motion.span>
        </div>
      </div>

      <AnimatePresence>
        {customWeightsActive && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-amber-50 border-b border-amber-200 px-4 py-1 text-xs text-amber-800 flex items-center space-x-2 overflow-hidden"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>
              <strong>CUSTOM WEIGHTS ACTIVE:</strong> Results differ from documented default priority formula (40/20/15/15/10).
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main control toolbar */}
      <div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={onRunAllocation}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium text-sm rounded shadow-xs transition"
            title="Execute priority heap and atomic greedy matching"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Run Allocation ▶</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={onReset}
            className="flex items-center space-x-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm rounded transition"
            title="Reset active allocations"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </motion.button>

          <motion.button
            whileHover={canUndo ? { scale: 1.03 } : {}}
            whileTap={canUndo ? { scale: 0.97 } : {}}
            onClick={onUndo}
            disabled={!canUndo}
            className={`flex items-center space-x-1 px-3 py-1.5 font-medium text-sm rounded transition ${
              canUndo
                ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                : "bg-slate-50 text-slate-300 cursor-not-allowed"
            }`}
            title="Undo last allocation or state modification"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>Undo</span>
          </motion.button>

          <div className="h-5 w-px bg-slate-200 hidden md:block" />

          <div className="flex items-center space-x-1">
            <span className="text-xs text-slate-500 font-medium mr-1 hidden lg:inline">Aging:</span>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onAdvanceClock(15)}
              className="flex items-center space-x-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded transition"
              title="Advance hospital clock by 15 minutes to trigger dynamic aging"
            >
              <Plus className="w-3 h-3" />
              <span>15m</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onAdvanceClock(30)}
              className="flex items-center space-x-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded transition"
              title="Advance hospital clock by 30 minutes"
            >
              <Plus className="w-3 h-3" />
              <span>30m</span>
            </motion.button>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Database className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-500 font-medium">Dataset:</span>
          <select
            value={datasetName}
            onChange={(e) => onSelectDataset(e.target.value as "golden" | "demo")}
            aria-label="Select dataset"
            className="text-xs font-medium bg-slate-50 border border-slate-200 text-slate-800 rounded px-2.5 py-1 focus:ring-1 focus:ring-blue-500 outline-hidden transition"
          >
            <option value="golden">Golden Dataset (4 Patients, Verified)</option>
            <option value="demo">Demo Hospital (12 Patients, Equipment Shortage)</option>
          </select>
        </div>
      </div>
    </header>
  );
};
