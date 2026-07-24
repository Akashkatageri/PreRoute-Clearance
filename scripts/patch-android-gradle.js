import fs from 'fs';
import path from 'path';

const rootBuildGradle = path.join(process.cwd(), 'android', 'build.gradle');
const appBuildGradle = path.join(process.cwd(), 'android', 'app', 'build.gradle');

// 1. Patch Root android/build.gradle
if (fs.existsSync(rootBuildGradle)) {
  let content = fs.readFileSync(rootBuildGradle, 'utf8');
  if (!content.includes('com.google.gms:google-services') && !content.includes('com.google.gms.google-services')) {
    if (content.includes('dependencies {')) {
      content = content.replace(
        'dependencies {',
        `dependencies {\n        classpath 'com.google.gms:google-services:4.5.0'`
      );
    } else {
      content += `\nbuildscript {\n    dependencies {\n        classpath 'com.google.gms:google-services:4.5.0'\n    }\n}\n`;
    }
    fs.writeFileSync(rootBuildGradle, content, 'utf8');
    console.log('✅ Patched root android/build.gradle with google-services plugin classpath');
  }
}

// 2. Patch Module android/app/build.gradle
if (fs.existsSync(appBuildGradle)) {
  let content = fs.readFileSync(appBuildGradle, 'utf8');
  if (!content.includes("com.google.gms.google-services")) {
    content = content + `\n\ntry {\n    def servicesJSON = file('google-services.json')\n    if (servicesJSON.text) {\n        apply plugin: 'com.google.gms.google-services'\n    }\n} catch(Exception e) {\n    logger.warn("google-services.json missing, skipping plugin")\n}\n`;
  }
  
  if (!content.includes("play-services-auth")) {
    if (content.includes('dependencies {')) {
      content = content.replace(
        'dependencies {',
        `dependencies {\n    implementation 'com.google.android.gms:play-services-auth:21.3.0'`
      );
    }
  }

  if (!content.includes("firebase-bom")) {
    if (content.includes('dependencies {')) {
      content = content.replace(
        'dependencies {',
        `dependencies {\n    implementation platform('com.google.firebase:firebase-bom:34.16.0')\n    implementation 'com.google.firebase:firebase-analytics'\n    implementation 'com.google.firebase:firebase-auth'\n    implementation 'com.google.firebase:firebase-firestore'`
      );
    }
  }

  fs.writeFileSync(appBuildGradle, content, 'utf8');
  console.log('✅ Patched android/app/build.gradle with google-services plugin, play-services-auth, and Firebase BoM');
}

// 3. Patch MainActivity.java to explicitly register FirebaseAuthenticationPlugin BEFORE super.onCreate
function patchMainActivity() {
  const javaBaseDir = path.join(process.cwd(), 'android', 'app', 'src', 'main', 'java');
  if (!fs.existsSync(javaBaseDir)) return;

  function findMainActivity(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        const found = findMainActivity(fullPath);
        if (found) return found;
      } else if (file === 'MainActivity.java') {
        return fullPath;
      }
    }
    return null;
  }

  const mainActivityPath = findMainActivity(javaBaseDir);
  if (mainActivityPath) {
    let content = fs.readFileSync(mainActivityPath, 'utf8');
    
    // Ensure required imports
    if (!content.includes('import io.capawesome.capacitorjs.plugins.firebase.authentication.FirebaseAuthenticationPlugin;')) {
      content = content.replace(
        'import com.getcapacitor.BridgeActivity;',
        'import com.getcapacitor.BridgeActivity;\nimport android.os.Bundle;\nimport io.capawesome.capacitorjs.plugins.firebase.authentication.FirebaseAuthenticationPlugin;'
      );
    }

    // Replace or insert onCreate with registerPlugin BEFORE super.onCreate
    if (!content.includes('registerPlugin(FirebaseAuthenticationPlugin.class)')) {
      const customOnCreate = `
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FirebaseAuthenticationPlugin.class);
        super.onCreate(savedInstanceState);
    }
`;
      content = content.replace(
        /public class MainActivity extends BridgeActivity \{/,
        `public class MainActivity extends BridgeActivity {\n${customOnCreate}`
      );
    }

    fs.writeFileSync(mainActivityPath, content, 'utf8');
    console.log('✅ Patched MainActivity.java with explicit FirebaseAuthenticationPlugin registration before super.onCreate');
  }
}

patchMainActivity();
