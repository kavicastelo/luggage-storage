const { withAndroidManifest, withProjectBuildGradle } = require("expo/config-plugins");

const JITPACK_URL = "https://www.jitpack.io";
const JITPACK_MAVEN_LINE = `        maven { url '${JITPACK_URL}' }`;
const ANDROID_TOOLS_NS = "http://schemas.android.com/tools";

/**
 * Idempotently ensures the JitPack Maven repository is registered under
 * `allprojects { repositories { ... } }` in android/build.gradle so Gradle can
 * resolve `com.github.PayHereDevs:payhere-android-sdk:v3.0.18`.
 */
function addJitPackRepository(contents) {
  if (/jitpack\.io/i.test(contents)) {
    return contents;
  }

  const allProjectsRepoPattern = /(allprojects\s*\{[\s\S]*?repositories\s*\{)/;
  if (allProjectsRepoPattern.test(contents)) {
    return contents.replace(allProjectsRepoPattern, `$1\n${JITPACK_MAVEN_LINE}`);
  }

  return `${contents.trimEnd()}\n\nallprojects {\n    repositories {\n${JITPACK_MAVEN_LINE}\n    }\n}\n`;
}

/**
 * Idempotently ensures AndroidManifest.xml declares `xmlns:tools` on `<manifest>`
 * and `tools:replace="android:allowBackup"` on `<application>` to prevent
 * manifest merger conflicts with the PayHere Android SDK library manifest.
 */
function applyPayHereManifestTools(manifest) {
  const root = manifest.manifest;
  if (!root) {
    return manifest;
  }

  root.$ = root.$ || {};
  if (!root.$["xmlns:tools"]) {
    root.$["xmlns:tools"] = ANDROID_TOOLS_NS;
  }

  const applications = root.application;
  if (Array.isArray(applications) && applications.length > 0) {
    const mainApp = applications[0];
    mainApp.$ = mainApp.$ || {};
    const existingReplace = mainApp.$["tools:replace"];
    if (!existingReplace) {
      mainApp.$["tools:replace"] = "android:allowBackup";
    } else {
      const tokens = String(existingReplace)
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      if (!tokens.includes("android:allowBackup")) {
        tokens.push("android:allowBackup");
        mainApp.$["tools:replace"] = tokens.join(",");
      }
    }
  }

  return manifest;
}

function withPayHereSdk(config) {
  let nextConfig = withProjectBuildGradle(config, (modConfig) => {
    if (modConfig.modResults.language === "groovy") {
      modConfig.modResults.contents = addJitPackRepository(modConfig.modResults.contents);
    }
    return modConfig;
  });

  nextConfig = withAndroidManifest(nextConfig, (modConfig) => {
    modConfig.modResults = applyPayHereManifestTools(modConfig.modResults);
    return modConfig;
  });

  return nextConfig;
}

withPayHereSdk.addJitPackRepository = addJitPackRepository;
withPayHereSdk.applyPayHereManifestTools = applyPayHereManifestTools;

module.exports = withPayHereSdk;

