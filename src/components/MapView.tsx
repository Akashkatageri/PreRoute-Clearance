import React, { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { GEOAPIFY_KEY } from "../services/geoapify";
import { Emergency } from "../types";

const ambulanceIcon = new L.Icon({
  iconUrl: "https://img.icons8.com/color/48/ambulance--v1.png",
  iconSize: [42, 42],
  iconAnchor: [21, 21],
  className: "animate-pulse shadow-md"
});

const hospitalIcon = new L.Icon({
  iconUrl: "https://img.icons8.com/color/48/hospital-2.png",
  iconSize: [42, 42],
  iconAnchor: [21, 42],
  className: "shadow-md"
});

export interface MapProps {
  currentPos: [number, number] | null;
  destinationPos: [number, number] | null;
  routeGeometry: [number, number][] | null;
  interactive?: boolean;
  gpsAccuracyMeters?: number;
  allEmergencies?: Emergency[];
  selectedEmergencyId?: string;
  onSelectEmergency?: (id: string) => void;
}

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, map.getZoom(), { animate: true });
    }
  }, [center, map]);
  return null;
}

function MultiRouteFitter({ geometries }: { geometries: [number, number][][] }) {
  const map = useMap();
  useEffect(() => {
    if (geometries && geometries.length > 0) {
      const allPoints = geometries.flat();
      if (allPoints.length > 0) {
        const bounds = L.latLngBounds(allPoints);
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [geometries, map]);
  return null;
}

function isValidCoord(num: any): num is number {
  return typeof num === "number" && !isNaN(num) && isFinite(num) && num !== 0;
}

export function Map({
  currentPos,
  destinationPos,
  routeGeometry,
  interactive = true,
  gpsAccuracyMeters = 15,
  allEmergencies = [],
  selectedEmergencyId,
  onSelectEmergency
}: MapProps) {
  const defaultCenter: [number, number] = [12.8620, 77.5280];
  const center: [number, number] = 
    currentPos && isValidCoord(currentPos[0]) && isValidCoord(currentPos[1])
      ? currentPos
      : defaultCenter;

  // Other active emergencies excluding currently selected focused route
  const otherActiveEmergencies = allEmergencies.filter(
    (e) => e && e.status !== "completed" && e.id !== selectedEmergencyId
  );

  const allGeometriesToFit = [
    ...(routeGeometry && routeGeometry.length > 0 ? [routeGeometry] : []),
    ...otherActiveEmergencies.map((e) => e.routeGeometry || []).filter((g) => g.length > 0)
  ];

  return (
    <div className="h-[320px] sm:h-[400px] md:h-[450px] w-full relative z-0 rounded-3xl overflow-hidden shadow-xl border-2 border-slate-200">
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={interactive}
        dragging={interactive}
        className="h-full w-full"
      >
        {/* Geoapify OSM Bright Tile Layer */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://www.geoapify.com/">Geoapify</a>'
          url={`https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${GEOAPIFY_KEY}`}
        />

        {/* Real-time GPS accuracy circle around primary ambulance */}
        {currentPos && isValidCoord(currentPos[0]) && isValidCoord(currentPos[1]) && (
          <Circle
            center={currentPos}
            radius={gpsAccuracyMeters || 15}
            pathOptions={{
              color: "#3b82f6",
              fillColor: "#60a5fa",
              fillOpacity: 0.25,
              weight: 1.5,
              dashArray: "4, 4"
            }}
          />
        )}

        {/* Other Active Emergencies (Multiple Ambulance Routes on Radar) */}
        {otherActiveEmergencies.map((emg, idx) => {
          const emgKey = emg.id || `emg-${idx}`;
          const hasCurrent = isValidCoord(emg.currentLat) && isValidCoord(emg.currentLng);
          const hasDest = isValidCoord(emg.destinationLat) && isValidCoord(emg.destinationLng);
          if (!hasCurrent) return null;

          const emgCurrentPos: [number, number] = [emg.currentLat, emg.currentLng];
          const emgDestPos: [number, number] | null = hasDest ? [emg.destinationLat, emg.destinationLng] : null;

          return (
            <React.Fragment key={emgKey}>
              {/* Secondary Active Route Line */}
              {emg.routeGeometry && emg.routeGeometry.length > 0 && (
                <>
                  <Polyline
                    positions={emg.routeGeometry}
                    color="#ffffff"
                    weight={6}
                    opacity={0.8}
                  />
                  <Polyline
                    positions={emg.routeGeometry}
                    color="#f59e0b"
                    weight={4}
                    opacity={0.9}
                    dashArray="6, 8"
                    eventHandlers={{
                      click: () => onSelectEmergency && onSelectEmergency(emg.id)
                    }}
                  />
                </>
              )}

              {/* Secondary Ambulance Marker */}
              <Marker
                position={emgCurrentPos}
                icon={ambulanceIcon}
                eventHandlers={{
                  click: () => onSelectEmergency && onSelectEmergency(emg.id)
                }}
              >
                <Popup>
                  <div className="text-xs font-sans p-1">
                    <p className="font-black text-amber-600 uppercase flex items-center gap-1">
                      🚨 AMBULANCE {emg.vehicleId}
                    </p>
                    <p className="text-slate-700 font-medium mt-0.5">To: {emg.destinationName}</p>
                    <p className="text-[11px] text-slate-500">ETA: {emg.etaMinutes} min • {emg.distanceKm} km</p>
                    {onSelectEmergency && (
                      <button
                        onClick={() => onSelectEmergency(emg.id)}
                        className="mt-2 w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[10px] py-1 px-2 rounded-md transition-colors cursor-pointer"
                      >
                        Inspect Route & Clearance
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>

              {/* Secondary Hospital Destination Marker */}
              {emgDestPos && (
                <Marker position={emgDestPos} icon={hospitalIcon}>
                  <Popup>
                    <div className="text-xs font-sans">
                      <p className="font-bold text-slate-800">{emg.destinationName}</p>
                      <p className="text-[10px] text-slate-500">{emg.vehicleId} Destination</p>
                    </div>
                  </Popup>
                </Marker>
              )}
            </React.Fragment>
          );
        })}

        {/* Primary Emergency Vehicle Marker */}
        {currentPos && isValidCoord(currentPos[0]) && isValidCoord(currentPos[1]) && (
          <>
            <Marker position={currentPos} icon={ambulanceIcon}>
              <Popup>
                <div className="text-xs font-sans p-1">
                  <p className="font-black text-red-600 uppercase">🚨 PRIMARY AMBULANCE</p>
                  <p className="text-slate-600">Lat: {currentPos[0].toFixed(5)}, Lng: {currentPos[1].toFixed(5)}</p>
                  <p className="text-[10px] text-blue-600 font-bold mt-1">● Live GPS Tracking Active</p>
                </div>
              </Popup>
            </Marker>
            <MapUpdater center={currentPos} />
          </>
        )}

        {/* Primary Destination Hospital Marker */}
        {destinationPos && isValidCoord(destinationPos[0]) && isValidCoord(destinationPos[1]) && (
          <Marker position={destinationPos} icon={hospitalIcon}>
            <Popup>
              <div className="text-xs font-sans">
                <p className="font-bold text-emerald-700 uppercase">Destination Hospital</p>
                <p className="text-slate-600">Lat: {destinationPos[0].toFixed(5)}, Lng: {destinationPos[1].toFixed(5)}</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Primary Emergency Corridor Red Line */}
        {routeGeometry && routeGeometry.length > 0 && (
          <>
            <Polyline
              positions={routeGeometry}
              color="#ffffff"
              weight={10}
              opacity={0.9}
            />
            <Polyline
              positions={routeGeometry}
              color="#dc2626"
              weight={6}
              opacity={0.95}
              lineCap="round"
              lineJoin="round"
            />
          </>
        )}

        {/* Auto fit all active routes */}
        {allGeometriesToFit.length > 0 && (
          <MultiRouteFitter geometries={allGeometriesToFit} />
        )}
      </MapContainer>
    </div>
  );
}

export interface MapViewProps {
  startLat: number;
  startLng: number;
  currentLat?: number;
  currentLng?: number;
  destLat?: number;
  destLng?: number;
  routeGeometry?: [number, number][];
  destinationName?: string;
  vehicleId?: string;
  isEmergencyActive?: boolean;
  height?: string;
  gpsAccuracyMeters?: number;
  allEmergencies?: Emergency[];
  selectedEmergencyId?: string;
  onSelectEmergency?: (id: string) => void;
}

export const MapView: React.FC<MapViewProps> = ({
  startLat,
  startLng,
  currentLat,
  currentLng,
  destLat,
  destLng,
  routeGeometry = [],
  gpsAccuracyMeters = 15,
  allEmergencies = [],
  selectedEmergencyId,
  onSelectEmergency
}) => {
  const cLat = isValidCoord(currentLat) ? currentLat : (isValidCoord(startLat) ? startLat : 12.8620);
  const cLng = isValidCoord(currentLng) ? currentLng : (isValidCoord(startLng) ? startLng : 77.5280);
  const currentPos: [number, number] = [cLat, cLng];

  const destinationPos: [number, number] | null =
    isValidCoord(destLat) && isValidCoord(destLng) ? [destLat, destLng] : null;

  return (
    <Map
      currentPos={currentPos}
      destinationPos={destinationPos}
      routeGeometry={routeGeometry.length > 0 ? routeGeometry : null}
      interactive={true}
      gpsAccuracyMeters={gpsAccuracyMeters}
      allEmergencies={allEmergencies}
      selectedEmergencyId={selectedEmergencyId}
      onSelectEmergency={onSelectEmergency}
    />
  );
};
