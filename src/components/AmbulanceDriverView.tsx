import React, { useState, useEffect, useRef } from "react";
import { Siren, X, Search, Clock, Navigation, CheckCircle, ArrowLeft, LogOut, ShieldCheck } from "lucide-react";
import { Emergency, HospitalResult, Priority, Role, UserSession } from "../types";
import { searchHospitals, calculateGeoapifyRoute } from "../services/geoapify";
import { realtimeService } from "../services/realtime";
import { MapView } from "./MapView";
import { NotificationToast } from "./NotificationToast";

interface AmbulanceDriverViewProps {
  onSwitchRole: (role: Role) => void;
  activeEmergencies: Emergency[];
  userSession?: UserSession;
  onLogout?: () => void;
}

function calculateHaversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const AmbulanceDriverView: React.FC<AmbulanceDriverViewProps> = ({
  onSwitchRole,
  activeEmergencies,
  userSession,
  onLogout
}) => {
  const [vehicleId, setVehicleId] = useState(userSession?.vehicleId || "KA-05-EM-108");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<HospitalResult[]>([]);
  const [selectedHospital, setSelectedHospital] = useState<HospitalResult | null>(null);
  const [priority, setPriority] = useState<Priority>("critical");
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const [gpsAccuracy, setGpsAccuracy] = useState<number>(12);
  const [gpsSpeed, setGpsSpeed] = useState<number | null>(0);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Route metrics
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [routeGeometry, setRouteGeometry] = useState<[number, number][]>([]);
  const [isCalculating, setIsCalculating] = useState(false);

  // Positions
  const [startPos, setStartPos] = useState({ lat: 12.8620, lng: 77.5280 });
  const [currentPos, setCurrentPos] = useState({ lat: 12.8620, lng: 77.5280 });

  // Notifications
  const [toastMessage, setToastMessage] = useState("EMERGENCY ALERT SENT!");
  const [toastSubtext, setToastSubtext] = useState("Traffic police have been notified with live road corridor.");
  const [showToast, setShowToast] = useState(false);

  // Active Emergency for this vehicle
  const activeEmergency = activeEmergencies.find(
    (e) => e.vehicleId === vehicleId && e.status !== "completed"
  );

  // Synchronize state with active emergency so route and destination remain visible until completed
  useEffect(() => {
    if (activeEmergency) {
      if (!selectedHospital && activeEmergency.destinationLat && activeEmergency.destinationLng) {
        setSelectedHospital({
          name: activeEmergency.destinationName,
          address: activeEmergency.destinationAddress || activeEmergency.destinationName,
          lat: activeEmergency.destinationLat,
          lng: activeEmergency.destinationLng
        });
      }
      if (activeEmergency.routeGeometry && activeEmergency.routeGeometry.length > 0 && routeGeometry.length === 0) {
        setRouteGeometry(activeEmergency.routeGeometry);
      }
      if (etaMinutes === null && activeEmergency.etaMinutes !== undefined) {
        setEtaMinutes(activeEmergency.etaMinutes);
      }
      if (distanceKm === null && activeEmergency.distanceKm !== undefined) {
        setDistanceKm(activeEmergency.distanceKm);
      }
    }
  }, [activeEmergency]);

  // Auto-detect when destination location is reached (< 80m distance)
  useEffect(() => {
    if (activeEmergency && activeEmergency.destinationLat && activeEmergency.destinationLng) {
      const distKm = calculateHaversineKm(
        currentPos.lat,
        currentPos.lng,
        activeEmergency.destinationLat,
        activeEmergency.destinationLng
      );

      if (distKm <= 0.08) { // Reached within 80 meters
        handleCompleteTrip();
        setToastMessage("HOSPITAL REACHED! 🎉");
        setToastSubtext(`${activeEmergency.destinationName} reached. Emergency route completed.`);
        setShowToast(true);
      }
    }
  }, [currentPos.lat, currentPos.lng, activeEmergency?.id]);

  // Get current device physical location via Geolocation API
  const handleDetectGPS = () => {
    if (!("geolocation" in navigator)) {
      setGpsError("Geolocation is not supported by your browser");
      return;
    }

    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setStartPos({ lat, lng });
        setCurrentPos({ lat, lng });
        setGpsAccuracy(Math.round(pos.coords.accuracy || 10));
        setGpsSpeed(pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0);

        if (selectedHospital) {
          handleCalculateRoute(selectedHospital, { lat, lng });
        }
      },
      (err) => {
        console.warn("GPS error:", err);
        setGpsError("GPS permission denied or unavailable. Using default location.");
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  // Initial GPS attempt on load
  useEffect(() => {
    handleDetectGPS();
  }, []);

  // Handle hospital search debounced
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      const results = await searchHospitals(searchQuery, currentPos.lat, currentPos.lng);
      setSearchResults(results);
      setIsSearching(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Calculate route action using real Geoapify road network routing
  const handleCalculateRoute = async (
    hospitalToUse = selectedHospital,
    fromPos = currentPos
  ) => {
    if (!hospitalToUse) return;
    setIsCalculating(true);

    const res = await calculateGeoapifyRoute(
      fromPos.lat,
      fromPos.lng,
      hospitalToUse.lat,
      hospitalToUse.lng
    );

    setDistanceKm(res.distanceKm);
    setEtaMinutes(res.etaMinutes);
    setRouteGeometry(res.geometry);
    setIsCalculating(false);
  };

  // Select hospital from search
  const handleSelectHospital = (h: HospitalResult) => {
    setSelectedHospital(h);
    setSearchQuery("");
    setShowDropdown(false);
    handleCalculateRoute(h, currentPos);
  };

  // Start Emergency Route
  const handleStartEmergency = async () => {
    if (!selectedHospital) return;

    let currentRoute = routeGeometry;
    let currentEta = etaMinutes;
    let currentDist = distanceKm;

    if (!currentRoute || currentRoute.length === 0) {
      setIsCalculating(true);
      const res = await calculateGeoapifyRoute(
        currentPos.lat,
        currentPos.lng,
        selectedHospital.lat,
        selectedHospital.lng
      );
      currentRoute = res.geometry;
      currentEta = res.etaMinutes;
      currentDist = res.distanceKm;
      setRouteGeometry(currentRoute);
      setEtaMinutes(currentEta);
      setDistanceKm(currentDist);
      setIsCalculating(false);
    }

    await realtimeService.createEmergency({
      vehicleId,
      destinationName: selectedHospital.name,
      destinationAddress: selectedHospital.address,
      destinationLat: selectedHospital.lat,
      destinationLng: selectedHospital.lng,
      startLat: currentPos.lat,
      startLng: currentPos.lng,
      currentLat: currentPos.lat,
      currentLng: currentPos.lng,
      priority,
      etaMinutes: currentEta || 3,
      distanceKm: currentDist || 3.1,
      routeGeometry: currentRoute
    });

    setToastMessage("EMERGENCY ROUTE STARTED! 🚨");
    setToastSubtext("Route corridor is now broadcasting live to all Traffic Police.");
    setShowToast(true);
  };

  // Complete Trip
  const handleCompleteTrip = async () => {
    if (activeEmergency) {
      await realtimeService.updateStatus(activeEmergency.id, "completed");
    }
    setSelectedHospital(null);
    setRouteGeometry([]);
    setEtaMinutes(null);
    setDistanceKm(null);
    setSearchQuery("");
  };

  // Real-time Hardware GPS Watcher
  useEffect(() => {
    if (!("geolocation" in navigator)) return;

    let watchId: number | null = null;
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCurrentPos({ lat, lng });
        setGpsAccuracy(Math.round(pos.coords.accuracy || 10));
        setGpsSpeed(pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0);

        if (activeEmergency) {
          realtimeService.updateLocation(activeEmergency.id, lat, lng);
        }
      },
      (err) => {
        console.warn("GPS watch position notice:", err);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [activeEmergency?.id]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center pb-12">
      {/* Top Bar Header */}
      <header className="w-full bg-slate-900 text-white border-b border-slate-800 px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="bg-red-500/20 text-red-500 p-2 rounded-xl border border-red-500/30">
              <Siren className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-white text-base">
                  Ambulance Driver Portal
                </span>
                <span className="bg-blue-500/20 text-blue-400 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-blue-500/30 uppercase">
                  ACTIVE SESSION
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                {userSession ? userSession.name : "Driver Console"} • {vehicleId}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Vehicle ID Selector or Pill */}
          <div className="hidden sm:flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
            <span className="text-[10px] text-slate-400 font-bold uppercase">Vehicle:</span>
            <input
              type="text"
              value={vehicleId}
              disabled={!!activeEmergency}
              onChange={(e) => setVehicleId(e.target.value)}
              className="bg-transparent text-xs font-mono font-bold text-red-400 outline-none w-28 uppercase disabled:opacity-50"
            />
          </div>

          <button
            onClick={() => {
              if (onLogout) onLogout();
              else onSwitchRole("select");
            }}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs px-3 py-2 rounded-xl border border-slate-700 transition-colors cursor-pointer"
            id="btn-driver-logout"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4 text-slate-400" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="w-full max-w-2xl px-4 mt-6 flex flex-col gap-6">
        {/* Active Emergency Banner */}
        {activeEmergency && (
          <div className="bg-red-600 text-white p-4 sm:p-5 rounded-2xl shadow-lg border border-red-700 flex flex-col gap-3 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/20 rounded-xl animate-pulse shrink-0">
                  <Siren className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm tracking-wide uppercase flex items-center gap-2">
                    EMERGENCY ROUTE ACTIVE • {activeEmergency.vehicleId}
                  </h3>
                  <p className="text-xs text-red-100 mt-0.5">
                    Broadcasting live location & corridor to all Traffic Police
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-red-500/80 flex-wrap gap-2">
              <button
                onClick={handleCompleteTrip}
                className="bg-white text-red-600 font-extrabold text-xs px-4 py-2 rounded-xl shadow-xs hover:bg-red-50 transition-colors cursor-pointer shrink-0"
              >
                Complete Trip
              </button>
            </div>
          </div>
        )}

        {/* Input Form Card */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col gap-5">
          {/* Field 1: Destination Hospital */}
          <div className="flex flex-col gap-1.5 relative">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Navigation className="w-3.5 h-3.5 text-slate-400" />
              DESTINATION HOSPITAL
            </label>

            {selectedHospital ? (
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-sm text-slate-800">
                <span className="truncate font-medium pr-2">{selectedHospital.address}</span>
                <button
                  onClick={() => {
                    setSelectedHospital(null);
                    setSearchQuery("");
                  }}
                  className="text-slate-400 hover:text-slate-600 p-1 shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="flex items-center border border-slate-300 rounded-xl px-3 py-2.5 bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                  <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    placeholder="Search Hospitals in Bangalore..."
                    className="w-full text-sm text-slate-800 bg-transparent outline-none"
                  />
                  {isSearching && (
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0 ml-2" />
                  )}
                </div>

                {/* Autocomplete Dropdown */}
                {showDropdown && searchQuery.trim().length >= 2 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl z-20 max-h-60 overflow-y-auto">
                    {searchResults.length > 0 ? (
                      searchResults.map((h, i) => (
                        <button
                          key={i}
                          onClick={() => handleSelectHospital(h)}
                          className="w-full text-left px-4 py-3 hover:bg-blue-50/60 border-b border-slate-100 last:border-none transition-colors cursor-pointer"
                        >
                          <div className="font-semibold text-sm text-slate-900">{h.name}</div>
                          <div className="text-xs text-slate-500 truncate">{h.address}</div>
                        </button>
                      ))
                    ) : !isSearching ? (
                      <div className="px-4 py-3 text-xs text-slate-500 text-center">
                        No hospitals found matching "{searchQuery}"
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Field 2: Emergency Priority */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Siren className="w-3.5 h-3.5 text-slate-400" />
              EMERGENCY PRIORITY
            </label>

            <div className="flex flex-col gap-2">
              <label
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                  priority === "critical"
                    ? "border-red-500 bg-red-50/40 text-red-900 font-semibold"
                    : "border-slate-200 hover:bg-slate-50 text-slate-700"
                }`}
              >
                <input
                  type="radio"
                  name="priority"
                  checked={priority === "critical"}
                  onChange={() => setPriority("critical")}
                  className="hidden"
                />
                <span className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
                <span className="text-sm">Critical — Life threatening</span>
              </label>

              <label
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                  priority === "high"
                    ? "border-amber-500 bg-amber-50/40 text-amber-900 font-semibold"
                    : "border-slate-200 hover:bg-slate-50 text-slate-700"
                }`}
              >
                <input
                  type="radio"
                  name="priority"
                  checked={priority === "high"}
                  onChange={() => setPriority("high")}
                  className="hidden"
                />
                <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
                <span className="text-sm">High — Serious condition</span>
              </label>

              <label
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                  priority === "normal"
                    ? "border-blue-500 bg-blue-50/40 text-blue-900 font-semibold"
                    : "border-slate-200 hover:bg-slate-50 text-slate-700"
                }`}
              >
                <input
                  type="radio"
                  name="priority"
                  checked={priority === "normal"}
                  onChange={() => setPriority("normal")}
                  className="hidden"
                />
                <span className="w-3 h-3 rounded-full bg-blue-500 shrink-0" />
                <span className="text-sm">Normal — Routine transfer</span>
              </label>
            </div>
          </div>

          {/* Calculate Route Button */}
          <button
            onClick={() => handleCalculateRoute()}
            disabled={!selectedHospital || isCalculating}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            id="btn-calculate-route"
          >
            {isCalculating ? "Calculating Road Path..." : "Calculate Road Route →"}
          </button>
        </div>

        {/* Calculated Metrics Cards & Emergency Dispatch Section */}
        {etaMinutes !== null && distanceKm !== null && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
                <div className="p-2.5 bg-slate-100 rounded-xl text-slate-600">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    ROAD ETA
                  </span>
                  <span className="text-2xl font-black text-slate-900">
                    {etaMinutes} min
                  </span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
                <div className="p-2.5 bg-slate-100 rounded-xl text-slate-600">
                  <Navigation className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    DISTANCE
                  </span>
                  <span className="text-2xl font-black text-slate-900">
                    {distanceKm} km
                  </span>
                </div>
              </div>
            </div>

            {/* Option to Start Emergency Route and broadcast to traffic police */}
            {!activeEmergency && (
              <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-5 rounded-2xl shadow-md border border-red-800 flex flex-col gap-3 animate-in fade-in duration-300">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/20 rounded-xl shrink-0">
                    <Siren className="w-6 h-6 text-white animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm sm:text-base tracking-wide uppercase">
                      ROUTE CALCULATED — READY FOR DISPATCH
                    </h3>
                    <p className="text-xs text-red-100 leading-snug font-medium mt-0.5">
                      Click below to trigger the emergency signal. This will transmit your exact route geometry and live driver location directly to the Traffic Police Control Room.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleStartEmergency}
                  disabled={!selectedHospital}
                  className="w-full bg-white hover:bg-slate-100 text-red-600 font-extrabold text-base py-3.5 px-4 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
                  id="btn-start-emergency-route-action"
                >
                  <Siren className="w-5 h-5 text-red-600 animate-bounce" />
                  START EMERGENCY ROUTE (SEND LIVE LOCATION)
                </button>
              </div>
            )}
          </div>
        )}

        {/* Real Traffic Road Map View */}
        <MapView
          startLat={startPos.lat}
          startLng={startPos.lng}
          currentLat={currentPos.lat}
          currentLng={currentPos.lng}
          destLat={selectedHospital?.lat}
          destLng={selectedHospital?.lng}
          routeGeometry={routeGeometry}
          destinationName={selectedHospital?.name}
          vehicleId={vehicleId}
          isEmergencyActive={!!activeEmergency}
          gpsAccuracyMeters={gpsAccuracy}
        />

        {/* Bottom Fallback Button if route metrics not yet calculated */}
        {!activeEmergency && (etaMinutes === null || distanceKm === null) && (
          <button
            onClick={handleStartEmergency}
            disabled={!selectedHospital}
            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-extrabold text-lg py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 tracking-wide cursor-pointer uppercase"
            id="btn-start-emergency-route"
          >
            <Siren className="w-6 h-6 animate-bounce" />
            START EMERGENCY ROUTE
          </button>
        )}
      </main>

      {/* Notification Toast */}
      {showToast && (
        <NotificationToast
          message={toastMessage}
          subtext={toastSubtext}
          onClose={() => setShowToast(false)}
        />
      )}
    </div>
  );
};
