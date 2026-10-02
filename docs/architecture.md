# System Architecture & Technical Design

## 1. Architectural Principles
1. **Strict Separation of Concerns:** Algorithm and data structure layers (`algorithms/`, `models/`, `utils/`) are purely computational and never import UI libraries.
2. **Deterministic Execution:** The same input state yields bit-for-bit identical allocation decisions, traces, and metrics on every run.
3. **Immutability of Analysis:** What-If scenarios, Resource Advisor evaluations, and benchmark passes operate strictly on cloned state, guaranteeing the live hospital state is never mutated during speculative execution.
4. **Resilient Domain Typing:** All error conditions raise `DomainError` with descriptive, actionable diagnostics rather than failing with generic exceptions.

---

## 2. Component Pipeline Flowchart

```mermaid
graph TD
    A[Patient Input / CSV / Generator] --> B[Validation & Sanitization]
    B --> C[Requirement Analysis: Bed, Doctor, Equipment]
    C --> D[Dynamic Priority Calculator: Aging]
    D --> E[Max Heap Insertion: Key = Priority, Severity, -seq]
    E --> F[Extract Max: Highest Priority Patient]
    F --> G{Read-Only Check: Find Plan Complete?}
    G -- Yes --> H[Atomic Commit: Bed + Doctor + Equipment Marked Busy]
    H --> I[Status: ALLOCATED]
    G -- No --> J{Missing in Inventory?}
    J -- Yes --> K[Status: UNAVAILABLE]
    J -- No --> L[Status: WAITING]
    I --> M[Record Trace Step]
    K --> M
    L --> M
    M --> N{Heap Empty?}
    N -- No --> F
    N -- Yes --> O[Compute Metrics, Bypass Count & Utilization]
```

---

## 3. Class Diagram

```mermaid
classDiagram
    class Patient {
        +str patient_id
        +str name
        +int severity
        +int arrival_minute
        +int waiting_minutes
        +int priority
        +str band
        +Status status
        +str assigned_bed_id
        +str assigned_doctor_id
        +str assigned_equipment_id
    }

    class Hospital {
        +List~Bed~ beds
        +List~Doctor~ doctors
        +List~Equipment~ equipment
        +free_units(kind, type) deque
        +total_units(kind, type) int
        +add_units(kind, type, n)
        +remove_free_units(kind, type, n)
        +release(unit)
        +assert_consistent()
    }

    class MaxHeap {
        -List _heap
        +insert(key, item)
        +extract_max() tuple
        +build_heap(pairs)
        +peek() tuple
        +snapshot() list
    }

    class ResourceAllocator {
        +Hospital hospital
        +List~Patient~ patients
        +int clock
        +Dict weights
        +run_allocation(strategy, order) AllocationResult
        +discharge(patient_id)
        +advance_clock(minutes)
        +reset_allocations()
        +undo() bool
        +clone() ResourceAllocator
    }

    ResourceAllocator *-- Hospital
    ResourceAllocator *-- Patient
    ResourceAllocator ..> MaxHeap
```

---

## 4. Run Allocation Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    actor Presenter as User / UI
    participant Allocator as ResourceAllocator
    participant Heap as MaxHeap
    participant Hospital as Hospital Index
    participant Trace as Trace Logger

    Presenter->>Allocator: run_allocation(strategy="indexed", order="priority")
    Allocator->>Allocator: push_undo_snapshot()
    Allocator->>Allocator: Dynamic Aging (compute waiting_level & priority)
    loop For Each Arrived Patient
        Allocator->>Heap: insert((priority, severity, -seq), patient)
    end
    loop While Heap is not Empty
        Allocator->>Heap: extract_max()
        Heap-->>Allocator: (key, patient)
        Allocator->>Hospital: find_plan_indexed(patient)
        Hospital-->>Allocator: ResourcePlan (complete/incomplete + missing)
        alt Plan is Complete
            Allocator->>Hospital: commit_plan(plan, patient)
            Allocator->>patient: status = ALLOCATED
        else Plan Incomplete
            Allocator->>patient: status = WAITING or UNAVAILABLE
            Allocator->>patient: reason_codes = [missing_codes]
        end
        Allocator->>Trace: append(TraceStep)
    end
    Allocator->>Allocator: compute Metrics & Bypass Count
    Allocator-->>Presenter: AllocationResult(trace, metrics, ops, runtime_ms)
```
