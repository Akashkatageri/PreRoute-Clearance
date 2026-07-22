// Native & Web Notification service for AmbulancePreClear
export class NotificationService {
  private static permissionGranted = false;

  public static async requestPermission(): Promise<boolean> {
    if (typeof window === "undefined") return false;

    // Standard Web Notification API
    if ("Notification" in window) {
      try {
        const perm = await Notification.requestPermission();
        this.permissionGranted = perm === "granted";
        return this.permissionGranted;
      } catch (err) {
        console.warn("Notification permission request error:", err);
      }
    }
    return false;
  }

  public static async sendNotification(title: string, body: string, icon?: string) {
    if (typeof window === "undefined") return;

    // Web Notification fallback / primary
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
