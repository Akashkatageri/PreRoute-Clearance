import { HospitalResult, RouteResult } from "../types";

export const GEOAPIFY_KEY = "931662b2ab65485ca0b3e9e3dbabe064";

// Popular hospitals in Bangalore as fallback & instant suggestions
export const DEFAULT_BANGALORE_HOSPITALS: HospitalResult[] = [
  {
    name: "Zymus Hospitals",
    address: "Zymus Hospitals, Kanakapura Road, Talagattapura, Bengaluru - 560109, KA, India",
    lat: 12.8715,
    lng: 77.5385
  },
  {
    name: "Fortis Hospital Bannerghatta",
    address: "154/9, Bannerghatta Main Rd, opposite IIM, Opp IIMB, Bengaluru, Karnataka 560076",
    lat: 12.8952,
    lng: 77.5986
  },
  {
    name: "Apollo Hospitals Jayanagar",
    address: "212, 2nd Cross Rd, 5th Block, Jayanagar, Bengaluru, Karnataka 560041",
    lat: 12.9238,
    lng: 77.5810
  },
  {
    name: "Manipal Hospital Old Airport Road",
    address: "98, HAL Old Airport Rd, Kodihalli, Bengaluru, Karnataka 560017",
    lat: 12.9583,
    lng: 77.6487
  },
  {
    name: "NIMHANS Hospital",
    address: "Hosur Road, Lakkasandra, Wilson Garden, Bengaluru, Karnataka 560029",
    lat: 12.9412,
    lng: 77.5988
  }
];

export async function searchHospitals(
  query: string,
  userLat: number = 12.9716,
  userLng: number = 77.5946
): Promise<HospitalResult[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const cleanQuery = query.trim();

  try {
    // Geoapify Geocode Autocomplete API with healthcare category filter strictly in India
    const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(
      cleanQuery
    )}&categories=healthcare.hospital,healthcare.clinic&filter=countrycode:in&bias=proximity:${userLng},${userLat}&limit=15&apiKey=${GEOAPIFY_KEY}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error("Geoapify search failed");
    const data = await res.json();

    let featuresToProcess = data.features || [];

    // Fallback search if category parameter yielded empty result
    if (featuresToProcess.length === 0) {
      const fallbackUrl = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(
        cleanQuery
      )}&filter=countrycode:in&bias=proximity:${userLng},${userLat}&limit=15&apiKey=${GEOAPIFY_KEY}`;
      const fallbackRes = await fetch(fallbackUrl);
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        featuresToProcess = fallbackData.features || [];
      }
    }

    const results: HospitalResult[] = [];
    const medicalRegex = /(hospital|clinic|nursing home|medical|health c|dispensary|eye care|eye hospital|heart institute|cancer institute|trauma|multi specialty|multispecialty|super specialty|superspecialty|maternity|healthcare|hospital & research|medicity|ayurvedic hospital|homeopathy)/i;

    for (const feat of featuresToProcess) {
      const props = feat.properties || {};
      const coords = feat.geometry?.coordinates; // [lng, lat]
      if (!coords || coords.length < 2) continue;

      // Strict check for India country code
      if (props.country_code && props.country_code.toLowerCase() !== "in") {
        continue;
      }

      const rawName = props.name || props.street || props.suburb || "";
      const formattedAddress = props.formatted || "";
      const categories: string[] = props.categories || [];

      // Check if feature is explicitly categorized as healthcare or matches hospital/clinic keywords
      const isHealthcareCategory = categories.some(cat =>
        cat.startsWith("healthcare") || cat.includes("hospital") || cat.includes("clinic")
      );
      const isMedicalName = medicalRegex.test(rawName) || medicalRegex.test(formattedAddress);

      // Strictly include ONLY hospitals and clinics
      if (isHealthcareCategory || isMedicalName) {
        let finalAddress = formattedAddress;
        if (!finalAddress.toLowerCase().includes("india")) {
          finalAddress += ", India";
        }

        results.push({
          name: rawName || "Hospital / Clinic",
          address: finalAddress,
          lat: coords[1],
          lng: coords[0]
        });
      }
    }

    // Deduplicate by name
    const uniqueResults: HospitalResult[] = [];
    const seenNames = new Set<string>();

    for (const item of results) {
      const key = item.name.toLowerCase().trim();
      if (!seenNames.has(key)) {
        seenNames.add(key);
        uniqueResults.push(item);
      }
    }

    return uniqueResults;
  } catch (err) {
    console.warn("Geoapify autocomplete error, falling back:", err);
    return DEFAULT_BANGALORE_HOSPITALS.filter(h =>
      h.name.toLowerCase().includes(cleanQuery.toLowerCase()) ||
      h.address.toLowerCase().includes(cleanQuery.toLowerCase())
    );
  }
}

export async function calculateGeoapifyRoute(
  startLat: number,
  startLng: number,
  destLat: number,
  destLng: number
): Promise<RouteResult> {
  // 1. Try OSRM primary router for precise road network geometry
  try {
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${destLng},${destLat}?overview=full&geometries=geojson`;
    const res = await fetch(osrmUrl);
    if (res.ok) {
      const data = await res.json();
      if (data.code === "Ok" && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const rawCoords: [number, number][] = route.geometry.coordinates || [];
        const coordinates: [number, number][] = rawCoords.map(
          (c) => [c[1], c[0]] // convert GeoJSON [lng, lat] to Leaflet [lat, lng]
        );

        if (coordinates.length > 1) {
          const distanceMeters = route.distance || 3000;
          const durationSeconds = route.duration || 240;
          return {
            distanceKm: Math.round((distanceMeters / 1000) * 10) / 10,
            etaMinutes: Math.max(1, Math.round(durationSeconds / 60)),
            geometry: coordinates
          };
        }
      }
    }
  } catch (e) {
    console.warn("OSRM routing failed, trying alternative router:", e);
  }

  // 2. Try OpenStreetMap DE router fallback
  try {
    const osmDeUrl = `https://routing.openstreetmap.de/routed-car/route/v1/driving/${startLng},${startLat};${destLng},${destLat}?overview=full&geometries=geojson`;
    const res = await fetch(osmDeUrl);
    if (res.ok) {
      const data = await res.json();
      if (data.code === "Ok" && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const rawCoords: [number, number][] = route.geometry.coordinates || [];
        const coordinates: [number, number][] = rawCoords.map((c) => [c[1], c[0]]);

        if (coordinates.length > 1) {
          return {
            distanceKm: Math.round(((route.distance || 3000) / 1000) * 10) / 10,
            etaMinutes: Math.max(1, Math.round((route.duration || 240) / 60)),
            geometry: coordinates
          };
        }
      }
    }
  } catch (e) {
    console.warn("OSM DE routing failed:", e);
  }

  // 3. Try Geoapify Routing API
  try {
    const url = `https://api.geoapify.com/v1/routing?waypoints=${startLat},${startLng}|${destLat},${destLng}&mode=drive&apiKey=${GEOAPIFY_KEY}`;
    const res = await fetch(url);

    if (res.ok) {
      const data = await res.json();
      if (data.features && data.features.length > 0) {
        const feature = data.features[0];
        const distanceMeters = feature.properties.distance || 3100;
        const timeSeconds = feature.properties.time || 180;

        let rawCoords: any[] = [];
        if (feature.geometry.type === "LineString") {
          rawCoords = feature.geometry.coordinates;
        } else if (feature.geometry.type === "MultiLineString") {
          rawCoords = feature.geometry.coordinates.flat(1);
        } else if (Array.isArray(feature.geometry.coordinates[0])) {
          rawCoords = feature.geometry.coordinates.flat(1);
        }

        const coordinates: [number, number][] = rawCoords.map(
          (c: [number, number]) => [c[1], c[0]]
        );

        if (coordinates.length > 1) {
          return {
            distanceKm: Math.round((distanceMeters / 1000) * 10) / 10,
            etaMinutes: Math.max(1, Math.round(timeSeconds / 60)),
            geometry: coordinates
          };
        }
      }
    }
  } catch (err) {
    console.warn("Geoapify routing API error:", err);
  }

  // Fallback: If network routing fails, calculate Haversine distance
  const R = 6371; // km
  const dLat = ((destLat - startLat) * Math.PI) / 180;
  const dLng = ((destLng - startLng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((startLat * Math.PI) / 180) *
      Math.cos((destLat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distKm = Math.round(R * c * 10) / 10 || 3.1;
  const etaMins = Math.max(1, Math.round((distKm / 50) * 60));

  return {
    distanceKm: distKm,
    etaMinutes: etaMins,
    geometry: [[startLat, startLng], [destLat, destLng]]
  };
}
