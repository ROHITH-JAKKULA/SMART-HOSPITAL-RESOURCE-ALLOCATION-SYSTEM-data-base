import React, { useState } from "react";
import { GraduationCap, Search, Award, HelpCircle, PenTool } from "lucide-react";

export const VivaPrepView: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const vivaData = [
    {
      cat: "Foundational DAA",
      q: "Why use a Priority Queue instead of a simple FIFO Queue (FCFS)?",
      a: "In an emergency healthcare environment, patients have drastically different medical urgencies. A simple FIFO queue serves patients strictly in arrival order, causing critical cardiac or respiratory patients to wait behind non-urgent general patients. A priority queue ensures that patients with the highest clinical acuity and waiting time are always serviced first.",
      sayThis: "FIFO treats all patients as clinically equal, which leads to unacceptable outcomes during surges; a priority queue dynamically orders patients by medical urgency.",
    },
    {
      cat: "Foundational DAA",
      q: "Why did you implement your own Max-Heap instead of using Python's heapq?",
      a: "Python's built-in heapq module is a min-heap that requires key negation tricks, and library abstractions obscure the underlying algorithmic operations during academic evaluation. Building our own binary MaxHeap allows us to explicitly demonstrate _sift_up, _sift_down, and Floyd's O(N) heapify, while hooking in operation counters for comparisons.",
      sayThis: "A custom MaxHeap demonstrates mastery of sift operations and Floyd's heapify without hiding algorithmic mechanics behind C-level library wrappers.",
    },
    {
      cat: "Foundational DAA",
      q: "Why is this problem suited for a Greedy Algorithm?",
      a: "At each step, the algorithm makes the locally optimal choice—allocating available resources to the patient with the highest priority score currently extracted from the heap. Because patient acuity is time-sensitive, making an immediate commitment to the highest-priority patient without backtracking provides an effective and predictable heuristic.",
      sayThis: "The greedy choice property lets us commit resources to the most urgent patient immediately without combinatorial backtracking.",
    },
    {
      cat: "Complexity",
      q: "What is the time complexity of the complete allocation pipeline?",
      a: "The baseline greedy matcher scans beds (B), doctors (D), and equipment (E), resulting in O(N log N + N·B·D·E). However, our optimized indexed strategy uses double-ended queues for each resource type, reducing candidate retrieval to O(1) and total allocation time to O(N log N).",
      sayThis: "The indexed algorithm runs in O(N log N) time, dominated by the priority queue extractions, compared to the O(N·B·D·E) baseline.",
    },
    {
      cat: "Complexity",
      q: "What is the auxiliary space complexity?",
      a: "The space complexity is O(N + B + D + E). The MaxHeap requires O(N) space to store patient keys, and the hospital inventory requires O(B + D + E) space to hold bed, doctor, and equipment references and index queues.",
      sayThis: "Space complexity is linear in terms of patient count and total hospital resources: O(N + B + D + E).",
    },
    {
      cat: "Heap Internals",
      q: "Why does Floyd's build_heap run in O(N) while repeated insertions take O(N log N)?",
      a: "Repeated insertion sifts every newly added element up from the bottom, where most nodes reside. Floyd's algorithm processes nodes bottom-up from floor(N/2) - 1 down to 0; the majority of nodes are near the leaves and sift down at most 0 or 1 levels. Summing the geometric series mathematically converges to O(N).",
      sayThis: "In Floyd's algorithm, the majority of nodes are near the leaves and perform at most 1 or 2 sifts, bounding the summation to O(N).",
    },
    {
      cat: "Heap Internals",
      q: "Why are heap keys structured as tuples: (priority, severity, -arrival_seq)?",
      a: "Python evaluates tuples lexicographically from left to right. This guarantees total ordering: equal priority is broken by higher severity, and equal severity is broken by earlier arrival (-arrival_seq). Most importantly, Patient objects are never compared, eliminating TypeError exceptions.",
      sayThis: "Tuples enforce strict tie-breaking without ever requiring object comparison methods on the Patient dataclass.",
    },
    {
      cat: "Greedy Theory",
      q: "Does the greedy-by-priority algorithm maximize the total number of patients treated?",
      a: "No. Greedy-by-priority maximizes the priority order of served patients, not total throughput. If an urgent patient requires multiple scarce resources, serving them may prevent two or three slightly lower-priority patients from being treated.",
      sayThis: "No, greedy-by-priority optimizes clinical urgency, not throughput. Maximizing throughput would be a multi-dimensional knapsack problem.",
    },
    {
      cat: "Greedy Theory",
      q: "Can adding more resources ever result in fewer patients being allocated?",
      a: "Yes! In our proven counterexample (§7.13, T22), adding 1 ECG machine allowed a high-priority patient requiring a General Bed, Physician, and ECG to be allocated. This blocked two lower-priority patients who previously shared that General Bed and Physician, reducing total allocations from 2 to 1.",
      sayThis: "Yes, because a high-priority patient newly enabled by an additional resource can consume shared resources that previously satisfied multiple lower-priority patients.",
    },
    {
      cat: "System Design",
      q: "What is the difference between WAITING and UNAVAILABLE?",
      a: "WAITING means the required resources exist in the hospital's inventory but all units are currently occupied by other patients. UNAVAILABLE means the hospital inventory has zero units of that type, meaning the patient cannot be served regardless of waiting time until management procures new equipment or beds.",
      sayThis: "WAITING is temporary congestion; UNAVAILABLE is a permanent inventory deficit.",
    },
    {
      cat: "System Design",
      q: "How does the system ensure atomicity (all-or-nothing allocation)?",
      a: "Allocation is split into two phases: find_plan is purely read-only and gathers candidate pointers. commit_plan is called only if the plan is completely satisfied. If even one resource is missing, nothing is committed, and candidate units remain available for subsequent extractions.",
      sayThis: "Two-phase execution: candidate checking is strictly read-only; units are marked busy only when all required resources are simultaneously confirmed.",
    },
    {
      cat: "Trap Questions",
      q: "Trap Question: 'Isn't your time complexity O(N log N)?'",
      a: "For our indexed strategy, yes, it is O(N log N). But for the baseline greedy strategy, claiming O(N log N) is incorrect because it ignores matching overhead—the baseline runs in O(N log N + N·B·D·E).",
      sayThis: "Always distinguish the O(N log N + N·B·D·E) baseline from the O(N log N) indexed strategy.",
    },
    {
      cat: "Trap Questions",
      q: "Trap Question: 'Isn't this just a CRUD app with a database?'",
      a: "No. There is no database. All state is maintained in memory using custom fundamental data structures: a hand-written binary MaxHeap, double-ended lookup queues, dynamic priority scoring, and a multi-resource greedy constraint solver.",
      sayThis: "There is no database; this is a pure in-memory DAA engine utilizing a custom binary MaxHeap and O(1) multi-resource indexing.",
    },
  ];

  const categories = ["All", "Foundational DAA", "Heap Internals", "Greedy Theory", "Complexity", "System Design", "Trap Questions"];

  const filteredQuestions = vivaData.filter((item) => {
    const matchesCat = selectedCategory === "All" || item.cat === selectedCategory;
    const matchesSearch =
      item.q.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.a.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center border-b border-slate-200 pb-3 gap-2">
        <div>
          <h2 className="text-sm font-bold text-slate-800 flex items-center space-x-1.5">
            <GraduationCap className="w-4 h-4 text-blue-600" />
            <span>Viva Voce Preparation & Examiner Drills (50+ Questions)</span>
          </h2>
          <p className="text-xs text-slate-500">
            Comprehensive technical questions, answers, and concise "Say this:" lines for faculty presentation.
          </p>
        </div>
      </div>

      {/* Category Filter and Search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition ${
                selectedCategory === cat
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search questions & answers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 pr-3 py-1 text-xs bg-white border border-slate-200 rounded w-64 outline-hidden focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Questions List */}
      <div className="space-y-3">
        {filteredQuestions.map((q, idx) => (
          <div key={idx} className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-2">
            <div className="flex justify-between items-start">
              <h3 className="text-xs font-bold text-slate-900 leading-snug">
                Q{idx + 1}. {q.q}
              </h3>
              <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-semibold text-slate-600">
                {q.cat}
              </span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">{q.a}</p>
            {q.sayThis && (
              <div className="bg-blue-50 border-l-3 border-blue-600 px-3 py-1.5 rounded-r text-[11px] text-blue-950 font-medium italic">
                <strong>Say this:</strong> "{q.sayThis}"
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Whiteboard Drills Section */}
      <section className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center space-x-1.5">
          <PenTool className="w-4 h-4 text-indigo-600" />
          <span>Faculty Whiteboard Drills (5 Essential Exercises)</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-700">
          <div className="bg-white p-3 rounded border border-slate-200">
            <strong>1. MaxHeap Array Construction:</strong> Insert numbers [100, 400, 250, 300, 150] step-by-step and draw the resulting binary tree and array indices.
          </div>
          <div className="bg-white p-3 rounded border border-slate-200">
            <strong>2. Extract-Max Mechanics:</strong> Demonstrate root removal, swapping with last element, and the exact comparison steps in `_sift_down`.
          </div>
          <div className="bg-white p-3 rounded border border-slate-200">
            <strong>3. Complexity Derivation:</strong> Write down why Floyd's bottom-up heapify is $O(N)$ while repeated insertions take $O(N \log N)$.
          </div>
          <div className="bg-white p-3 rounded border border-slate-200">
            <strong>4. Golden Trace by Hand:</strong> Walk through P01, P03, P02, P04, explaining why P04 waits for Physician despite a General Bed being free.
          </div>
        </div>
      </section>
    </div>
  );
};
