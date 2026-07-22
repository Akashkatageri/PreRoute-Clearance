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
  
  if (!content.includes("firebase-bom")) {
    if (content.includes('dependencies {')) {
      content = content.replace(
        'dependencies {',
        `dependencies {\n    implementation platform('com.google.firebase:firebase-bom:34.16.0')\n    implementation 'com.google.firebase:firebase-analytics'\n    implementation 'com.google.firebase:firebase-auth'\n    implementation 'com.google.firebase:firebase-firestore'`
      );
    }
  }

  fs.writeFileSync(appBuildGradle, content, 'utf8');
  console.log('✅ Patched android/app/build.gradle with google-services plugin and Firebase BoM');
}
