import React from "react";
import { HospitalInventory } from "../types";
import { Bed as BedIcon, UserCheck, Stethoscope } from "lucide-react";

interface ResourcesViewProps {
  hospital: HospitalInventory;
  onNavigateToSimulator: () => void;
}

export const ResourcesView: React.FC<ResourcesViewProps> = ({
  hospital,
  onNavigateToSimulator,
}) => {
  const freeBeds = hospital.beds.filter((b) => b.available).length;
  const freeDocs = hospital.doctors.filter((d) => d.available).length;
  const freeEqs = hospital.equipment.filter((e) => e.available).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-sm font-bold text-slate-800">Hospital Resource Directory & Status</h2>
          <p className="text-xs text-slate-500">
            Real-time physical inventory across all beds, specialist staff, and clinical devices.
          </p>
        </div>
        <button
          onClick={onNavigateToSimulator}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded shadow-xs transition"
        >
          Open Simulator to Adjust Units →
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Beds Table */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <span className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
              <BedIcon className="w-4 h-4 text-blue-600" />
              <span>Hospital Beds</span>
            </span>
            <span className="text-xs font-mono font-semibold text-blue-700">
              {freeBeds} / {hospital.beds.length} Available
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/50 text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="py-2 px-3">Bed ID</th>
                  <th className="py-2 px-3">Type</th>
                  <th className="py-2 px-3">Ward</th>
                  <th className="py-2 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {hospital.beds.map((b) => (
                  <tr key={b.bed_id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-mono font-bold text-slate-800">{b.bed_id}</td>
                    <td className="py-2 px-3">
                      <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-semibold text-slate-700">
                        {b.bed_type}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-500">{b.ward}</td>
                    <td className="py-2 px-3 text-right">
                      {b.available ? (
                        <span className="inline-flex items-center text-emerald-700 font-semibold text-[11px]">
                          <span className="w-2 h-2 bg-emerald-500 rounded-full mr-1.5"></span>
                          Free
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-red-600 font-semibold text-[11px]">
                          <span className="w-2 h-2 bg-red-500 rounded-full mr-1.5"></span>
                          Held ({b.assigned_patient_id})
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Doctors Table */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <span className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
              <UserCheck className="w-4 h-4 text-indigo-600" />
              <span>Medical Specialists</span>
            </span>
            <span className="text-xs font-mono font-semibold text-indigo-700">
              {freeDocs} / {hospital.doctors.length} Available
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/50 text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="py-2 px-3">Doc ID</th>
                  <th className="py-2 px-3">Specialty</th>
                  <th className="py-2 px-3">Name</th>
                  <th className="py-2 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {hospital.doctors.map((d) => (
                  <tr key={d.doctor_id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-mono font-bold text-slate-800">{d.doctor_id}</td>
                    <td className="py-2 px-3">
                      <span className="px-1.5 py-0.5 bg-indigo-50 rounded text-[10px] font-semibold text-indigo-700">
                        {d.specialization}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-600 truncate max-w-[120px]">{d.name}</td>
                    <td className="py-2 px-3 text-right">
                      {d.available ? (
                        <span className="inline-flex items-center text-emerald-700 font-semibold text-[11px]">
                          <span className="w-2 h-2 bg-emerald-500 rounded-full mr-1.5"></span>
                          Free
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-red-600 font-semibold text-[11px]">
                          <span className="w-2 h-2 bg-red-500 rounded-full mr-1.5"></span>
                          Held ({d.assigned_patient_id})
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Equipment Table */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <span className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
              <Stethoscope className="w-4 h-4 text-purple-600" />
              <span>Medical Equipment</span>
            </span>
            <span className="text-xs font-mono font-semibold text-purple-700">
              {freeEqs} / {hospital.equipment.length} Available
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/50 text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="py-2 px-3">Eq ID</th>
                  <th className="py-2 px-3">Device Type</th>
                  <th className="py-2 px-3">Location</th>
                  <th className="py-2 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {hospital.equipment.map((e) => (
                  <tr key={e.equipment_id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-mono font-bold text-slate-800">{e.equipment_id}</td>
                    <td className="py-2 px-3">
                      <span className="px-1.5 py-0.5 bg-purple-50 rounded text-[10px] font-semibold text-purple-700">
                        {e.equipment_type}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-500">{e.location}</td>
                    <td className="py-2 px-3 text-right">
                      {e.available ? (
                        <span className="inline-flex items-center text-emerald-700 font-semibold text-[11px]">
                          <span className="w-2 h-2 bg-emerald-500 rounded-full mr-1.5"></span>
                          Free
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-red-600 font-semibold text-[11px]">
                          <span className="w-2 h-2 bg-red-500 rounded-full mr-1.5"></span>
                          Held ({e.assigned_patient_id})
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
