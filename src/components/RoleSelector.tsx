import React, { useState } from "react";
import { ShieldAlert, Ambulance, Shield, CheckCircle2, AlertCircle, Radio, KeyRound } from "lucide-react";
import { Role, UserSession } from "../types";
import { NotificationService } from "../services/notification";

interface RoleSelectorProps {
  onLogin: (session: UserSession) => void;
}

export const RoleSelector: React.FC<RoleSelectorProps> = ({ onLogin }) => {
  const [selectedRole, setSelectedRole] = useState<"driver" | "police">("driver");
  const [vehicleId, setVehicleId] = useState("KA-05-EM-108");
  const [badgeNumber, setBadgeNumber] = useState("BLR-TP-402");
  const [officerName, setOfficerName] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [googleAccount, setGoogleAccount] = useState<{
    name: string;
    email: string;
    avatarUrl: string;
  } | null>(null);

  // Simulated Google Native / OAuth Sign-In
  const handleGoogleSignIn = () => {
    setIsLoggingIn(true);
    setTimeout(() => {
      // Mock authenticated Google account
      const mockGoogle = {
        name: selectedRole === "driver" ? "Ramesh Kumar (Driver)" : "Inspector Vijay Rao",
        email: selectedRole === "driver" ? "ramesh.driver@emergency.gov.in" : "vijay.police@karnataka.gov.in",
        avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
      };
      setGoogleAccount(mockGoogle);
      if (!officerName) setOfficerName(mockGoogle.name);
      setIsLoggingIn(false);
      NotificationService.requestPermission();
    }, 600);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const name = officerName.trim() || (selectedRole === "driver" ? "Ambulance Driver" : "Traffic Control Officer");
    const email = googleAccount?.email || `${selectedRole}_${Date.now()}@preclear.gov.in`;
    const avatarUrl = googleAccount?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${name}`;

    const session: UserSession = {
      id: `usr_${Date.now()}`,
      name,
      email,
      avatarUrl,
      role: selectedRole,
      vehicleId: selectedRole === "driver" ? vehicleId : undefined,
      badgeNumber: selectedRole === "police" ? badgeNumber : undefined,
      loginProvider: googleAccount ? "google" : "native",
      loggedAt: new Date().toISOString()
    };

    // Save session to localStorage for persistence
    localStorage.setItem("ambulance_preclear_session", JSON.stringify(session));
    onLogin(session);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Background Decorative Glow */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-red-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-xl w-full relative z-10 flex flex-col items-center">
        {/* Header Branding */}
        <div className="flex items-center gap-3 bg-slate-800/80 px-4 py-2 rounded-full border border-slate-700/80 mb-6 shadow-inner">
          <ShieldAlert className="w-5 h-5 text-red-500 animate-pulse" />
          <span className="text-xs font-black tracking-widest text-slate-300 uppercase">
            Emergency Pre-Clear Portal
          </span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight text-center mb-2">
          Ambulance<span className="text-red-500">PreClear</span>
        </h1>
        <p className="text-slate-400 text-sm sm:text-base text-center mb-8 max-w-md">
          Authenticate to access your designated emergency response dashboard.
        </p>

        {/* Login Card */}
        <form
          onSubmit={handleSubmit}
          className="w-full bg-slate-800/90 backdrop-blur-md p-6 sm:p-8 rounded-3xl border border-slate-700 shadow-2xl flex flex-col gap-6"
        >
          {/* STEP 1: Select Role */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              1. Choose Your Portal Session
            </label>
            <div className="grid grid-cols-2 gap-4">
              {/* Ambulance Driver Option */}
              <button
                type="button"
                onClick={() => setSelectedRole("driver")}
                className={`p-4 rounded-2xl border text-left transition-all duration-200 flex flex-col gap-2 cursor-pointer ${
                  selectedRole === "driver"
                    ? "bg-blue-600/20 border-blue-500 text-white shadow-lg ring-2 ring-blue-500/50"
                    : "bg-slate-900/50 border-slate-700/80 text-slate-400 hover:border-slate-600"
                }`}
                id="role-btn-driver"
              >
                <div className="flex items-center justify-between w-full">
                  <div className={`p-2 rounded-xl ${selectedRole === "driver" ? "bg-blue-500 text-white" : "bg-slate-800 text-slate-400"}`}>
                    <Ambulance className="w-5 h-5" />
                  </div>
                  {selectedRole === "driver" && <CheckCircle2 className="w-5 h-5 text-blue-400" />}
                </div>
                <div>
                  <h3 className="font-black text-sm text-white">Ambulance Driver</h3>
                  <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                    Navigate route & dispatch emergency signal
                  </p>
                </div>
              </button>

              {/* Traffic Police Option */}
              <button
                type="button"
                onClick={() => setSelectedRole("police")}
                className={`p-4 rounded-2xl border text-left transition-all duration-200 flex flex-col gap-2 cursor-pointer ${
                  selectedRole === "police"
                    ? "bg-red-600/20 border-red-500 text-white shadow-lg ring-2 ring-red-500/50"
                    : "bg-slate-900/50 border-slate-700/80 text-slate-400 hover:border-slate-600"
                }`}
                id="role-btn-police"
              >
                <div className="flex items-center justify-between w-full">
                  <div className={`p-2 rounded-xl ${selectedRole === "police" ? "bg-red-500 text-white" : "bg-slate-800 text-slate-400"}`}>
                    <Shield className="w-5 h-5" />
                  </div>
                  {selectedRole === "police" && <CheckCircle2 className="w-5 h-5 text-red-400" />}
                </div>
                <div>
                  <h3 className="font-black text-sm text-white">Traffic Police</h3>
                  <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                    Control room radar & live signal clearance
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* STEP 2: Google Native Auth or Official ID */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              2. Authentication Method
            </label>

            {googleAccount ? (
              <div className="bg-slate-900/80 p-3 rounded-2xl border border-emerald-500/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={googleAccount.avatarUrl}
                    alt={googleAccount.name}
                    className="w-10 h-10 rounded-full border border-emerald-400 object-cover"
                  />
                  <div>
                    <div className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Authenticated via Google
                    </div>
                    <div className="text-sm font-black text-white">{googleAccount.name}</div>
                    <div className="text-[11px] text-slate-400">{googleAccount.email}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setGoogleAccount(null)}
                  className="text-xs text-slate-400 hover:text-white underline px-2 py-1"
                >
                  Change
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoggingIn}
                className="w-full bg-slate-900 hover:bg-slate-950 text-slate-100 font-bold py-3.5 px-4 rounded-2xl border border-slate-700 hover:border-slate-600 transition-all flex items-center justify-center gap-3 shadow-md cursor-pointer disabled:opacity-50"
                id="btn-google-signin"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{isLoggingIn ? "Connecting Google Account..." : "Continue with Google Native Login"}</span>
              </button>
            )}
          </div>

          {/* STEP 3: Role Specific Credentials */}
          <div className="flex flex-col gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-700/60">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Display / Officer Name
              </label>
              <input
                type="text"
                value={officerName}
                onChange={(e) => setOfficerName(e.target.value)}
                placeholder={selectedRole === "driver" ? "e.g. Ramesh Kumar" : "e.g. Inspector Vijay"}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {selectedRole === "driver" ? (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Ambulance Registration Vehicle ID
                </label>
                <input
                  type="text"
                  value={vehicleId}
                  onChange={(e) => setVehicleId(e.target.value)}
                  placeholder="KA-05-EM-108"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                  required
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Traffic Control Badge / Inspector ID
                </label>
                <input
                  type="text"
                  value={badgeNumber}
                  onChange={(e) => setBadgeNumber(e.target.value)}
                  placeholder="BLR-TP-402"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 font-mono"
                  required
                />
              </div>
            )}
          </div>

          {/* Login Submit Button */}
          <button
            type="submit"
            className={`w-full font-black text-base py-4 px-6 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider ${
              selectedRole === "driver"
                ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30"
                : "bg-red-600 hover:bg-red-500 text-white shadow-red-600/30"
            }`}
            id="btn-enter-portal"
          >
            <span>
              Enter {selectedRole === "driver" ? "Ambulance Driver" : "Traffic Police"} Portal
            </span>
          </button>

          <div className="text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>Capacitor Mobile Native App Ready (Android GPS & Push Enabled)</span>
          </div>
        </form>
      </div>
    </div>
  );
};
