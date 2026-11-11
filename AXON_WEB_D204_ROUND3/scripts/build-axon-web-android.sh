#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
mkdir -p artifacts
REPORT="$ROOT/artifacts/android-build-report.txt"
: > "$REPORT"
run() {
  echo "
$ $*" | tee -a "$REPORT"
  "$@" 2>&1 | tee -a "$REPORT"
}
fail() { echo "BLOCKED/FAILED: $*" | tee -a "$REPORT"; exit 1; }

command -v node >/dev/null || fail "Node.js is missing."
command -v npm >/dev/null || fail "npm is missing."
command -v java >/dev/null || fail "JDK is missing."
node -e "if (process.versions.node !== '22.16.0') { console.error('Expected Node 22.16.0, found ' + process.versions.node); process.exit(1); }" || fail "Node version mismatch; use .nvmrc."
java -version 2>&1 | tee -a "$REPORT"
node --version | tee -a "$REPORT"
npm --version | tee -a "$REPORT"
CAP_BIN="$ROOT/node_modules/.bin/cap"
[[ -x "$CAP_BIN" ]] || fail "Capacitor CLI is not installed locally. Run npm ci from package-lock.json first; refusing npx package fallback."

node --input-type=module <<'NODE' | tee -a "$REPORT"
import fs from 'node:fs';
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
for (const [name, version] of Object.entries({
  '@capacitor/core': '7.6.9', '@capacitor/cli': '7.6.9', '@capacitor/android': '7.6.9',
  '@capacitor/app': '7.1.2', '@capacitor/filesystem': '7.1.9', '@capacitor/share': '7.0.4'
})) {
  if (pkg.dependencies[name] !== version || lock.packages[''].dependencies[name] !== version || lock.packages[`node_modules/${name}`]?.version !== version) {
    throw new Error(`${name} must be exactly ${version} in package.json and package-lock.json`);
  }
  console.log(`${name}: ${version} LOCKED`);
}
NODE

if [[ ! -d android ]]; then
  run "$CAP_BIN" add android
fi
[[ -x scripts/apply-android-overlay.sh || -f scripts/apply-android-overlay.sh ]] || fail "Android overlay script is missing."
bash scripts/apply-android-overlay.sh 2>&1 | tee -a "$REPORT"
run "$CAP_BIN" sync android

WRAPPER="$ROOT/android/gradle/wrapper/gradle-wrapper.properties"
ROOT_GRADLE="$ROOT/android/build.gradle"
VARIABLES="$ROOT/android/variables.gradle"
[[ -f "$WRAPPER" && -f "$ROOT/android/gradlew" && -f "$ROOT/android/gradle/wrapper/gradle-wrapper.jar" ]] || fail "Capacitor did not generate a complete Gradle wrapper."
grep -q 'gradle-8.11.1-' "$WRAPPER" || fail "Expected Gradle wrapper 8.11.1; inspect generated Capacitor template before changing the lock."
grep -q 'com.android.tools.build:gradle:8.7.2' "$ROOT_GRADLE" || fail "Expected Android Gradle Plugin 8.7.2; inspect generated Capacitor template before changing the lock."
grep -qE 'minSdkVersion[[:space:]]*=[[:space:]]*23|minSdkVersion[[:space:]]+23' "$VARIABLES" || fail "Expected minSdk 23 in variables.gradle."
grep -qE 'compileSdkVersion[[:space:]]*=[[:space:]]*35|compileSdkVersion[[:space:]]+35' "$VARIABLES" || fail "Expected compileSdk 35 in variables.gradle."
grep -qE 'targetSdkVersion[[:space:]]*=[[:space:]]*35|targetSdkVersion[[:space:]]+35' "$VARIABLES" || fail "Expected targetSdk 35 in variables.gradle."
printf '
Generated Android configuration: Gradle 8.11.1 / AGP 8.7.2 / min 23 / compile 35 / target 35 VERIFIED
' | tee -a "$REPORT"

[[ -n "${ANDROID_HOME:-}${ANDROID_SDK_ROOT:-}" ]] || fail "ANDROID_HOME / ANDROID_SDK_ROOT is not set; Java compile cannot run."
[[ -x android/gradlew ]] || chmod +x android/gradlew
run android/gradlew -p android --no-daemon --stacktrace :app:compileDebugJavaWithJavac
run android/gradlew -p android --no-daemon --stacktrace assembleDebug
APK="$ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
[[ -s "$APK" ]] || fail "Gradle returned without the expected debug APK."
printf '
APK BUILT: %s (%s bytes)
' "$APK" "$(stat -c '%s' "$APK")" | tee -a "$REPORT"
