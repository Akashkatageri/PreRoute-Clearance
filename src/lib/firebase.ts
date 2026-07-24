import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  signOut,
  User
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { Capacitor } from "@capacitor/core";
import firebaseConfig from "../../firebase-applet-config.json";

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
// Prompt user to select an account explicitly every time
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || "(default)");

/**
 * Native Google Sign-In for Android / Capacitor app using @capacitor-firebase/authentication (Capawesome)
 * which presents the native Google Account chooser bottom-sheet inside the app,
 * and exchanges the native Google ID token for a Firebase session using signInWithCredential().
 * Fallback to Firebase Web SDK signInWithPopup on desktop/mobile browsers.
 */
export async function signInWithGoogleNativeOrWeb(): Promise<User> {
  const isPluginAvailable = Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('FirebaseAuthentication');

  if (isPluginAvailable) {
    try {
      // 1. Native Google Sign-In via Capawesome (@capacitor-firebase/authentication)
      const result = await FirebaseAuthentication.signInWithGoogle({
        scopes: ['profile', 'email']
      });

      const idToken = result.credential?.idToken || (result as any).idToken;
      const accessToken = result.credential?.accessToken || (result as any).accessToken;

      if (idToken) {
        // 2. Exchange native Google ID token for a Firebase session using signInWithCredential
        const credential = GoogleAuthProvider.credential(idToken, accessToken);
        const userCredential = await signInWithCredential(auth, credential);
        return userCredential.user;
      } else if (auth.currentUser) {
        return auth.currentUser;
      } else {
        throw new Error("Native Google Sign-In completed but no ID token was returned.");
      }
    } catch (err: any) {
      console.warn("Native Google Sign-In error / missing implementation, trying web fallback:", err);
      // Fallback to Web popup if native plugin fails or is unimplemented
      if (
        err?.message?.includes("not implemented") ||
        err?.code === "UNIMPLEMENTED" ||
        err?.message?.includes("Plugin_NOT_INSTALLED")
      ) {
        const result = await signInWithPopup(auth, googleProvider);
        return result.user;
      }
      throw err;
    }
  } else {
    // Web browser platform / non-native environment: standard popup sign-in
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  }
}

export async function signOutUser(): Promise<void> {
  if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('FirebaseAuthentication')) {
    try {
      await FirebaseAuthentication.signOut();
    } catch (e) {
      console.warn("Native Capawesome sign out warning:", e);
    }
  }
  await signOut(auth);
}

export { signInWithPopup, signInWithCredential, signOut, GoogleAuthProvider };

