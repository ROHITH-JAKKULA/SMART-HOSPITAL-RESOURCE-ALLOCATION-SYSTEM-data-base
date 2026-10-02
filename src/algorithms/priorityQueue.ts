import { Patient } from "../types";

export type HeapKey = [number, number, number]; // [priority, severity, -arrival_seq]

export interface HeapNode<T> {
  key: HeapKey;
  item: T;
}

export class MaxHeap<T = Patient> {
  private heap: HeapNode<T>[] = [];
  public comparisons = 0;

  constructor() {
    this.heap = [];
    this.comparisons = 0;
  }

  public get size(): number {
    return this.heap.length;
  }

  public isEmpty(): boolean {
    return this.heap.length === 0;
  }

  private compare(a: HeapKey, b: HeapKey): boolean {
    this.comparisons++;
    // Compare priority first
    if (a[0] !== b[0]) return a[0] > b[0];
    // Compare severity next
    if (a[1] !== b[1]) return a[1] > b[1];
    // Compare -arrival_seq (larger -seq means earlier arrival)
    return a[2] > b[2];
  }

  private siftUp(i: number): void {
    let parent = Math.floor((i - 1) / 2);
    while (i > 0 && this.compare(this.heap[i].key, this.heap[parent].key)) {
      const temp = this.heap[i];
      this.heap[i] = this.heap[parent];
      this.heap[parent] = temp;
      i = parent;
      parent = Math.floor((i - 1) / 2);
    }
  }

  private siftDown(i: number, n: number = this.heap.length): void {
    while (true) {
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      let largest = i;

      if (left < n && this.compare(this.heap[left].key, this.heap[largest].key)) {
        largest = left;
      }

      if (right < n && this.compare(this.heap[right].key, this.heap[largest].key)) {
        largest = right;
      }

      if (largest === i) break;

      const temp = this.heap[i];
      this.heap[i] = this.heap[largest];
      this.heap[largest] = temp;
      i = largest;
    }
  }

  public insert(key: HeapKey, item: T): void {
    this.heap.push({ key, item });
    this.siftUp(this.heap.length - 1);
  }

  public extractMax(): HeapNode<T> {
    if (this.heap.length === 0) {
      throw new Error("Cannot extract from empty MaxHeap.");
    }
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.siftDown(0);
    }
    return top;
  }

  public peek(): HeapNode<T> {
    if (this.heap.length === 0) {
      throw new Error("Cannot peek empty MaxHeap.");
    }
    return this.heap[0];
  }

  public buildHeap(nodes: HeapNode<T>[]): void {
    this.heap = [...nodes];
    const n = this.heap.length;
    for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
      this.siftDown(i, n);
    }
  }

  public snapshot() {
    return this.heap.map((node, idx) => {
      const p = node.item as unknown as Patient;
      return {
        index: idx,
        key: node.key,
        patient_id: p.patient_id,
        name: p.name,
        priority: node.key[0],
        parent_idx: idx > 0 ? Math.floor((idx - 1) / 2) : undefined,
        left_idx: 2 * idx + 1 < this.heap.length ? 2 * idx + 1 : undefined,
        right_idx: 2 * idx + 2 < this.heap.length ? 2 * idx + 2 : undefined,
      };
    });
  }
}
