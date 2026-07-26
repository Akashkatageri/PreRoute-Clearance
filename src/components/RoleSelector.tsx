import React, { useState, useEffect } from "react";
import { ShieldAlert, Ambulance, Shield, CheckCircle2, AlertCircle, Radio, UserCheck } from "lucide-react";
import { Role, UserSession } from "../types";
import { NotificationService } from "../services/notification";
import { db } from "../lib/firebase";
import { doc, setDoc } from "firebase/firestore";

interface RoleSelectorProps {
  onLogin: (session: UserSession) => void;
}

export const RoleSelector: React.FC<RoleSelectorProps> = ({ onLogin }) => {
  const [selectedRole, setSelectedRole] = useState<"driver" | "police">("driver");
  const [vehicleId, setVehicleId] = useState("");
  const [badgeNumber, setBadgeNumber] = useState("");
  const [officerName, setOfficerName] = useState("");
  const [isProfileRestored, setIsProfileRestored] = useState(false);

  // Pre-fill initial saved credentials on mount so user sees them immediately
  useEffect(() => {
    try {
      const savedRaw = localStorage.getItem("ambulance_preclear_last_credentials") || localStorage.getItem("ambulance_preclear_session");
      if (savedRaw) {
        const saved = JSON.parse(savedRaw);
        if (saved.name || saved.officerName) {
          setOfficerName(saved.name || saved.officerName || "");
        }
        if (saved.vehicleId) {
          setVehicleId(saved.vehicleId);
        }
        if (saved.badgeNumber) {
          setBadgeNumber(saved.badgeNumber);
        }
        if (saved.role === "driver" || saved.role === "police") {
          setSelectedRole(saved.role);
        }
        setIsProfileRestored(true);
      }
    } catch (e) {
      console.warn("Could not load initial saved credentials:", e);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    const name = officerName.trim();
    const email = `${selectedRole}_${Date.now()}@preclear.gov.in`;
    const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${name}`;

    const session: UserSession = {
      id: `usr_${Date.now()}`,
      name,
      email,
      avatarUrl,
      role: selectedRole,
      vehicleId: selectedRole === "driver" ? vehicleId.trim() : undefined,
      badgeNumber: selectedRole === "police" ? badgeNumber.trim() : undefined,
      loginProvider: "direct",
      loggedAt: new Date().toISOString()
    };

    const profileToSave = {
      email,
      name,
      avatarUrl,
      role: selectedRole,
      vehicleId: selectedRole === "driver" ? vehicleId.trim() : undefined,
      badgeNumber: selectedRole === "police" ? badgeNumber.trim() : undefined,
      updatedAt: new Date().toISOString()
    };

    // Save profile to localStorage and Firestore
    localStorage.setItem("ambulance_preclear_last_credentials", JSON.stringify(profileToSave));

    try {
      await setDoc(doc(db, "users", name.replace(/\s+/g, "_").toLowerCase()), profileToSave);
    } catch (err) {
      console.warn("Could not save user profile to Firestore:", err);
    }

    // Save active session
    localStorage.setItem("ambulance_preclear_session", JSON.stringify(session));

    // Request native Location & Notification permissions upon portal entry
    try {
      await NotificationService.requestAllPermissions();
    } catch (e) {
      console.warn("Permission request error on submit:", e);
    }

    onLogin(session);
  };

  const isValidVehicleId = (val: string): boolean => {
    const cleaned = val.trim().toUpperCase();
    // 2 Letters + 2 Digits + 1-2 Letters + 4 Digits
    const regex = /^[A-Z]{2}[-\s]?[0-9]{2}[-\s]?[A-Z]{1,2}[-\s]?[0-9]{4}$/;
    return regex.test(cleaned);
  };

  const sanitizeVehicleInput = (val: string): string => {
    let upper = val.toUpperCase().replace(/[^A-Z0-9-\s]/g, "");
    if (upper.length > 13) {
      upper = upper.slice(0, 13);
    }
    const match = upper.match(/^([A-Z]{0,2})([-\s]?)([0-9]{0,2})([-\s]?)([A-Z]{0,2})([-\s]?)([0-9]{0,4})/);
    return match ? match[0] : upper;
  };

  const isVehicleValid = isValidVehicleId(vehicleId);

  const isFormValid = Boolean(
    officerName.trim() !== "" &&
    (selectedRole === "driver" ? isVehicleValid : badgeNumber.trim() !== "")
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Background Decorative Glow */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-red-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-xl w-full relative z-10 flex flex-col items-center">
        {/* Header Branding */}
        <div className="flex items-center gap-3 bg-slate-900/90 px-4 py-2 rounded-full border border-slate-800 mb-6 shadow-inner">
          <ShieldAlert className="w-5 h-5 text-red-500 animate-pulse" />
          <span className="text-xs font-black tracking-widest text-slate-300 uppercase">
            Emergency Pre-Clear Portal
          </span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight text-center mb-2">
          Ambulance<span className="text-red-500">PreClear</span>
        </h1>
        <p className="text-slate-400 text-sm sm:text-base text-center mb-8 max-w-md">
          Emergency Signal Corridor & Vehicle Dispatch System
        </p>

        {/* Login Card */}
        <form
          onSubmit={handleSubmit}
          className="w-full bg-slate-900/90 backdrop-blur-xl p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-2xl flex flex-col gap-6"
        >
          {/* Portal Credentials Section */}
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-black">1</span>
                Portal Role & Credentials
              </label>
              {isProfileRestored && (
                <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <UserCheck className="w-3 h-3" /> Credentials Restored
                </span>
              )}
            </div>

            {/* Role Selection Tabs */}
            <div className="grid grid-cols-2 gap-3">
              {/* Ambulance Driver Option */}
              <button
                type="button"
                onClick={() => setSelectedRole("driver")}
                className={`p-3.5 rounded-2xl border text-left transition-all duration-200 flex flex-col gap-1.5 cursor-pointer ${
                  selectedRole === "driver"
                    ? "bg-blue-600/20 border-blue-500 text-white shadow-lg ring-2 ring-blue-500/40"
                    : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
                id="role-btn-driver"
              >
                <div className="flex items-center justify-between w-full">
                  <div className={`p-1.5 rounded-lg ${selectedRole === "driver" ? "bg-blue-500 text-white" : "bg-slate-800 text-slate-400"}`}>
                    <Ambulance className="w-4 h-4" />
                  </div>
                  {selectedRole === "driver" && (
                    <CheckCircle2 className="w-4 h-4 text-blue-400" />
                  )}
                </div>
                <div>
                  <h3 className="font-black text-xs text-white">Ambulance Driver</h3>
                  <p className="text-[10px] text-slate-400 leading-tight">Emergency signal dispatch</p>
                </div>
              </button>

              {/* Traffic Police Option */}
              <button
                type="button"
                onClick={() => setSelectedRole("police")}
                className={`p-3.5 rounded-2xl border text-left transition-all duration-200 flex flex-col gap-1.5 cursor-pointer ${
                  selectedRole === "police"
                    ? "bg-red-600/20 border-red-500 text-white shadow-lg ring-2 ring-red-500/40"
                    : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
                id="role-btn-police"
              >
                <div className="flex items-center justify-between w-full">
                  <div className={`p-1.5 rounded-lg ${selectedRole === "police" ? "bg-red-500 text-white" : "bg-slate-800 text-slate-400"}`}>
                    <Shield className="w-4 h-4" />
                  </div>
                  {selectedRole === "police" && (
                    <CheckCircle2 className="w-4 h-4 text-red-400" />
                  )}
                </div>
                <div>
                  <h3 className="font-black text-xs text-white">Traffic Police</h3>
                  <p className="text-[10px] text-slate-400 leading-tight">Radar & live signal control</p>
                </div>
              </button>
            </div>

            {/* Officer Name Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Display / Officer Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={officerName}
                onChange={(e) => setOfficerName(e.target.value)}
                placeholder={selectedRole === "driver" ? "e.g. Ramesh Kumar" : "e.g. Inspector Vijay"}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Role Specific Vehicle / Badge Field */}
            {selectedRole === "driver" ? (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                  <span>Ambulance Registration Vehicle ID <span className="text-red-400">*</span></span>
                  {vehicleId.trim() && (
                    isVehicleValid ? (
                      <span className="text-emerald-400 text-[11px] font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Valid Vehicle ID
                      </span>
                    ) : (
                      <span className="text-amber-400 text-[11px] font-semibold">
                        4 Digits Required at End
                      </span>
                    )
                  )}
                </label>
                <input
                  type="text"
                  value={vehicleId}
                  onChange={(e) => setVehicleId(sanitizeVehicleInput(e.target.value))}
                  maxLength={13}
                  placeholder="KA-05-EM-0108"
                  className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none font-mono uppercase transition-colors ${
                    vehicleId.trim()
                      ? isVehicleValid
                        ? "border-emerald-500/80 focus:border-emerald-400"
                        : "border-amber-500/80 focus:border-amber-400"
                      : "border-slate-800 focus:border-blue-500"
                  }`}
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Format: 2 Letters + 2 Digits + 1-2 Letters + 4 Digits (e.g. <span className="text-slate-300 font-mono">KA-05-EM-0108</span>)
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Traffic Control Badge / Inspector ID <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={badgeNumber}
                  onChange={(e) => setBadgeNumber(e.target.value)}
                  placeholder="BLR-TP-402"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-red-500 font-mono"
                  required
                />
              </div>
            )}
          </div>

          {/* Login Submit Button */}
          <div className="flex flex-col gap-2 pt-2">
            <button
              type="submit"
              disabled={!isFormValid}
              className={`w-full font-black text-base py-4 px-6 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 uppercase tracking-wider ${
                !isFormValid
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/60"
                  : selectedRole === "driver"
                  ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30 cursor-pointer"
                  : "bg-red-600 hover:bg-red-500 text-white shadow-red-600/30 cursor-pointer"
              }`}
              id="btn-enter-portal"
            >
              <span>
                Enter {selectedRole === "driver" ? "Ambulance Driver" : "Traffic Police"} Portal
              </span>
            </button>

            {!isFormValid && (
              <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl text-slate-400 text-xs flex flex-col gap-1.5">
                <span className="font-bold text-slate-300 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  To enter the portal:
                </span>
                <ul className="list-disc list-inside text-[11px] space-y-0.5 text-slate-400 pl-1">
                  {!officerName.trim() && <li>Enter Display / Officer Name</li>}
                  {selectedRole === "driver" && (
                    !vehicleId.trim() ? (
                      <li>Enter Ambulance Registration Vehicle ID</li>
                    ) : !isVehicleValid ? (
                      <li className="text-amber-400 font-medium">
                        Vehicle ID must end with 4 digits (e.g. KA-05-EM-0108)
                      </li>
                    ) : null
                  )}
                  {selectedRole === "police" && !badgeNumber.trim() && (
                    <li>Enter Traffic Control Badge ID</li>
                  )}
                </ul>
              </div>
            )}
          </div>

          <div className="text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>Capacitor Mobile Native App Ready (Android GPS & Push Enabled)</span>
          </div>
        </form>
      </div>
    </div>
  );
};


