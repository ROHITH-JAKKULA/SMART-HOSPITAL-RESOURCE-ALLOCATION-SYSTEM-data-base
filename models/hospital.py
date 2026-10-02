"""Hospital inventory model with indexed lookups for O(1) matching."""
from collections import deque
import copy
from typing import List, Dict, Tuple, Any, Optional
import config


class DomainError(Exception):
    """User-friendly domain exception raised by hospital and allocation operations."""
    pass


class Hospital:
    """Manages hospital beds, doctors, and equipment with indexed free-queues."""

    def __init__(
        self,
        beds: Optional[List[Any]] = None,
        doctors: Optional[List[Any]] = None,
        equipment: Optional[List[Any]] = None
    ):
        self.beds = beds or []
        self.doctors = doctors or []
        self.equipment = equipment or []

        # Index mapping: (kind, type) -> deque of free units in ID order
        self._free_index: Dict[Tuple[str, str], deque] = {}
        self._rebuild_index()

    def _rebuild_index(self) -> None:
        """Rebuilds the free deques and validates internal consistency."""
        self._free_index = {}

        # Beds
        for b in sorted(self.beds, key=lambda x: x.bed_id):
            key = ("bed", b.bed_type)
            if key not in self._free_index:
                self._free_index[key] = deque()
            if b.available:
                self._free_index[key].append(b)

        # Doctors
        for d in sorted(self.doctors, key=lambda x: x.doctor_id):
            key = ("doctor", d.specialization)
            if key not in self._free_index:
                self._free_index[key] = deque()
            if d.available:
                self._free_index[key].append(d)

        # Equipment
        for e in sorted(self.equipment, key=lambda x: x.equipment_id):
            key = ("equipment", e.equipment_type)
            if key not in self._free_index:
                self._free_index[key] = deque()
            if e.available:
                self._free_index[key].append(e)

    def free_units(self, kind: str, type_: str) -> deque:
        """Returns the deque of free units of (kind, type_)."""
        key = (kind, type_)
        if key not in self._free_index:
            self._free_index[key] = deque()
        return self._free_index[key]

    def total_units(self, kind: str, type_: str) -> int:
        """Counts total inventory of given (kind, type_)."""
        return len(self.units_of(kind, type_))

    def units_of(self, kind: str, type_: str) -> List[Any]:
        """Returns all units (both available and busy) of given (kind, type_)."""
        if kind == "bed":
            return [b for b in self.beds if b.bed_type == type_]
        elif kind == "doctor":
            return [d for d in self.doctors if d.specialization == type_]
        elif kind == "equipment":
            return [e for e in self.equipment if e.equipment_type == type_]
        return []

    def add_units(self, kind: str, type_: str, n: int) -> List[Any]:
        """Adds n new units of (kind, type_) with deterministic sequential IDs."""
        if n <= 0:
            return []

        prefix = config.ID_PREFIX.get(type_, f"{kind.upper()}-{type_.upper()[:4]}")
        existing = self.units_of(kind, type_)
        start_num = len(existing) + 1

        new_units = []
        for i in range(start_num, start_num + n):
            unit_id = f"{prefix}-{i:02d}"
            if kind == "bed":
                from .bed import Bed
                unit = Bed(bed_id=unit_id, bed_type=type_, ward=f"{type_} Ward", available=True)
                self.beds.append(unit)
            elif kind == "doctor":
                from .doctor import Doctor
                unit = Doctor(doctor_id=unit_id, name=f"Dr. {type_} {i}", specialization=type_, available=True)
                self.doctors.append(unit)
            elif kind == "equipment":
                from .equipment import Equipment
                unit = Equipment(equipment_id=unit_id, equipment_type=type_, location=f"Room {i}01", available=True)
                self.equipment.append(unit)
            else:
                raise DomainError(f"Unknown resource kind: {kind}")
            new_units.append(unit)

        self._rebuild_index()
        return new_units

    def remove_free_units(self, kind: str, type_: str, n: int) -> None:
        """Removes n free units from the inventory (highest IDs first).

        Raises DomainError if not enough free units exist.
        """
        if n <= 0:
            return

        free_dq = self.free_units(kind, type_)
        if len(free_dq) < n:
            busy_count = self.total_units(kind, type_) - len(free_dq)
            raise DomainError(
                f"Cannot remove {n} units of {type_}: {busy_count} units are currently busy and only {len(free_dq)} are free. "
                "Discharge patients or reset allocations first."
            )

        # Remove from the main list taking highest IDs first among free units
        free_matching = [u for u in self.units_of(kind, type_) if u.available]
        free_matching.sort(key=lambda x: getattr(x, f"{kind}_id"), reverse=True)
        to_remove_ids = {getattr(u, f"{kind}_id") for u in free_matching[:n]}

        if kind == "bed":
            self.beds = [b for b in self.beds if b.bed_id not in to_remove_ids]
        elif kind == "doctor":
            self.doctors = [d for d in self.doctors if d.doctor_id not in to_remove_ids]
        elif kind == "equipment":
            self.equipment = [e for e in self.equipment if e.equipment_id not in to_remove_ids]

        self._rebuild_index()

    def release(self, unit: Any) -> None:
        """Releases an assigned unit back to the free index in O(1)."""
        if unit is None:
            return
        unit.available = True
        unit.assigned_patient_id = None

        if hasattr(unit, "bed_type"):
            key = ("bed", unit.bed_type)
        elif hasattr(unit, "specialization"):
            key = ("doctor", unit.specialization)
        elif hasattr(unit, "equipment_type"):
            key = ("equipment", unit.equipment_type)
        else:
            return

        if key not in self._free_index:
            self._free_index[key] = deque()
        self._free_index[key].append(unit)

    def assert_consistent(self) -> None:
        """Asserts that the list view and free index agree exactly."""
        for b in self.beds:
            dq = self.free_units("bed", b.bed_type)
            if b.available:
                assert b in dq, f"Available bed {b.bed_id} not in free index!"
            else:
                assert b not in dq, f"Busy bed {b.bed_id} found in free index!"

        for d in self.doctors:
            dq = self.free_units("doctor", d.specialization)
            if d.available:
                assert d in dq, f"Available doctor {d.doctor_id} not in free index!"
            else:
                assert d not in dq, f"Busy doctor {d.doctor_id} found in free index!"

        for e in self.equipment:
            dq = self.free_units("equipment", e.equipment_type)
            if e.available:
                assert e in dq, f"Available equipment {e.equipment_id} not in free index!"
            else:
                assert e not in dq, f"Busy equipment {e.equipment_id} found in free index!"

    def clone(self) -> "Hospital":
        """Returns an independent deep copy of the hospital."""
        return copy.deepcopy(self)
