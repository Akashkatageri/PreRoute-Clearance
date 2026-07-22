import React, { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { GEOAPIFY_KEY } from "../services/geoapify";

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

function RouteFitter({ geometry }: { geometry: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (geometry && geometry.length > 0) {
      const bounds = L.latLngBounds(geometry);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [geometry, map]);
  return null;
}

export function Map({
  currentPos,
  destinationPos,
  routeGeometry,
  interactive = true,
  gpsAccuracyMeters = 15
}: MapProps) {
  const center: [number, number] = currentPos || [12.8620, 77.5280];

  return (
    <div className="h-[280px] sm:h-[380px] md:h-[420px] w-full relative z-0 rounded-2xl overflow-hidden shadow-lg border-2 border-slate-200">
      <MapContainer
        center={center}
        zoom={14}
        scrollWheelZoom={interactive}
        dragging={interactive}
        className="h-full w-full"
      >
        {/* Geoapify OSM Bright Tile Layer for crisp road paths */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://www.geoapify.com/">Geoapify</a>'
          url={`https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${GEOAPIFY_KEY}`}
        />

        {/* Real-time GPS accuracy circle around ambulance */}
        {currentPos && (
          <Circle
            center={currentPos}
            radius={gpsAccuracyMeters}
            pathOptions={{
              color: "#3b82f6",
              fillColor: "#60a5fa",
              fillOpacity: 0.25,
              weight: 1.5,
              dashArray: "4, 4"
            }}
          />
        )}

        {/* Emergency Vehicle Location Marker */}
        {currentPos && (
          <>
            <Marker position={currentPos} icon={ambulanceIcon}>
              <Popup>
                <div className="text-xs font-sans">
                  <p className="font-bold text-red-600 uppercase">Emergency Ambulance</p>
                  <p className="text-slate-600">Lat: {currentPos[0].toFixed(5)}, Lng: {currentPos[1].toFixed(5)}</p>
                  <p className="text-[10px] text-blue-600 font-semibold mt-1">● Live GPS Tracking Active</p>
                </div>
              </Popup>
            </Marker>
            <MapUpdater center={currentPos} />
          </>
        )}

        {/* Destination Hospital Marker */}
        {destinationPos && (
          <Marker position={destinationPos} icon={hospitalIcon}>
            <Popup>
              <div className="text-xs font-sans">
                <p className="font-bold text-emerald-700 uppercase">Destination Hospital</p>
                <p className="text-slate-600">Lat: {destinationPos[0].toFixed(5)}, Lng: {destinationPos[1].toFixed(5)}</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Emergency Corridor Real Traffic Path Polyline with Glowing Outer Border */}
        {routeGeometry && routeGeometry.length > 0 && (
          <>
            {/* White/Yellow outer casing line to highlight road corridor */}
            <Polyline
              positions={routeGeometry}
              color="#ffffff"
              weight={10}
              opacity={0.9}
            />
            {/* Main Emergency Corridor Red Line */}
            <Polyline
              positions={routeGeometry}
              color="#dc2626"
              weight={6}
              opacity={0.95}
              lineCap="round"
              lineJoin="round"
            />
            <RouteFitter geometry={routeGeometry} />
          </>
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
}

export const MapView: React.FC<MapViewProps> = ({
  startLat,
  startLng,
  currentLat,
  currentLng,
  destLat,
  destLng,
  routeGeometry = [],
  gpsAccuracyMeters = 15
}) => {
  const currentPos: [number, number] = [currentLat ?? startLat, currentLng ?? startLng];
  const destinationPos: [number, number] | null = (destLat && destLng) ? [destLat, destLng] : null;

  return (
    <Map
      currentPos={currentPos}
      destinationPos={destinationPos}
      routeGeometry={routeGeometry.length > 0 ? routeGeometry : null}
      interactive={true}
      gpsAccuracyMeters={gpsAccuracyMeters}
    />
  );
};
