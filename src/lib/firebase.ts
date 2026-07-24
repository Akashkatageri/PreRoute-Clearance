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
  if (Capacitor.isNativePlatform()) {
    // Strictly execute native Google Sign-In on Android/iOS via Capawesome plugin
    // This displays the native "Select an account" bottom-sheet directly inside the app
    const result = await FirebaseAuthentication.signInWithGoogle({
      scopes: ['profile', 'email']
    });

    const idToken = result.credential?.idToken || (result as any).idToken;
    const accessToken = result.credential?.accessToken || (result as any).accessToken;

    if (idToken) {
      // Exchange native Google ID token for a Firebase user session using signInWithCredential
      const credential = GoogleAuthProvider.credential(idToken, accessToken);
      const userCredential = await signInWithCredential(auth, credential);
      return userCredential.user;
    } else if (auth.currentUser) {
      return auth.currentUser;
    } else {
      throw new Error("Native Google Sign-In completed but no ID token was returned.");
    }
  } else {
    // Web browser platform (e.g. desktop/mobile browser preview): standard web popup
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

