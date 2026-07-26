# PreRoute — Emergency Response & Traffic Pre-Clearing System 🚨🚑

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/Platform-Web%20%7C%20Android-brightgreen.svg)](https://github.com/)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore%20%26%20Auth-orange.svg)](https://firebase.google.com/)
[![Capacitor](https://img.shields.io/badge/Capacitor-Android%20Native-blueviolet.svg)](https://capacitorjs.com/)

**PreRoute** (AmbulancePreClear) is an emergency vehicle response coordination platform designed to save lives by giving ambulances green corridors through traffic congestion. It links ambulance drivers, traffic police officers, and dispatch control in real-time with GPS tracking, route geometry overlays, traffic signal pre-clearing, and automated profile syncing.

---

## 🌟 Key Features

### 🚑 1. Ambulance Driver Portal
- **Live Dispatch & GPS Tracking**: Real-time GPS broadcasting with turn-by-turn route geometry to destination hospitals.
- **Dynamic ETA & Distance**: Dynamic recalculation of distance and arrival time.
- **Emergency Dispatch Button**: Instant alert trigger with siren audio effects and live coordinates.
- **Siren & Beacon Controls**: Toggle vehicle emergency siren state with visual strobe indicators.

### 👮 2. Traffic Police Control Center
- **Radar & Map Overlay**: Real-time Leaflet map visualizer tracking incoming ambulances in proximity.
- **Signal Clearance Controls**: Override green corridor traffic signals ahead of approaching emergency vehicles.
- **Alert Sound & Notifications**: Haptic and visual alerts when an ambulance enters the active zone.
- **Auto-Expiration Engine**: Active emergency signals automatically expire after **12 hours** to keep traffic feeds clean and prevent legacy route clutter.

### 🔑 3. Profile Sync & Google Authentication
- **Universal Google Sign-In**: Authenticates via Google Play Services on Android and Firebase Web Auth on desktop.
- **Cloud Profile Restoration**: Automatically binds and restores **Officer Name**, **Ambulance Vehicle ID**, and **Police Badge Number** to your Google account via Firestore Cloud database.
- **Multi-Device Persistence**: First-time registrations save seamlessly; returning logins across web browsers or mobile devices instantly load account-bound credentials.

### 📱 4. Native Android Application (`com.PreRoute.app`)
- **Capacitor Mobile SDK**: Runs natively on Android devices with Google Play Services.
- **Native Geolocation & Push Notifications**: Continuous background position updates and arrival alerts.
- **CI/CD APK Workflow**: Automated GitHub Actions workflow for building release and debug Android APKs.

---

## 📱 Visual App Layout & Screenshots

| 🔐 Login & Account Sync | 🚑 Ambulance Driver View | 👮 Traffic Police Control |
| :---: | :---: | :---: |
| <img src="assets/screenshots/login.png" width="280" alt="Google Sign-In & Role Selection" fallback="Login & Profile Sync Screen" /> | <img src="assets/screenshots/driver.png" width="280" alt="Ambulance Driver Live Dispatch" fallback="Ambulance Driver Portal" /> | <img src="assets/screenshots/police.png" width="280" alt="Traffic Police Signal Clearance" fallback="Traffic Police Radar Screen" /> |
| *Role Selection & Google Account Profile Binding* | *Live Route Navigation & Emergency Siren Controls* | *Radar Traffic Map & Green Corridor Signal Override* |

---

## 🛠️ Technology Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Motion animations, Lucide Icons, Leaflet / React-Leaflet
- **Backend**: Node.js, Express, Server-Sent Events (SSE) fallback server
- **Database & Auth**: Firebase Firestore (NoSQL Cloud DB), Firebase Authentication
- **Mobile Native**: Capacitor JS (`@capacitor/core`, `@capacitor/geolocation`, `@capacitor-firebase/authentication`, `@capacitor/local-notifications`)
- **Android Runtime**: Android SDK 34 / Java 17 / Gradle 8.2

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or bun
- Android Studio (for Android app builds)

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/your-username/AmbulancePreClear.git
cd AmbulancePreClear
npm install
```

### 2. Environment Setup

Create a `.env` file in the root directory (refer to `.env.example`):

```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 3. Run Development Server

```bash
npm run dev
```

The app will launch at `http://localhost:3000`.

---

## 🤖 Building the Android App

The project includes pre-configured Capacitor setup for `com.PreRoute.app`.

### Quick Commands

| Task | Command |
| :--- | :--- |
| **Build Web Bundle** | `npm run build` |
| **Sync Capacitor Android Project** | `npx cap sync android` |
| **Launch Android Studio** | `npx cap open android` |
| **Build Debug APK Direct** | `cd android && ./gradlew assembleDebug` |

For detailed keystore signing, SHA-1 Google Sign-In setup, and GitHub Actions CI/CD workflow, check [ANDROID_BUILD_GUIDE.md](./ANDROID_BUILD_GUIDE.md).

---

## 🔒 Firestore Security Rules & Structure

User profiles are saved under the `users` collection in Firestore:

```json
// Collection: /users/{email}
{
  "email": "driver@example.com",
  "name": "Ramesh Kumar",
  "role": "driver",
  "vehicleId": "KA-05-EM-0108",
  "badgeNumber": "BLR-TP-402",
  "avatarUrl": "https://lh3.googleusercontent.com/...",
  "updatedAt": "2026-07-26T00:15:00.000Z"
}
```

Emergencies are stored under `/emergencies/{emergencyId}` and automatically cleared upon resolution or after 12 hours.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.
