import React, { useState, useEffect } from "react";
import { ShieldAlert, Ambulance, Shield, CheckCircle2, AlertCircle, Radio, Sparkles, Lock, LogOut, UserCheck } from "lucide-react";
import { Role, UserSession } from "../types";
import { NotificationService } from "../services/notification";
import { auth, db, googleProvider, signInWithGoogleNativeOrWeb, signOutUser } from "../lib/firebase";
import { Capacitor } from "@capacitor/core";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

interface RoleSelectorProps {
  onLogin: (session: UserSession) => void;
}

export const RoleSelector: React.FC<RoleSelectorProps> = ({ onLogin }) => {
  const [selectedRole, setSelectedRole] = useState<"driver" | "police">("driver");
  const [vehicleId, setVehicleId] = useState("");
  const [badgeNumber, setBadgeNumber] = useState("");
  const [officerName, setOfficerName] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isProfileRestored, setIsProfileRestored] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [googleAccount, setGoogleAccount] = useState<{
    name: string;
    email: string;
    avatarUrl: string;
  } | null>(null);

  // Load saved profile for a Google account from local storage or Firestore
  const loadSavedUserProfile = async (email: string, uid?: string) => {
    const normalizedEmail = email.toLowerCase().trim();
    if (!normalizedEmail) return null;

    const localKey = `preroute_profile_${normalizedEmail}`;
    let profile: any = null;

    // 1. Check LocalStorage ONLY if it strictly matches this Google account's email
    try {
      const localData = localStorage.getItem(localKey);
      if (localData) {
        const parsed = JSON.parse(localData);
        if (parsed && (parsed.email || "").toLowerCase() === normalizedEmail && (parsed.name || parsed.officerName || parsed.vehicleId || parsed.badgeNumber)) {
          profile = parsed;
        }
      }
    } catch (e) {
      console.warn("Error reading local cached profile:", e);
    }

    // 2. Query Firestore (Source of truth across Web and Android devices for the same Google account)
    try {
      // Query by normalized email document ID
      const userRefByEmail = doc(db, "users", normalizedEmail);
      const userSnapByEmail = await getDoc(userRefByEmail);
      if (userSnapByEmail.exists()) {
        const remoteProfile = userSnapByEmail.data();
        if (remoteProfile && (remoteProfile.name || remoteProfile.vehicleId || remoteProfile.badgeNumber)) {
          profile = { ...profile, ...remoteProfile };
        }
      }

      // Query by UID document ID as secondary fallback
      if ((!profile || (!profile.vehicleId && !profile.badgeNumber)) && uid) {
        const userRefByUid = doc(db, "users", uid);
        const userSnapByUid = await getDoc(userRefByUid);
        if (userSnapByUid.exists()) {
          const remoteProfile = userSnapByUid.data();
          if (remoteProfile && (remoteProfile.name || remoteProfile.vehicleId || remoteProfile.badgeNumber)) {
            profile = { ...profile, ...remoteProfile };
          }
        }
      }

      // Cache the synced Firestore profile locally for fast offline access
      if (profile) {
        localStorage.setItem(localKey, JSON.stringify(profile));
        localStorage.setItem("ambulance_preclear_last_credentials", JSON.stringify(profile));
      }
    } catch (e) {
      console.warn("Could not fetch remote user profile from Firestore:", e);
    }

    return profile;
  };

  // Helper to apply user profile data to form state and auto-enter portal for registered accounts
  const applyGoogleUserAndProfile = async (user: any, autoNavigate = true) => {
    const email = (user.email || "").toLowerCase().trim() || `${selectedRole}@preclear.gov.in`;
    const avatarUrl = user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid || email}`;

    setGoogleAccount({
      name: user.displayName || officerName || "",
      email,
      avatarUrl
    });

    const savedProfile = user.email ? await loadSavedUserProfile(user.email, user.uid) : null;

    if (savedProfile && (savedProfile.role === "driver" || savedProfile.role === "police") && (savedProfile.name || savedProfile.officerName)) {
      const pRole = savedProfile.role as "driver" | "police";
      const pName = (savedProfile.name || savedProfile.officerName || user.displayName || "Officer").trim();
      const pVehicleId = (savedProfile.vehicleId || "").trim();
      const pBadgeNumber = (savedProfile.badgeNumber || "").trim();

      const isRegistered = pRole === "driver" ? isValidVehicleId(pVehicleId) : pBadgeNumber !== "";

      setSelectedRole(pRole);
      setOfficerName(pName);
      if (pVehicleId) setVehicleId(pVehicleId);
      if (pBadgeNumber) setBadgeNumber(pBadgeNumber);
      setIsProfileRestored(true);

      // Existing registered account: Bypasses registration screen and automatically opens portal
      if (isRegistered && autoNavigate) {
        const session: UserSession = {
          id: `usr_${Date.now()}`,
          name: pName,
          email,
          avatarUrl,
          role: pRole,
          vehicleId: pRole === "driver" ? pVehicleId : undefined,
          badgeNumber: pRole === "police" ? pBadgeNumber : undefined,
          loginProvider: "google",
          loggedAt: new Date().toISOString()
        };

        const profileToSave = {
          email,
          uid: user.uid || "",
          name: pName,
          avatarUrl,
          role: pRole,
          vehicleId: pRole === "driver" ? pVehicleId : undefined,
          badgeNumber: pRole === "police" ? pBadgeNumber : undefined,
          updatedAt: new Date().toISOString()
        };

        localStorage.setItem("ambulance_preclear_session", JSON.stringify(session));
        localStorage.setItem("ambulance_preclear_last_credentials", JSON.stringify(profileToSave));
        localStorage.setItem(`preroute_profile_${email}`, JSON.stringify(profileToSave));

        NotificationService.requestAllPermissions().catch(() => {});

        onLogin(session);
        return;
      }
    } else {
      // First-time registration for a new Google account: Show 1-time setup form
      setIsProfileRestored(false);
      setIsEditingProfile(true);
      if (user.displayName && !officerName) {
        setOfficerName(user.displayName);
      }
    }
  };

  // Pre-fill initial saved credentials on mount so user sees them immediately in Android/Web
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

  // Listen to Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await applyGoogleUserAndProfile(user);
      } else {
        setGoogleAccount(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Handle Google Sign-In (Authenticates Google account & populates profile)
  const handleGoogleSignIn = async () => {
    setIsLoggingIn(true);
    setAuthError(null);

    try {
      const user = await signInWithGoogleNativeOrWeb();
      await applyGoogleUserAndProfile(user);
    } catch (err: any) {
      console.warn("Firebase Google Sign-In failed or was closed:", err);
      if (err.code === "auth/popup-blocked" || err.code === "auth/cancelled-popup-request" || err.code === "auth/popup-closed-by-user") {
        setAuthError("Sign-in prompt closed or blocked. Please retry Google Sign-In.");
      } else {
        setAuthError(err.message || "Google Sign-In failed. Please try again.");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Handle Sign Out from Google
  const handleSignOutGoogle = async () => {
    try {
      await signOutUser();
      setGoogleAccount(null);
      setIsProfileRestored(false);
      setOfficerName("");
      setVehicleId("");
      setBadgeNumber("");
    } catch (e) {
      console.warn("Sign out error:", e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    const name = officerName.trim();
    const currentUser = auth.currentUser;
    const email = (currentUser?.email || googleAccount?.email || `${selectedRole}_${Date.now()}@preclear.gov.in`).toLowerCase().trim();
    const uid = currentUser?.uid || "";
    const avatarUrl = currentUser?.photoURL || googleAccount?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${name}`;

    const session: UserSession = {
      id: `usr_${Date.now()}`,
      name,
      email,
      avatarUrl,
      role: selectedRole,
      vehicleId: selectedRole === "driver" ? vehicleId.trim() : undefined,
      badgeNumber: selectedRole === "police" ? badgeNumber.trim() : undefined,
      loginProvider: "google",
      loggedAt: new Date().toISOString()
    };

    const profileToSave = {
      email,
      uid,
      name,
      avatarUrl,
      role: selectedRole,
      vehicleId: selectedRole === "driver" ? vehicleId.trim() : undefined,
      badgeNumber: selectedRole === "police" ? badgeNumber.trim() : undefined,
      updatedAt: new Date().toISOString()
    };

    // Save profile to localStorage and Firestore (for sync across Web & Android)
    localStorage.setItem("ambulance_preclear_last_credentials", JSON.stringify(profileToSave));
    localStorage.setItem(`preroute_profile_${email}`, JSON.stringify(profileToSave));

    try {
      if (email) {
        await setDoc(doc(db, "users", email), profileToSave, { merge: true });
      }
      if (uid) {
        await setDoc(doc(db, "users", uid), profileToSave, { merge: true });
      }
    } catch (err) {
      console.warn("Could not save user profile to Firestore:", err);
    }

    // Save active session
    localStorage.setItem("ambulance_preclear_session", JSON.stringify(session));

    // Request native Android Location & Notification permissions upon portal entry
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

  const isLocked = Boolean(isProfileRestored && !isEditingProfile && googleAccount);

  const isFormValid = Boolean(
    googleAccount &&
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
          Google Authentication & Vehicle Registration Verification
        </p>

        {/* Login Card */}
        <form
          onSubmit={handleSubmit}
          className="w-full bg-slate-900/90 backdrop-blur-xl p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-2xl flex flex-col gap-6"
        >
          {/* STEP 1: Google Authentication */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-black">1</span>
                Google Account Authentication
              </label>
              {googleAccount && (
                <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <UserCheck className="w-3 h-3" /> Authenticated
                </span>
              )}
            </div>

            {googleAccount ? (
              <div className="bg-slate-950/80 p-4 rounded-2xl border border-emerald-500/40 flex items-center justify-between gap-3 shadow-inner">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={googleAccount.avatarUrl}
                    alt={googleAccount.name}
                    className="w-11 h-11 rounded-full border-2 border-emerald-400/80 object-cover shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-black text-white truncate">{googleAccount.name}</div>
                    <div className="text-xs text-slate-400 truncate">{googleAccount.email}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSignOutGoogle}
                  className="text-xs font-bold text-slate-400 hover:text-red-400 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                  title="Sign out of Google"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Switch</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoggingIn}
                  className="w-full bg-slate-950 hover:bg-slate-900 text-white font-black py-4 px-5 rounded-2xl border border-blue-500/50 hover:border-blue-400 transition-all flex items-center justify-center gap-3 shadow-lg shadow-blue-950/40 cursor-pointer disabled:opacity-50"
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
                  <span>{isLoggingIn ? "Connecting Google Account..." : "Continue with Google"}</span>
                </button>
                <p className="text-[11px] text-slate-400 text-center flex items-center justify-center gap-1">
                  <Lock className="w-3 h-3 text-amber-400" />
                  Google Authentication is required to unlock portal access
                </p>
              </div>
            )}

            {authError && (
              <div className="bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-xl text-amber-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{authError}</span>
              </div>
            )}
          </div>

          {/* STEP 2: Portal Credentials Section */}
          <div className="flex flex-col gap-5 transition-all duration-300">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-black">2</span>
              Portal Role & Vehicle Credentials
            </label>

            {isProfileRestored && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-2xl text-emerald-300 text-xs flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="truncate">Saved credentials restored ({selectedRole === "driver" ? vehicleId || "Ambulance" : badgeNumber || "Police"}).</span>
                </div>
                {!isEditingProfile ? (
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(true)}
                    className="text-[11px] font-bold text-amber-300 hover:text-amber-200 underline cursor-pointer shrink-0"
                  >
                    Edit Details
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(false)}
                    className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 underline cursor-pointer shrink-0"
                  >
                    Lock Fields
                  </button>
                )}
              </div>
            )}

            {/* Role Selection Tabs */}
            <div className="grid grid-cols-2 gap-3">
              {/* Ambulance Driver Option */}
              <button
                type="button"
                onClick={() => !isLocked && setSelectedRole("driver")}
                disabled={isLocked}
                className={`p-3.5 rounded-2xl border text-left transition-all duration-200 flex flex-col gap-1.5 ${
                  isLocked ? "cursor-not-allowed opacity-80" : "cursor-pointer"
                } ${
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
                    isLocked ? <Lock className="w-4 h-4 text-emerald-400" /> : <CheckCircle2 className="w-4 h-4 text-blue-400" />
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
                onClick={() => !isLocked && setSelectedRole("police")}
                disabled={isLocked}
                className={`p-3.5 rounded-2xl border text-left transition-all duration-200 flex flex-col gap-1.5 ${
                  isLocked ? "cursor-not-allowed opacity-80" : "cursor-pointer"
                } ${
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
                    isLocked ? <Lock className="w-4 h-4 text-emerald-400" /> : <CheckCircle2 className="w-4 h-4 text-red-400" />
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
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                <span>Display / Officer Name <span className="text-red-400">*</span></span>
                {isLocked && (
                  <span className="text-emerald-400 text-[11px] font-medium flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Locked
                  </span>
                )}
              </label>
              <input
                type="text"
                value={officerName}
                onChange={(e) => setOfficerName(e.target.value)}
                placeholder={selectedRole === "driver" ? "e.g. Ramesh Kumar" : "e.g. Inspector Vijay"}
                className={`w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 ${
                  isLocked ? "bg-slate-950/80 cursor-not-allowed text-slate-300" : ""
                }`}
                disabled={isLocked}
                readOnly={isLocked}
              />
            </div>

            {/* Role Specific Vehicle / Badge Field */}
            {selectedRole === "driver" ? (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                  <span>Ambulance Registration Vehicle ID <span className="text-red-400">*</span></span>
                  {isLocked ? (
                    <span className="text-emerald-400 text-[11px] font-medium flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Locked
                    </span>
                  ) : vehicleId.trim() && (
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
                    isLocked
                      ? "border-slate-800 bg-slate-950/80 cursor-not-allowed text-slate-300"
                      : vehicleId.trim()
                      ? isVehicleValid
                        ? "border-emerald-500/80 focus:border-emerald-400"
                        : "border-amber-500/80 focus:border-amber-400"
                      : "border-slate-800 focus:border-blue-500"
                  }`}
                  disabled={isLocked}
                  readOnly={isLocked}
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Format: 2 Letters + 2 Digits + 1-2 Letters + 4 Digits (e.g. <span className="text-slate-300 font-mono">KA-05-EM-0108</span>)
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                  <span>Traffic Control Badge / Inspector ID <span className="text-red-400">*</span></span>
                  {isLocked && (
                    <span className="text-emerald-400 text-[11px] font-medium flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Locked
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={badgeNumber}
                  onChange={(e) => setBadgeNumber(e.target.value)}
                  placeholder="BLR-TP-402"
                  className={`w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-red-500 font-mono ${
                    isLocked ? "bg-slate-950/80 cursor-not-allowed text-slate-300" : ""
                  }`}
                  disabled={isLocked}
                  readOnly={isLocked}
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
                  {!googleAccount && <li>Sign in with Google above</li>}
                  {googleAccount && !officerName.trim() && <li>Enter Display / Officer Name</li>}
                  {googleAccount && selectedRole === "driver" && (
                    !vehicleId.trim() ? (
                      <li>Enter Ambulance Registration Vehicle ID</li>
                    ) : !isVehicleValid ? (
                      <li className="text-amber-400 font-medium">
                        Vehicle ID must end with 4 digits (e.g. KA-05-EM-0108)
                      </li>
                    ) : null
                  )}
                  {googleAccount && selectedRole === "police" && !badgeNumber.trim() && (
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

