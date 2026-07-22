# Capacitor Android & Google Sign-In Setup Guide

This project is fully configured for **Capacitor Mobile Native App** execution with real-time GPS tracking, push notifications, and Google Native Authentication.

---

## Google Sign-In SHA-1 Fingerprint Fix for CI/CD

When building Android APKs on GitHub Actions or virtual runners, Gradle generates a fresh `debug.keystore` on every build, resulting in changing SHA-1 fingerprints that cause Google Sign-In to fail.

To ensure Google Sign-In works reliably across builds, follow these 4 steps:

### 1. Generate One Permanent Local Keystore
Run this command in your terminal inside the `android/app` directory:
```bash
keytool -genkey -v -keystore android/app/debug.keystore -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US"
```

### 2. Configure `android/app/build.gradle`
Ensure `signingConfigs` points to `debug.keystore`:
```groovy
android {
    ...
    signingConfigs {
        debug {
            if (file('debug.keystore').exists()) {
                storeFile file('debug.keystore')
                storePassword 'android'
                keyAlias 'androiddebugkey'
                keyPassword 'android'
            } else {
                storeFile file("${System.properties['user.home']}/.android/debug.keystore")
                storePassword 'android'
                keyAlias 'androiddebugkey'
                keyPassword 'android'
            }
        }
    }

    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
    }
}
```

### 3. Add `ANDROID_KEYSTORE_BASE64` to GitHub Repository Secrets
Convert your keystore to Base64:
```bash
# macOS/Linux:
base64 -i android/app/debug.keystore

# Windows PowerShell:
[Convert]::ToBase64String([System.IO.File]::ReadAllBytes("android/app/debug.keystore"))
```
In your GitHub repo: **Settings > Secrets and variables > Actions** -> Add secret `ANDROID_KEYSTORE_BASE64`.

The included `.github/workflows/build-apk.yml` automatically decodes this secret during CI/CD builds.

### 4. Register Fingerprint in Firebase
Get your permanent SHA-1 fingerprint:
```bash
keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android
```
Add the SHA-1 to **Firebase Console > Project Settings > Your Android App**, and place `google-services.json` inside `android/app/`.

---

### Quick Commands Cheat Sheet

| Task | Command |
| :--- | :--- |
| **Build Web Assets** | `npm run build` |
| **Sync Capacitor** | `npx cap sync android` |
| **Open Android Studio** | `npx cap open android` |
| **Build APK Directly** | `cd android && ./gradlew assembleDebug` |
