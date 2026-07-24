import fs from 'fs';
import path from 'path';

const rootGoogleServices = path.join(process.cwd(), 'google-services.json');
const androidAppDir = path.join(process.cwd(), 'android', 'app');
const androidGoogleServices = path.join(androidAppDir, 'google-services.json');

const DEFAULT_GOOGLE_SERVICES = {
  "project_info": {
    "project_number": "540691753241",
    "project_id": "preroute-01",
    "storage_bucket": "preroute-01.firebasestorage.app"
  },
  "client": [
    {
      "client_info": {
        "mobilesdk_app_id": "1:540691753241:android:0c20089fdbc8bceda8bd88",
        "android_client_info": {
          "package_name": "com.PreRoute.app"
        }
      },
      "oauth_client": [
        {
          "client_id": "540691753241-hv25c44p2ulnvvcb3kpqt1p9k67eihv9.apps.googleusercontent.com",
          "client_type": 1,
          "android_info": {
            "package_name": "com.PreRoute.app",
            "certificate_hash": "fc0365cf5405d9c27a50b6ee2683b3ae218c716d"
          }
        },
        {
          "client_id": "540691753241-i4dhedph9m0pa1u23ostbcelkj4cdjpn.apps.googleusercontent.com",
          "client_type": 1,
          "android_info": {
            "package_name": "com.PreRoute.app",
            "certificate_hash": "2e9d744431db8b9b10c2fd3442678dea3bbcd267"
          }
        },
        {
          "client_id": "540691753241-pcq4g6kdee8r4nmpb34d1bbq7ha0lg1r.apps.googleusercontent.com",
          "client_type": 3
        }
      ],
      "api_key": [
        {
          "current_key": "AIzaSyDqhkwUsJ9zianGEosN1NW_w-gKveMa3Ik"
        }
      ],
      "services": {
        "appinvite_service": {
          "other_platform_oauth_client": [
            {
              "client_id": "540691753241-pcq4g6kdee8r4nmpb34d1bbq7ha0lg1r.apps.googleusercontent.com",
              "client_type": 3
            }
          ]
        }
      }
    }
  ],
  "configuration_version": "1"
};

function ensureGoogleServices() {
  if (!fs.existsSync(androidAppDir)) {
    fs.mkdirSync(androidAppDir, { recursive: true });
  }

  let jsonContent = null;

  // 1. Check if base64 env secret is provided
  const base64Secret = process.env.GOOGLE_SERVICES_BASE64 || process.env.GOOGLE_SERVICES_JSON_BASE64;
  if (base64Secret && base64Secret.trim().length > 0) {
    try {
      jsonContent = Buffer.from(base64Secret.trim(), 'base64').toString('utf8');
      console.log('✅ Decoded google-services.json from base64 environment variable');
    } catch (e) {
      console.warn('⚠️ Failed to decode base64 environment variable:', e);
    }
  }

  // 2. Check root google-services.json
  if (!jsonContent && fs.existsSync(rootGoogleServices)) {
    jsonContent = fs.readFileSync(rootGoogleServices, 'utf8');
    console.log('✅ Loaded google-services.json from root directory');
  }

  // 3. Check android/app/google-services.json
  if (!jsonContent && fs.existsSync(androidGoogleServices)) {
    jsonContent = fs.readFileSync(androidGoogleServices, 'utf8');
    console.log('✅ Loaded google-services.json from android/app directory');
  }

  // 4. Fallback to default config
  if (!jsonContent) {
    jsonContent = JSON.stringify(DEFAULT_GOOGLE_SERVICES, null, 2);
    console.log('✅ Using embedded default google-services.json configuration');
  }

  // Write to both root and android/app
  fs.writeFileSync(rootGoogleServices, jsonContent, 'utf8');
  fs.writeFileSync(androidGoogleServices, jsonContent, 'utf8');
  console.log('✅ Synced google-services.json to both root and android/app/google-services.json');
}

ensureGoogleServices();
