import React, { useState, useEffect } from "react";
import {
  auth,
  googleProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
  db,
  collection,
  addDoc,
  setDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  deleteDoc,
  doc,
  testFirestoreConnection,
} from "../firebase";
import { HospitalInventory, Patient, ScoringWeights } from "../types";
import { LogIn, LogOut, Cloud, CloudUpload, CloudDownload, Trash2, CheckCircle, AlertCircle, Shield } from "lucide-react";

interface FirebaseAuthPanelProps {
  hospital: HospitalInventory;
  patients: Patient[];
  clock: number;
  weights: ScoringWeights;
  onLoadScenario: (scenario: { hospital: HospitalInventory; patients: Patient[]; clock: number; weights: ScoringWeights; name?: string }) => void;
}

export const FirebaseAuthPanel: React.FC<FirebaseAuthPanelProps> = ({
  hospital,
  patients,
  clock,
  weights,
  onLoadScenario,
}) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [scenarioName, setScenarioName] = useState("");
  const [savedScenarios, setSavedScenarios] = useState<any[]>([]);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    testFirestoreConnection();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setLoading(false);
      if (user) {
        // Sync user profile to Firestore per blueprint
        try {
          await setDoc(
            doc(db, "users", user.uid),
            {
              uid: user.uid,
              email: user.email || "",
              displayName: user.displayName || "Hospital Staff",
              photoURL: user.photoURL || "",
              createdAt: new Date().toISOString(),
            },
            { merge: true }
          );
        } catch (e) {
          console.warn("Could not sync user profile:", e);
        }
        loadUserScenarios(user.uid);
      } else {
        setSavedScenarios([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const loadUserScenarios = async (uid: string) => {
    try {
      const q = query(collection(db, "scenarios"), where("userId", "==", uid));
      const querySnapshot = await getDocs(q);
      const list: any[] = [];
      querySnapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() });
      });
      setSavedScenarios(list);
    } catch (err: any) {
      console.error("Failed to load user scenarios:", err);
    }
  };

  const handleSignIn = async () => {
    try {
      setStatusMsg(null);
      await signInWithPopup(auth, googleProvider);
      setStatusMsg({ type: "success", text: "Signed in successfully with Google." });
    } catch (err: any) {
      console.error("Sign in failed:", err);
      setStatusMsg({ type: "error", text: err.message || "Sign-in failed." });
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setStatusMsg({ type: "success", text: "Signed out." });
    } catch (err: any) {
      console.error("Sign out failed:", err);
    }
  };

  const handleSaveScenario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!scenarioName.trim()) {
      setStatusMsg({ type: "error", text: "Please provide a scenario name." });
      return;
    }

    setSaving(true);
    setStatusMsg(null);

    try {
      await addDoc(collection(db, "scenarios"), {
        userId: currentUser.uid,
        name: scenarioName.trim(),
        clock,
        weights,
        hospital,
        patients,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Audit log entry
      try {
        await addDoc(collection(db, "audit_logs"), {
          userId: currentUser.uid,
          clock,
          kind: "SCENARIO_SAVED_CLOUD",
          details: `Saved scenario "${scenarioName.trim()}" (${patients.length} patients, clock T+${clock}m)`,
          timestamp: new Date().toISOString(),
        });
      } catch (logErr) {
        console.warn("Audit log creation skipped:", logErr);
      }

      setStatusMsg({ type: "success", text: `Scenario "${scenarioName.trim()}" saved to Firestore!` });
      setScenarioName("");
      loadUserScenarios(currentUser.uid);
    } catch (err: any) {
      console.error("Failed to save scenario:", err);
      setStatusMsg({ type: "error", text: `Firestore error: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteScenario = async (scenarioId: string) => {
    if (!currentUser) return;
    try {
      await deleteDoc(doc(db, "scenarios", scenarioId));
      try {
        await addDoc(collection(db, "audit_logs"), {
          userId: currentUser.uid,
          clock,
          kind: "SCENARIO_DELETED_CLOUD",
          details: `Deleted scenario ${scenarioId}`,
          timestamp: new Date().toISOString(),
        });
      } catch (logErr) {
        console.warn("Audit log delete event skipped:", logErr);
      }
      setStatusMsg({ type: "success", text: "Scenario deleted from cloud." });
      loadUserScenarios(currentUser.uid);
    } catch (err: any) {
      console.error("Failed to delete scenario:", err);
      setStatusMsg({ type: "error", text: err.message });
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-4">
      <div className="flex flex-wrap justify-between items-center border-b border-slate-100 pb-3 gap-2">
        <div className="flex items-center space-x-2">
          <Cloud className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Firebase Authentication & Cloud Database Sync
            </h3>
            <p className="text-xs text-slate-500">
              Securely authenticate via Google Sign-In and persist hospital scenarios to Cloud Firestore.
            </p>
          </div>
        </div>

        <div>
          {loading ? (
            <span className="text-xs text-slate-400">Loading auth...</span>
          ) : currentUser ? (
            <div className="flex items-center space-x-3">
              {currentUser.photoURL && (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName || "User"}
                  className="w-7 h-7 rounded-full border border-slate-200"
                />
              )}
              <div className="text-xs">
                <strong className="text-slate-800 block leading-tight">{currentUser.displayName}</strong>
                <span className="text-slate-500 text-[10px]">{currentUser.email}</span>
              </div>
              <button
                onClick={handleSignOut}
                className="flex items-center space-x-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <button
              onClick={handleSignIn}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded shadow-xs transition"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign in with Google</span>
            </button>
          )}
        </div>
      </div>

      {statusMsg && (
        <div
          className={`p-2.5 rounded text-xs flex items-center space-x-2 ${
            statusMsg.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {statusMsg.type === "success" ? (
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {currentUser ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Save Scenario Form */}
          <form onSubmit={handleSaveScenario} className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2.5">
            <span className="font-bold text-slate-800 block flex items-center space-x-1.5">
              <CloudUpload className="w-4 h-4 text-blue-600" />
              <span>Save Current Hospital Scenario</span>
            </span>
            <input
              type="text"
              placeholder="e.g. ICU Night Surge Scenario"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 outline-hidden focus:ring-1 focus:ring-blue-500"
              required
            />
            <p className="text-[11px] text-slate-500">
              Saves {patients.length} patients, {hospital.beds.length} beds, {hospital.doctors.length} doctors, and {hospital.equipment.length} equipment at clock T+{clock}m.
            </p>
            <button
              type="submit"
              disabled={saving}
              className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded transition"
            >
              {saving ? "Saving to Firestore..." : "Save to Cloud"}
            </button>
          </form>

          {/* Cloud Scenarios List */}
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
            <span className="font-bold text-slate-800 block flex items-center space-x-1.5">
              <CloudDownload className="w-4 h-4 text-emerald-600" />
              <span>Your Saved Cloud Scenarios ({savedScenarios.length})</span>
            </span>

            {savedScenarios.length > 0 ? (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {savedScenarios.map((scen) => (
                  <div
                    key={scen.id}
                    className="bg-white p-2 rounded border border-slate-200 flex justify-between items-center"
                  >
                    <div>
                      <strong className="text-slate-800 block">{scen.name}</strong>
                      <span className="text-[10px] text-slate-400">
                        Clock: T+{scen.clock}m · {scen.patients?.length || 0} pts
                      </span>
                    </div>
                    <div className="flex space-x-1">
                      <button
                        onClick={() => onLoadScenario(scen)}
                        className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold rounded text-[10px]"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => handleDeleteScenario(scen.id)}
                        className="p-1 hover:bg-red-50 text-red-500 rounded"
                        title="Delete scenario"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 py-3 text-center">
                No cloud scenarios saved yet.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 text-center text-xs text-blue-900 space-y-1">
          <Shield className="w-5 h-5 mx-auto text-blue-600 mb-1" />
          <p className="font-semibold">Sign in with Google to enable Firestore cloud persistence.</p>
          <p className="text-slate-500 text-[11px]">Save, load, and manage hospital capacity scenarios across devices.</p>
        </div>
      )}
    </div>
  );
};
