import React, { useState, useEffect } from "react";
import { Role, Emergency, UserSession } from "./types";
import { realtimeService } from "./services/realtime";
import { RoleSelector } from "./components/RoleSelector";
import { AmbulanceDriverView } from "./components/AmbulanceDriverView";
import { TrafficPoliceView } from "./components/TrafficPoliceView";
import { auth, signOutUser } from "./lib/firebase";

export default function App() {
  const [session, setSession] = useState<UserSession | null>(() => {
    try {
      const saved = localStorage.getItem("ambulance_preclear_session");
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn("Failed to parse saved session:", e);
    }
    return null;
  });

  const [role, setRole] = useState<Role>(session ? session.role : "select");
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);

  // Keep session and role aligned & sync to localStorage for persistent session
  useEffect(() => {
    if (session) {
      localStorage.setItem("ambulance_preclear_session", JSON.stringify(session));
      setRole(session.role);
    } else {
      localStorage.removeItem("ambulance_preclear_session");
      setRole("select");
    }
  }, [session]);

  // Subscribe to real-time server updates
  useEffect(() => {
    const unsubscribe = realtimeService.subscribe((data) => {
      setEmergencies(data);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = (newSession: UserSession) => {
    localStorage.setItem("ambulance_preclear_session", JSON.stringify(newSession));
    setSession(newSession);
    setRole(newSession.role);
  };

  const handleLogout = async () => {
    await signOutUser().catch((err) => console.warn("Firebase signout error:", err));
    localStorage.removeItem("ambulance_preclear_session");
    setSession(null);
    setRole("select");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
      {role === "select" || !session ? (
        <RoleSelector onLogin={handleLogin} />
      ) : role === "driver" ? (
        <AmbulanceDriverView
          userSession={session}
          onLogout={handleLogout}
          onSwitchRole={(r) => {
            if (r === "select") {
              handleLogout();
            } else {
              setRole(r);
            }
          }}
          activeEmergencies={emergencies}
        />
      ) : (
        <TrafficPoliceView
          userSession={session}
          onLogout={handleLogout}
          onSwitchRole={(r) => {
            if (r === "select") {
              handleLogout();
            } else {
              setRole(r);
            }
          }}
          emergencies={emergencies}
        />
      )}
    </div>
  );
}
