export type Role = 'select' | 'driver' | 'police';

export interface UserSession {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  role: 'driver' | 'police';
  badgeNumber?: string;
  vehicleId?: string;
  loginProvider: 'google' | 'native';
  loggedAt: string;
}

export type Priority = 'critical' | 'high' | 'normal';

export type EmergencyStatus = 'active' | 'acknowledged' | 'cleared' | 'completed';

export interface Emergency {
  id: string;
  vehicleId: string;
  destinationName: string;
  destinationAddress: string;
  destinationLat: number;
  destinationLng: number;
  startLat: number;
  startLng: number;
  currentLat: number;
  currentLng: number;
  priority: Priority;
  status: EmergencyStatus;
  etaMinutes: number;
  distanceKm: number;
  createdAt: string;
  createdTimestamp?: number;
  lastUpdated: string;
  routeGeometry?: [number, number][]; // Array of [lat, lng]
}

export interface HospitalResult {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export interface RouteResult {
  distanceKm: number;
  etaMinutes: number;
  geometry: [number, number][]; // [lat, lng]
}
