import React, { useState, useEffect, useRef } from "react";
import { Siren, Shield, CheckCircle, Clock, Navigation, AlertTriangle, ArrowLeft, Volume2, LogOut, Radio } from "lucide-react";
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
  const prevCountRef = useRef(emergencies.length);

  // Active non-completed emergencies
  const activeList = emergencies.filter((e) => e.status !== "completed");

  // Default selection
  useEffect(() => {
    if (!selectedId && activeList.length > 0) {
      setSelectedId(activeList[0].id);
    } else if (selectedId && !activeList.some((e) => e.id === selectedId) && activeList.length > 0) {
      setSelectedId(activeList[0].id);
    }
  }, [activeList, selectedId]);

  // Audio alert chime & push notification when new emergency comes in
  useEffect(() => {
    if (emergencies.length > prevCountRef.current) {
      const latest = emergencies[emergencies.length - 1];
      if (latest && latest.status !== "completed") {
        NotificationService.sendNotification(
          `🚨 EMERGENCY DISPATCH: ${latest.vehicleId}`,
          `Heading to ${latest.destinationName}. Clear green corridor!`
        );
      }

      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); // High pitch siren beep
        osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
      } catch (e) {
        console.warn("Audio playback prevented by browser policy:", e);
      }
    }
    prevCountRef.current = emergencies.length;
  }, [emergencies.length]);

  const selectedEmergency = activeList.find((e) => e.id === selectedId) || activeList[0];

  const handleAcknowledge = async () => {
    if (selectedEmergency) {
      await realtimeService.updateStatus(selectedEmergency.id, "acknowledged");
    }
  };

  const handleMarkCleared = async () => {
    if (selectedEmergency) {
      await realtimeService.updateStatus(selectedEmergency.id, "cleared");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Header */}
      <header className="w-full bg-slate-900 text-white border-b border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="bg-red-500/20 text-red-500 p-2 rounded-xl border border-red-500/30">
              <Shield className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-white text-base">
                  Traffic Control Command Center
                </span>
                <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-emerald-500/30 uppercase flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  LIVE RADAR
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                {userSession ? `${userSession.name} (${userSession.badgeNumber || "Badge #402"})` : "Control Officer Console"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (onLogout) onLogout();
              else onSwitchRole("select");
            }}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs px-3 py-2 rounded-xl border border-slate-700 transition-colors cursor-pointer"
            id="btn-police-logout"
            title="Logout / Switch Portal"
          >
            <LogOut className="w-4 h-4 text-slate-400" />
            <span className="hidden sm:inline">Switch Portal</span>
          </button>
        </div>
      </header>

      {/* Main Layout Grid */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Active Emergencies Sidebar */}
        <aside className="lg:col-span-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              ACTIVE EMERGENCIES ({activeList.length})
            </h2>
          </div>

          {activeList.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center text-slate-400 flex flex-col items-center">
              <CheckCircle className="w-10 h-10 mb-2 text-emerald-500 opacity-80" />
              <p className="font-semibold text-slate-700">No Active Emergencies</p>
              <p className="text-xs mt-1">All green corridors are clear.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {activeList.map((emg) => {
                const isSelected = selectedEmergency?.id === emg.id;
                return (
                  <button
                    key={emg.id}
                    onClick={() => setSelectedId(emg.id)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2 ${
                      isSelected
                        ? "bg-white border-red-500 shadow-md ring-2 ring-red-100"
                        : "bg-white border-slate-200 hover:border-slate-300 shadow-2xs"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-red-50 text-red-600 rounded-lg">
                          <Siren className="w-4 h-4 animate-pulse" />
                        </div>
                        <span className="font-extrabold text-slate-900 text-base">
                          {emg.vehicleId}
                        </span>
                        <span className="bg-red-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase">
                          {emg.priority}
                        </span>
                      </div>
                      <span className="bg-red-50 text-red-600 font-black text-xs px-2.5 py-1 rounded-lg">
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

        {/* Right Main Area */}
        <main className="lg:col-span-8 flex flex-col gap-6">
          {selectedEmergency ? (
            <>
              {/* Emergency Active Header Banner */}
              <div className="bg-red-600 text-white p-5 sm:p-6 rounded-3xl shadow-xl border border-red-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-white/20 rounded-2xl shrink-0">
                    <Siren className="w-8 h-8 text-white animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h2 className="text-lg font-black tracking-wide uppercase">
                        EMERGENCY ACTIVE
                      </h2>
                      <span className="bg-white/20 text-white text-xs font-bold px-2.5 py-0.5 rounded-md uppercase">
                        {selectedEmergency.priority}
                      </span>
                    </div>

                    <p className="text-sm text-red-100 font-semibold max-w-lg">
                      {selectedEmergency.vehicleId} • {selectedEmergency.destinationAddress}
                    </p>

                    <div className="mt-2 text-xs text-red-200 font-medium flex items-center gap-1.5">
                      {selectedEmergency.status === "active" && (
                        <span className="flex items-center gap-1 text-amber-200 font-bold bg-amber-500/30 px-2.5 py-0.5 rounded-md">
                          <AlertTriangle className="w-3.5 h-3.5" /> Not yet acknowledged
                        </span>
                      )}
                      {selectedEmergency.status === "acknowledged" && (
                        <span className="flex items-center gap-1 text-emerald-200 font-bold bg-emerald-500/30 px-2.5 py-0.5 rounded-md">
                          <CheckCircle className="w-3.5 h-3.5" /> Acknowledged by Police
                        </span>
                      )}
                      {selectedEmergency.status === "cleared" && (
                        <span className="flex items-center gap-1 text-white font-bold bg-emerald-600 px-2.5 py-0.5 rounded-md">
                          <CheckCircle className="w-3.5 h-3.5" /> Route Cleared
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions Row */}
                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  <button
                    onClick={handleAcknowledge}
                    className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-extrabold text-sm px-4 py-2.5 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    id="btn-police-acknowledge"
                  >
                    🖐️ Acknowledge
                  </button>
                  <button
                    onClick={handleMarkCleared}
                    className="bg-white hover:bg-slate-100 text-slate-900 font-extrabold text-sm px-4 py-2.5 rounded-xl shadow-xs transition-colors border border-slate-200 flex items-center gap-1.5 cursor-pointer"
                    id="btn-police-mark-cleared"
                  >
                    ✓ Mark Cleared
                  </button>
                </div>
              </div>

              {/* Metrics Row */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
                  <div className="p-3 bg-red-50 text-red-500 rounded-xl">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      ETA
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-slate-900">
                      {selectedEmergency.etaMinutes} min
                    </span>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
                  <div className="p-3 bg-amber-50 text-amber-500 rounded-xl">
                    <Navigation className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      DISTANCE
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-slate-900">
                      {selectedEmergency.distanceKm} km
                    </span>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
                  <div className="p-3 bg-red-50 text-red-500 rounded-xl">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      PRIORITY
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-red-600 uppercase">
                      {selectedEmergency.priority}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Section: Details + Map */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                {/* Left: Route Details Card */}
                <div className="md:col-span-5 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs flex flex-col gap-4">
                  <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-2">
                    Route Details
                  </h3>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                      DESTINATION
                    </span>
                    <p className="text-xs font-semibold text-slate-800 leading-snug">
                      {selectedEmergency.destinationAddress}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                      VEHICLE ID
                    </span>
                    <p className="text-sm font-black text-slate-900">
                      {selectedEmergency.vehicleId}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                      ALERT CREATED
                    </span>
                    <p className="text-xs font-semibold text-slate-700">
                      {selectedEmergency.createdAt}
                    </p>
                  </div>

                  {/* Action Required Box */}
                  <div className="bg-sky-50/70 border border-sky-100 p-3.5 rounded-2xl text-xs text-sky-900 mt-2 flex flex-col gap-1">
                    <span className="font-extrabold text-sky-950 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-sky-600" /> Action Required
                    </span>
                    <p className="leading-relaxed text-slate-600 text-[11px]">
                      Clear all intersections along the highlighted red route. Maintain green corridor until vehicle passes.
                    </p>
                  </div>
                </div>

                {/* Right: Map View */}
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
                    height="380px"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center text-slate-500">
              <p>Select an emergency from the sidebar to inspect route and clear traffic.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
