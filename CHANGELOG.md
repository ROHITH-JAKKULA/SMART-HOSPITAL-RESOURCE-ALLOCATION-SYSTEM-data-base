# Changelog

All notable changes to the Smart Hospital Resource Allocation System are documented in this file.

## [v1.0.0] - 2026-10-02
### Added
- **Core Engine:** Hand-written binary MaxHeap with `_sift_up`, `_sift_down`, and Floyd's bottom-up $O(N)$ heapify.
- **Scoring System:** Dynamic priority calculator with monotonic aging and score breakdown terms.
- **Two Allocator Strategies:** Strategy A (Baseline $O(N \cdot B \cdot D \cdot E)$) and Strategy C (Indexed $O(N \log N)$) with equivalence verification.
- **Explainability Engine:** Instant diagnostics answering *"Why is this patient waiting?"* with blockers and unblocking paths.
- **Bottleneck Analysis & Advisor:** Real-time demand vs supply pressure computation and marginal-benefit advice for all 12 types.
- **Discrete Event Sim (F31):** Time-stepped hospital-day simulation with MinHeap event queue.
- **Safety Hardening:** CSV formula injection protection, upload size/row limits, and domain exception handling.
- **Interactive UI & Visualizations:** Dashboard with six-question strip, 8 interactive charts, SVG binary heap tree, step trace, Weight Lab, and 10-step Hackathon Demo Mode.
- **Testing:** 41 comprehensive automated unit tests covering T01 to T40 with 100% golden verification.
