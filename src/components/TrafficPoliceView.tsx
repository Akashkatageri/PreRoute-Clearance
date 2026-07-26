import React, { useState, useEffect, useRef } from "react";
import { Siren, Shield, CheckCircle, Clock, Navigation, AlertTriangle, LogOut, Radio } from "lucide-react";
import { Emergency, Role, UserSession } from "../types";
import { realtimeService } from "../services/realtime";
import { MapView } from "./MapView";
import { NotificationService } from "../services/notification";

interface TrafficPoliceViewProps {
  onSwitchRole: (role: Role) => void;
  emergencies: Emergency[];
  userSession?: UserSession;
  onLogout?: () => void;
}

export const TrafficPoliceView: React.FC<TrafficPoliceViewProps> = ({
  onSwitchRole,
  emergencies,
  userSession,
  onLogout
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<"all" | "pending" | "acknowledged">("all");
  const [policePos, setPolicePos] = useState<[number, number] | null>(null);
  const seenEmergenciesRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef(true);

  // Track Police Officer's current GPS location
  useEffect(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPolicePos([pos.coords.latitude, pos.coords.longitude]);
      },
      (err) => console.warn("Police GPS notice:", err),
      { enableHighAccuracy: true, timeout: 6000 }
    );
  }, []);

  // Active non-completed and non-cleared emergencies with guaranteed field fallbacks
  const activeList = emergencies
    .filter((e) => e && e.status !== "completed" && e.status !== "cleared" && e.id !== "EMG-537" && e.vehicleId !== "EMG-537")
    .map((e) => {
      const vId = (e.vehicleId && e.vehicleId.trim()) || e.id || "AMBULANCE";
      const dName = (e.destinationName && e.destinationName.trim()) || "Hospital";
      const dAddr = (e.destinationAddress && e.destinationAddress.trim()) || dName;
      const eta = typeof e.etaMinutes === "number" && !isNaN(e.etaMinutes) && e.etaMinutes >= 0 ? e.etaMinutes : 3;
      const dist = typeof e.distanceKm === "number" && !isNaN(e.distanceKm) && e.distanceKm >= 0 ? e.distanceKm : 2.5;
      const created = (e.createdAt && e.createdAt.trim()) || "Just now";
      const prio = e.priority || "critical";

      return {
        ...e,
        vehicleId: vId,
        destinationName: dName,
        destinationAddress: dAddr,
        etaMinutes: eta,
        distanceKm: dist,
        createdAt: created,
        priority: prio
      };
    });

  const pendingList = activeList.filter((e) => e.status !== "acknowledged");
  const acknowledgedList = activeList.filter((e) => e.status === "acknowledged");

  const displayList =
    filterMode === "pending"
      ? pendingList
      : filterMode === "acknowledged"
      ? acknowledgedList
      : activeList;

  // Request all mobile permissions (Location & Push Notifications) on mount
  useEffect(() => {
    NotificationService.requestAllPermissions().catch((e) =>
      console.warn("Permission request error:", e)
    );
  }, []);

  // Default selection
  useEffect(() => {
    if (!selectedId && activeList.length > 0) {
      setSelectedId(activeList[0].id);
    } else if (selectedId && !activeList.some((e) => e.id === selectedId) && activeList.length > 0) {
      setSelectedId(activeList[0].id);
    }
  }, [activeList, selectedId]);

  // Audio alert chime & native push notification when any new emergency comes in
  useEffect(() => {
    // Populate seen set on initial load without firing alerts for old historical records
    if (isInitialLoadRef.current) {
      emergencies.forEach((emg) => {
        if (emg && emg.id) {
          seenEmergenciesRef.current.add(emg.id);
        }
      });
      isInitialLoadRef.current = false;
      return;
    }

    emergencies.forEach((emg) => {
      if (emg && emg.status !== "completed" && !seenEmergenciesRef.current.has(emg.id)) {
        seenEmergenciesRef.current.add(emg.id);

        const vehicle = emg.vehicleId || "Ambulance";
        const dest = emg.destinationName || "Hospital";
        const eta = emg.etaMinutes || 0;

        // Send native Capacitor Local Notification (Android notification tray & banner) + Web Notification
        NotificationService.sendNotification(
          `🚨 EMERGENCY DISPATCH: ${vehicle}`,
          `Heading to ${dest}. ETA: ${eta}m.`
        );

        // Audio siren chime
        try {
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(880, audioCtx.currentTime); // High pitch siren beep
          osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.5);
          gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start();
          osc.stop(audioCtx.currentTime + 0.5);
        } catch (e) {
          console.warn("Audio playback prevented by browser policy:", e);
        }
      }
    });
  }, [emergencies]);

  const selectedEmergency = activeList.find((e) => e.id === selectedId) || activeList[0];

  const handleAcknowledge = async () => {
    if (selectedEmergency) {
      try {
        await realtimeService.updateStatus(selectedEmergency.id, "acknowledged");
      } catch (e) {
        console.warn("Acknowledge error:", e);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col pb-6">
      {/* Top Header */}
      <header className="w-full bg-slate-900 text-white border-b border-slate-800 px-3 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="bg-red-500/20 text-red-500 p-2 rounded-xl border border-red-500/30 shrink-0">
            <Shield className="w-5 h-5 text-red-500" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-extrabold text-white text-sm sm:text-base truncate">
                Traffic Control
              </span>
              <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-emerald-500/30 uppercase flex items-center gap-1 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE RADAR
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium truncate">
              {userSession ? `${userSession.name} (${userSession.badgeNumber || "Badge #402"})` : "Control Officer Console"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              if (onLogout) onLogout();
              else onSwitchRole("select");
            }}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-200 font-bold text-xs px-3 py-2.5 rounded-xl border border-slate-700 transition-colors cursor-pointer min-h-[40px]"
            id="btn-police-logout"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4 text-slate-400" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Mobile Horizontal Selector Bar (Visible only on screens < lg) */}
      {activeList.length > 0 && (
        <div className="lg:hidden bg-slate-900 px-3 py-2.5 border-b border-slate-800 sticky top-[57px] z-20 flex flex-col gap-2 shadow-inner">
          <div className="flex items-center gap-1.5 bg-slate-850 p-1 rounded-xl text-[10px] font-bold">
            <button
              onClick={() => setFilterMode("all")}
              className={`px-2.5 py-1 rounded-lg transition-all ${filterMode === "all" ? "bg-slate-700 text-white shadow-xs" : "text-slate-400"}`}
            >
              All ({activeList.length})
            </button>
            <button
              onClick={() => setFilterMode("pending")}
              className={`px-2.5 py-1 rounded-lg transition-all ${filterMode === "pending" ? "bg-red-600 text-white shadow-xs" : "text-slate-400"}`}
            >
              Pending ({pendingList.length})
            </button>
            <button
              onClick={() => setFilterMode("acknowledged")}
              className={`px-2.5 py-1 rounded-lg transition-all ${filterMode === "acknowledged" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-400"}`}
            >
              Acknowledged ({acknowledgedList.length})
            </button>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar min-w-max">
            {displayList.map((emg, idx) => {
              const isSelected = selectedEmergency?.id === emg.id;
              const isAck = emg.status === "acknowledged";
              return (
                <button
                  key={emg.id || `emg-bar-${idx}`}
                  onClick={() => setSelectedId(emg.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border ${
                    isSelected
                      ? isAck ? "bg-emerald-600 text-white border-emerald-500 shadow-md ring-2 ring-emerald-400/40" : "bg-red-600 text-white border-red-500 shadow-md ring-2 ring-red-400/40"
                      : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750"
                  }`}
                >
                  <Siren className="w-3.5 h-3.5 animate-pulse shrink-0" />
                  <span>{emg.vehicleId}</span>
                  {isAck && (
                    <span className="bg-emerald-400 text-slate-950 font-black text-[9px] px-1.5 py-0.2 rounded-md">
                      ✓ ACK
                    </span>
                  )}
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${isSelected ? "bg-white/20 text-white" : "bg-slate-900 text-slate-400"}`}>
                    {emg.etaMinutes}m
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        {/* Left Column: Active Emergencies Sidebar (Desktop) */}
        <aside className="hidden lg:flex lg:col-span-4 flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              ACTIVE RADAR ({activeList.length})
            </h2>
          </div>

          {/* Filter Tabs */}
          <div className="grid grid-cols-3 gap-1 bg-slate-200/80 p-1 rounded-xl text-[11px] font-extrabold text-slate-600">
            <button
              onClick={() => setFilterMode("all")}
              className={`py-1.5 rounded-lg transition-all cursor-pointer ${filterMode === "all" ? "bg-white text-slate-900 shadow-xs" : "hover:text-slate-900"}`}
            >
              All ({activeList.length})
            </button>
            <button
              onClick={() => setFilterMode("pending")}
              className={`py-1.5 rounded-lg transition-all cursor-pointer ${filterMode === "pending" ? "bg-red-600 text-white shadow-xs" : "hover:text-slate-900"}`}
            >
              Pending ({pendingList.length})
            </button>
            <button
              onClick={() => setFilterMode("acknowledged")}
              className={`py-1.5 rounded-lg transition-all cursor-pointer ${filterMode === "acknowledged" ? "bg-emerald-600 text-white shadow-xs" : "hover:text-slate-900"}`}
            >
              Ack ({acknowledgedList.length})
            </button>
          </div>

          {displayList.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center text-slate-400 flex flex-col items-center shadow-xs">
              <CheckCircle className="w-10 h-10 mb-2 text-emerald-500 opacity-80" />
              <p className="font-semibold text-slate-700">No Routes in this view</p>
              <p className="text-xs mt-1">All emergency green corridors are clear.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {displayList.map((emg, idx) => {
                const isSelected = selectedEmergency?.id === emg.id;
                const isAck = emg.status === "acknowledged";
                return (
                  <button
                    key={emg.id || `emg-sidebar-${idx}`}
                    onClick={() => setSelectedId(emg.id)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2 ${
                      isSelected
                        ? isAck ? "bg-white border-emerald-500 shadow-md ring-2 ring-emerald-100" : "bg-white border-red-500 shadow-md ring-2 ring-red-100"
                        : "bg-white border-slate-200 hover:border-slate-300 shadow-2xs"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`p-1.5 rounded-lg shrink-0 ${isAck ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
                          <Siren className="w-4 h-4 animate-pulse" />
                        </div>
                        <span className="font-extrabold text-slate-900 text-base truncate">
                          {emg.vehicleId}
                        </span>
                        {isAck ? (
                          <span className="bg-emerald-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-md uppercase shrink-0 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> ACKNOWLEDGED
                          </span>
                        ) : (
                          <span className="bg-red-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase shrink-0">
                            {emg.priority || "critical"}
                          </span>
                        )}
                      </div>
                      <span className={`font-black text-xs px-2.5 py-1 rounded-lg shrink-0 ${isAck ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                        {emg.etaMinutes}m
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-1 font-medium">
                      {emg.destinationAddress}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        {/* Main Content View */}
        <main className="lg:col-span-8 flex flex-col gap-4 sm:gap-6">
          {selectedEmergency ? (
            <>
              {/* Emergency Active Card Header */}
              <div className={`text-white p-4 sm:p-6 rounded-3xl shadow-xl border transition-all flex flex-col gap-4 ${
                selectedEmergency.status === "acknowledged" ? "bg-slate-900 border-emerald-500/50" : "bg-slate-900 border-slate-800"
              }`}>
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className={`p-3 border rounded-2xl shrink-0 ${
                    selectedEmergency.status === "acknowledged" ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" : "bg-red-600/30 border-red-500/40 text-red-500"
                  }`}>
                    <Siren className="w-7 h-7 sm:w-8 sm:h-8 animate-pulse" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h2 className="text-base sm:text-lg font-black tracking-wide uppercase text-white">
                        {selectedEmergency.status === "acknowledged" ? "GREEN CORRIDOR ACKNOWLEDGED" : "EMERGENCY DISPATCH ACTIVE"}
                      </h2>
                      <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-md uppercase ${
                        selectedEmergency.status === "acknowledged" ? "bg-emerald-500 text-slate-950 font-black" : "bg-red-500 text-white"
                      }`}>
                        {selectedEmergency.priority || "critical"}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-300 font-semibold truncate">
                      {selectedEmergency.vehicleId} • {selectedEmergency.destinationAddress}
                    </p>

                    <div className="mt-2 text-xs font-medium flex items-center gap-1.5 flex-wrap">
                      {selectedEmergency.status === "active" && (
                        <span className="flex items-center gap-1 text-amber-300 font-bold bg-amber-950/80 border border-amber-800/80 px-2.5 py-1 rounded-lg">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Pending Officer Acknowledgment
                        </span>
                      )}
                      {selectedEmergency.status === "acknowledged" && (
                        <span className="flex items-center gap-1 text-emerald-300 font-bold bg-emerald-950/80 border border-emerald-800/80 px-2.5 py-1 rounded-lg">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> Acknowledged Green Corridor Active
                        </span>
                      )}
                      {selectedEmergency.status === "cleared" && (
                        <span className="flex items-center gap-1 text-emerald-200 font-bold bg-emerald-600 px-2.5 py-1 rounded-lg">
                          <CheckCircle className="w-3.5 h-3.5 text-white" /> Route Cleared & Verified
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Primary Action Button: Acknowledge Signal Priority */}
                <div className="pt-2 border-t border-slate-800/80">
                  <button
                    onClick={handleAcknowledge}
                    className={`w-full min-h-[48px] py-3 px-4 rounded-xl font-extrabold text-sm sm:text-base transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                      selectedEmergency.status === "acknowledged"
                        ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400 ring-2 ring-emerald-300/50"
                        : "bg-amber-400 hover:bg-amber-500 text-slate-950 active:scale-[0.98]"
                    }`}
                    id="btn-police-acknowledge"
                  >
                    {selectedEmergency.status === "acknowledged" ? (
                      <>
                        <CheckCircle className="w-5 h-5 text-slate-950" />
                        <span>✓ Signal Priority Acknowledged (Corridor Live)</span>
                      </>
                    ) : (
                      <>
                        <span className="text-base">🖐️</span>
                        <span>Acknowledge Signal & Pre-clear Route</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Metrics Row (Responsive 3-Column Grid) */}
              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-center sm:items-start gap-2 sm:gap-3 text-center sm:text-left">
                  <div className="p-2 sm:p-3 bg-red-50 text-red-500 rounded-xl shrink-0">
                    <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      ETA
                    </span>
                    <span className="text-base sm:text-2xl font-black text-slate-900 leading-tight">
                      {selectedEmergency.etaMinutes} min
                    </span>
                  </div>
                </div>

                <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-center sm:items-start gap-2 sm:gap-3 text-center sm:text-left">
                  <div className="p-2 sm:p-3 bg-amber-50 text-amber-500 rounded-xl shrink-0">
                    <Navigation className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      DISTANCE
                    </span>
                    <span className="text-base sm:text-2xl font-black text-slate-900 leading-tight">
                      {selectedEmergency.distanceKm} km
                    </span>
                  </div>
                </div>

                <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-center sm:items-start gap-2 sm:gap-3 text-center sm:text-left">
                  <div className="p-2 sm:p-3 bg-red-50 text-red-500 rounded-xl shrink-0">
                    <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      PRIORITY
                    </span>
                    <span className="text-base sm:text-2xl font-black text-red-600 uppercase leading-tight truncate">
                      {selectedEmergency.priority || "critical"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Map & Route Details Section */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6 items-start">
                {/* Route Details Card */}
                <div className="md:col-span-5 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-2xs flex flex-col gap-3 sm:gap-4">
                  <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-2">
                    Route Information
                  </h3>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                      DESTINATION HOSPITAL
                    </span>
                    <p className="text-xs sm:text-sm font-bold text-slate-800 leading-snug">
                      {selectedEmergency.destinationName}
                    </p>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {selectedEmergency.destinationAddress}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                        VEHICLE ID
                      </span>
                      <p className="text-xs sm:text-sm font-black text-slate-900 font-mono">
                        {selectedEmergency.vehicleId}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                        DISPATCH TIME
                      </span>
                      <p className="text-xs font-semibold text-slate-700">
                        {selectedEmergency.createdAt}
                      </p>
                    </div>
                  </div>

                  {/* Action Guidance Box */}
                  <div className="bg-sky-50/80 border border-sky-100 p-3 rounded-2xl text-xs text-sky-950 mt-1 flex flex-col gap-1">
                    <span className="font-extrabold text-sky-900 flex items-center gap-1 text-[11px]">
                      <AlertTriangle className="w-3.5 h-3.5 text-sky-600" /> Police Action Plan
                    </span>
                    <p className="leading-relaxed text-slate-600 text-[11px]">
                      Override traffic signals along the green corridor route. Keep intersections clear until ambulance passes post or driver completes trip.
                    </p>
                  </div>
                </div>

                {/* Map View */}
                <div className="md:col-span-7">
                  <MapView
                    startLat={selectedEmergency.startLat}
                    startLng={selectedEmergency.startLng}
                    currentLat={selectedEmergency.currentLat}
                    currentLng={selectedEmergency.currentLng}
                    destLat={selectedEmergency.destinationLat}
                    destLng={selectedEmergency.destinationLng}
                    routeGeometry={selectedEmergency.routeGeometry}
                    destinationName={selectedEmergency.destinationName}
                    vehicleId={selectedEmergency.vehicleId}
                    isEmergencyActive={selectedEmergency.status !== "completed"}
                    isAcknowledged={selectedEmergency.status === "acknowledged"}
                    policePos={policePos}
                    allEmergencies={emergencies}
                    selectedEmergencyId={selectedEmergency.id}
                    onSelectEmergency={setSelectedId}
                    height="320px"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-3xl p-8 sm:p-12 border border-slate-200 text-center text-slate-500 shadow-xs flex flex-col items-center gap-2">
              <Shield className="w-12 h-12 text-slate-300" />
              <p className="font-semibold text-slate-700">No Active Emergency Selected</p>
              <p className="text-xs text-slate-500 max-w-sm">When an ambulance dispatches an emergency signal, it will automatically appear on your live radar map here.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
