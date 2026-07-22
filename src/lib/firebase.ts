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
 * Native Google Sign-In for Android / Capacitor app (opens native in-app sheet)
 * with seamless fallback to Firebase Web Popup on desktop/mobile browsers.
 */
export async function signInWithGoogleNativeOrWeb(): Promise<User> {
  if (Capacitor.isNativePlatform()) {
    try {
      const result = await FirebaseAuthentication.signInWithGoogle();
      if (result.credential?.idToken) {
        const credential = GoogleAuthProvider.credential(result.credential.idToken);
        const userCredential = await signInWithCredential(auth, credential);
        return userCredential.user;
      } else if (auth.currentUser) {
        return auth.currentUser;
      } else {
        throw new Error("Native Google Sign-In did not return valid credentials.");
      }
    } catch (err: any) {
      console.warn("Native Google Sign-In failed, attempting web fallback:", err);
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    }
  } else {
    // Web browser platform
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  }
}

export { signInWithPopup, signInWithCredential, signOut, GoogleAuthProvider };

