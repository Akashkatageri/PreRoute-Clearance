import { LocalNotifications } from "@capacitor/local-notifications";
import { Geolocation } from "@capacitor/geolocation";
import { Capacitor } from "@capacitor/core";

// Native & Web Notification and Location permission service for AmbulancePreClear
export class NotificationService {
  private static notifPermissionGranted = false;
  private static locationPermissionGranted = false;

  public static async requestPermission(): Promise<boolean> {
    if (typeof window === "undefined") return false;

    // 1. Native Capacitor Local Notifications permission (Android 13+ / iOS / Native)
    if (Capacitor.isPluginAvailable("LocalNotifications")) {
      try {
        const result = await LocalNotifications.requestPermissions();
        if (result.display === "granted") {
          this.notifPermissionGranted = true;
          // Create Android channel for high-priority emergency corridor alerts
          try {
            await LocalNotifications.createChannel({
              id: "emergencies",
              name: "Emergency Corridor Alerts",
              description: "High priority alerts for traffic clearance and emergency vehicles",
              importance: 5, // max importance for heads-up banner & audio
              sound: "alarm.wav",
              visibility: 1, // public on lock screen
              vibration: true
            });
          } catch (channelErr) {
            console.warn("Error creating notification channel:", channelErr);
          }
        }
      } catch (err) {
        console.warn("Capacitor LocalNotifications request permission error:", err);
      }
    }

    // 2. Standard Web Notification API
    if ("Notification" in window) {
      try {
        const perm = await Notification.requestPermission();
        if (perm === "granted") {
          this.notifPermissionGranted = true;
        }
      } catch (err) {
        console.warn("Web Notification permission request error:", err);
      }
    }

    return this.notifPermissionGranted;
  }

  public static async requestLocationPermission(): Promise<boolean> {
    if (typeof window === "undefined") return false;

    // 1. Native Capacitor Geolocation permission
    try {
      if (Capacitor.isNativePlatform() || Capacitor.isPluginAvailable("Geolocation")) {
        const status = await Geolocation.requestPermissions();
        if (status.location === "granted" || status.coarseLocation === "granted") {
          this.locationPermissionGranted = true;
          return true;
        }
      }
    } catch (err) {
      console.warn("Capacitor Geolocation request permission error:", err);
    }

    // 2. Web Geolocation API
    if ("geolocation" in navigator) {
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => {
            this.locationPermissionGranted = true;
            resolve(true);
          },
          (err) => {
            console.warn("Web geolocation permission error:", err);
            resolve(false);
          },
          { timeout: 5000 }
        );
      });
    }

    return false;
  }

  public static async requestAllPermissions(): Promise<{ notification: boolean; location: boolean }> {
    const notif = await this.requestPermission();
    const loc = await this.requestLocationPermission();
    return { notification: notif, location: loc };
  }

  public static async sendNotification(title: string, body: string, icon?: string) {
    if (typeof window === "undefined") return;

    // 1. Native Capacitor Local Notifications (Appears in Android Notification Shade / Heads-up Banner)
    if (Capacitor.isPluginAvailable("LocalNotifications")) {
      try {
        const perm = await LocalNotifications.checkPermissions();
        if (perm.display === "granted") {
          await LocalNotifications.schedule({
            notifications: [
              {
                title,
                body,
                id: Math.floor(Date.now() % 100000) + 1,
                schedule: { at: new Date(Date.now() + 50) }, // Trigger immediately
                channelId: "emergencies",
                sound: "alarm.wav",
                actionTypeId: "",
                extra: null
              }
            ]
          });
        }
      } catch (err) {
        console.warn("Error triggering Capacitor local notification:", err);
      }
    }

    // 2. Web Notification fallback
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(title, {
          body,
          icon: icon || "/favicon.ico",
          badge: "/favicon.ico"
        });
      } catch (err) {
        console.warn("Error triggering native browser notification:", err);
      }
    }
  }
}

