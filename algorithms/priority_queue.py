"""Hand-written array-based MaxHeap and MinHeap with OpCounter hooks.

Implements binary max-heap operations:
- insert: O(log N) sift-up
- extract_max: O(log N) sift-down
- build_heap: O(N) Floyd's bottom-up heapify
- peek: O(1)
Keys are tuples: (priority, severity, -arrival_seq).
Patient objects are never compared directly.
"""
from typing import Any, List, Tuple, Optional
from models.hospital import DomainError


class OpCounter:
    """Tracks algorithm operations for empirical complexity analysis."""
    def __init__(self):
        self.heap_comparisons: int = 0
        self.unit_checks: int = 0

    def reset(self) -> None:
        self.heap_comparisons = 0
        self.unit_checks = 0


class MaxHeap:
    """Array-based binary Max Heap."""

    def __init__(self, counter: Optional[OpCounter] = None):
        self._heap: List[Tuple[Tuple, Any]] = []
        self._counter = counter

    def __len__(self) -> int:
        return len(self._heap)

    def is_empty(self) -> bool:
        return len(self._heap) == 0

    def _compare(self, key_a: Tuple, key_b: Tuple) -> bool:
        """Returns True if key_a > key_b, incrementing the counter if present."""
        if self._counter:
            self._counter.heap_comparisons += 1
        return key_a > key_b

    def _sift_up(self, i: int) -> None:
        """Sifts up element at index i to restore max-heap property. O(log N)."""
        parent = (i - 1) // 2
        while i > 0 and self._compare(self._heap[i][0], self._heap[parent][0]):
            self._heap[i], self._heap[parent] = self._heap[parent], self._heap[i]
            i = parent
            parent = (i - 1) // 2

    def _sift_down(self, i: int, n: Optional[int] = None) -> None:
        """Sifts down element at index i to restore max-heap property. O(log N)."""
        if n is None:
            n = len(self._heap)

        while True:
            left = 2 * i + 1
            right = 2 * i + 2
            largest = i

            if left < n and self._compare(self._heap[left][0], self._heap[largest][0]):
                largest = left

            if right < n and self._compare(self._heap[right][0], self._heap[largest][0]):
                largest = right

            if largest == i:
                break

            self._heap[i], self._heap[largest] = self._heap[largest], self._heap[i]
            i = largest

    def insert(self, key: Tuple, item: Any) -> None:
        """Inserts (key, item) into the heap. O(log N)."""
        self._heap.append((key, item))
        self._sift_up(len(self._heap) - 1)

    def extract_max(self) -> Tuple[Tuple, Any]:
        """Removes and returns the maximum element (key, item). O(log N)."""
        if not self._heap:
            raise DomainError("Cannot extract from an empty MaxHeap.")

        top = self._heap[0]
        last = self._heap.pop()

        if self._heap:
            self._heap[0] = last
            self._sift_down(0)

        return top

    def peek(self) -> Tuple[Tuple, Any]:
        """Returns the top element without removing it. O(1)."""
        if not self._heap:
            raise DomainError("Cannot peek into an empty MaxHeap.")
        return self._heap[0]

    def build_heap(self, pairs: List[Tuple[Tuple, Any]]) -> None:
        """Builds heap in O(N) using Floyd's bottom-up algorithm."""
        self._heap = list(pairs)
        n = len(self._heap)
        for i in range(n // 2 - 1, -1, -1):
            self._sift_down(i, n)

    def snapshot(self) -> List[dict]:
        """Returns an O(N) snapshot of the current heap array for UI visualization."""
        result = []
        for idx, (key, item) in enumerate(self._heap):
            patient_id = getattr(item, "patient_id", str(item))
            name = getattr(item, "name", "")
            priority = key[0] if isinstance(key, tuple) and len(key) > 0 else 0
            result.append({
                "index": idx,
                "key": key,
                "priority": priority,
                "patient_id": patient_id,
                "name": name,
                "parent_idx": (idx - 1) // 2 if idx > 0 else None,
                "left_idx": 2 * idx + 1 if 2 * idx + 1 < len(self._heap) else None,
                "right_idx": 2 * idx + 2 if 2 * idx + 2 < len(self._heap) else None
            })
        return result


class MinHeap:
    """Array-based binary Min Heap (used for simulation event queue)."""

    def __init__(self, counter: Optional[OpCounter] = None):
        self._heap: List[Tuple[Tuple, Any]] = []
        self._counter = counter

    def __len__(self) -> int:
        return len(self._heap)

    def is_empty(self) -> bool:
        return len(self._heap) == 0

    def _compare(self, key_a: Tuple, key_b: Tuple) -> bool:
        """Returns True if key_a < key_b for min-heap."""
        if self._counter:
            self._counter.heap_comparisons += 1
        return key_a < key_b

    def _sift_up(self, i: int) -> None:
        parent = (i - 1) // 2
        while i > 0 and self._compare(self._heap[i][0], self._heap[parent][0]):
            self._heap[i], self._heap[parent] = self._heap[parent], self._heap[i]
            i = parent
            parent = (i - 1) // 2

    def _sift_down(self, i: int, n: Optional[int] = None) -> None:
        if n is None:
            n = len(self._heap)

        while True:
            left = 2 * i + 1
            right = 2 * i + 2
            smallest = i

            if left < n and self._compare(self._heap[left][0], self._heap[smallest][0]):
                smallest = left

            if right < n and self._compare(self._heap[right][0], self._heap[smallest][0]):
                smallest = right

            if smallest == i:
                break

            self._heap[i], self._heap[smallest] = self._heap[smallest], self._heap[i]
            i = smallest

    def insert(self, key: Tuple, item: Any) -> None:
        self._heap.append((key, item))
        self._sift_up(len(self._heap) - 1)

    def extract_min(self) -> Tuple[Tuple, Any]:
        if not self._heap:
            raise DomainError("Cannot extract from an empty MinHeap.")

        top = self._heap[0]
        last = self._heap.pop()

        if self._heap:
            self._heap[0] = last
            self._sift_down(0)

        return top

    def peek(self) -> Tuple[Tuple, Any]:
        if not self._heap:
            raise DomainError("Cannot peek into an empty MinHeap.")
        return self._heap[0]
