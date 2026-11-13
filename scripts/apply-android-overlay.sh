#!/usr/bin/env bash
# Apply AXON Stage 6.1 android-overlay after `npx cap add android`.
# Safe to run twice (idempotent).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OVERLAY="$ROOT/android-overlay"
ANDROID="$ROOT/android"

if [[ ! -d "$ANDROID/app" ]]; then
  echo "ERROR: android/ not found. Run: npx cap add android"
  exit 1
fi

echo "==> Copying Java sources (background jobs, file saver, screen capture, browser, screen structure, MainActivity)"
mkdir -p "$ANDROID/app/src/main/java/com/axon/app/background"
mkdir -p "$ANDROID/app/src/main/java/com/axon/app/filesaver"
mkdir -p "$ANDROID/app/src/main/java/com/axon/app/screencapture"
mkdir -p "$ANDROID/app/src/main/java/com/axon/app/browser"
mkdir -p "$ANDROID/app/src/main/java/com/axon/app/screenstructure"
cp -f "$OVERLAY/app/src/main/java/com/axon/app/background/BackgroundJobService.java" \
      "$ANDROID/app/src/main/java/com/axon/app/background/"
cp -f "$OVERLAY/app/src/main/java/com/axon/app/background/BackgroundJobsPlugin.java" \
      "$ANDROID/app/src/main/java/com/axon/app/background/"
cp -f "$OVERLAY/app/src/main/java/com/axon/app/filesaver/FileSaverPlugin.java" \
      "$ANDROID/app/src/main/java/com/axon/app/filesaver/"
cp -f "$OVERLAY/app/src/main/java/com/axon/app/screencapture/ScreenCapturePlugin.java" \
      "$ANDROID/app/src/main/java/com/axon/app/screencapture/"
cp -f "$OVERLAY/app/src/main/java/com/axon/app/screencapture/ScreenCaptureService.java" \
      "$ANDROID/app/src/main/java/com/axon/app/screencapture/"
cp -f "$OVERLAY/app/src/main/java/com/axon/app/browser/BrowserPlugin.java" \
      "$ANDROID/app/src/main/java/com/axon/app/browser/"
cp -f "$OVERLAY/app/src/main/java/com/axon/app/browser/BrowserActivity.java" \
      "$ANDROID/app/src/main/java/com/axon/app/browser/"
cp -f "$OVERLAY/app/src/main/java/com/axon/app/screenstructure/AxonAccessibilityService.java" \
      "$ANDROID/app/src/main/java/com/axon/app/screenstructure/"
cp -f "$OVERLAY/app/src/main/java/com/axon/app/screenstructure/ScreenStructurePlugin.java" \
      "$ANDROID/app/src/main/java/com/axon/app/screenstructure/"
cp -f "$OVERLAY/app/src/main/java/com/axon/app/MainActivity.java" \
      "$ANDROID/app/src/main/java/com/axon/app/"

# Ensure AndroidX WebKit Multi-Profile API dependency is present exactly once.
GRADLE="$ANDROID/app/build.gradle"
if [[ -f "$GRADLE" ]]; then
  if ! grep -Eq "androidx\.webkit:webkit:[0-9.]+" "$GRADLE"; then
    if grep -q '^dependencies[[:space:]]*{' "$GRADLE"; then
      sed -i '/^dependencies[[:space:]]*{/a\    implementation "androidx.webkit:webkit:1.12.1"' "$GRADLE"
    else
      printf '\ndependencies {\n    implementation "androidx.webkit:webkit:1.12.1"\n}\n' >> "$GRADLE"
    fi
  fi
  COUNT=$(grep -Ec 'androidx\.webkit:webkit:' "$GRADLE" || true)
  if [[ "$COUNT" -ne 1 ]]; then
    echo "ERROR: expected exactly one androidx.webkit:webkit dependency, found $COUNT"
    exit 1
  fi
else
  echo "ERROR: $GRADLE missing; cannot install the approved WebKit dependency"
  exit 1
fi

echo "==> Copying notification icon"
mkdir -p "$ANDROID/app/src/main/res/drawable"
cp -f "$OVERLAY/app/src/main/res/drawable/ic_notification.xml" \
      "$ANDROID/app/src/main/res/drawable/"

echo "==> Copying accessibility screen reader resources"
mkdir -p "$ANDROID/app/src/main/res/xml" "$ANDROID/app/src/main/res/values"
cp -f "$OVERLAY/app/src/main/res/xml/axon_accessibility_service.xml" \
      "$ANDROID/app/src/main/res/xml/"
cp -f "$OVERLAY/app/src/main/res/values/axon_accessibility_strings.xml" \
      "$ANDROID/app/src/main/res/values/"

MANIFEST="$ANDROID/app/src/main/AndroidManifest.xml"
if [[ ! -f "$MANIFEST" ]]; then
  echo "ERROR: AndroidManifest.xml missing"
  exit 1
fi

echo "==> Patching AndroidManifest.xml permissions (exact set)"
# Ensure each required permission is present exactly once
ensure_perm() {
  local perm="$1"
  if ! grep -q "android.permission.${perm}" "$MANIFEST"; then
    # Insert after <manifest ...> opening tag
    sed -i "s|<manifest \(.*\)>|<manifest \1>\n    <uses-permission android:name=\"android.permission.${perm}\" />|" "$MANIFEST"
    echo "    + added permission $perm"
  else
    echo "    = permission $perm already present"
  fi
}

ensure_perm "POST_NOTIFICATIONS"
ensure_perm "FOREGROUND_SERVICE"
ensure_perm "FOREGROUND_SERVICE_SPECIAL_USE"
ensure_perm "FOREGROUND_SERVICE_MEDIA_PROJECTION"
ensure_perm "REQUEST_IGNORE_BATTERY_OPTIMIZATIONS"
ensure_perm "WAKE_LOCK"
ensure_perm "INTERNET"

if ! grep -q "WRITE_EXTERNAL_STORAGE" "$MANIFEST"; then
  sed -i "s|<manifest \(.*\)>|<manifest \1>\n    <uses-permission android:name=\"android.permission.WRITE_EXTERNAL_STORAGE\" android:maxSdkVersion=\"28\" />|" "$MANIFEST"
  echo "    + added permission WRITE_EXTERNAL_STORAGE"
else
  echo "    = permission WRITE_EXTERNAL_STORAGE already present"
fi

echo "==> Ensuring BackgroundJobService declaration"
if ! grep -q "BackgroundJobService" "$MANIFEST"; then
  # Insert service before closing </application>
  SERVICE_XML='        <service
            android:name=".background.BackgroundJobService"
            android:exported="false"
            android:foregroundServiceType="specialUse">
            <property
                android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
                android:value="Background execution proof: continuous native heartbeat and activity label for reliability measurement. Not media, not data sync." />
        </service>'
  # Use a temp file to insert before </application>
  awk -v svc="$SERVICE_XML" '
    /<\/application>/ { print svc }
    { print }
  ' "$MANIFEST" > "$MANIFEST.tmp" && mv "$MANIFEST.tmp" "$MANIFEST"
  echo "    + added BackgroundJobService"
else
  echo "    = BackgroundJobService already present"
fi

echo "==> Ensuring ScreenCaptureService declaration"
if ! grep -q "ScreenCaptureService" "$MANIFEST"; then
  SERVICE_XML='        <service
            android:name=".screencapture.ScreenCaptureService"
            android:exported="false"
            android:foregroundServiceType="mediaProjection" />'
  awk -v svc="$SERVICE_XML" '/<\/application>/ { print svc } { print }' "$MANIFEST" > "$MANIFEST.tmp" && mv "$MANIFEST.tmp" "$MANIFEST"
  echo "    + added ScreenCaptureService"
else
  echo "    = ScreenCaptureService already present"
fi

echo "==> Ensuring AXON Web BrowserActivity declaration"
if ! grep -q 'android:name=".browser.BrowserActivity"' "$MANIFEST"; then
  ACTIVITY_XML='        <activity
            android:name=".browser.BrowserActivity"
            android:exported="false"
            android:configChanges="orientation|screenSize|keyboardHidden"
            android:label="AXON Web" />'
  awk -v act="$ACTIVITY_XML" '
    BEGIN { in_start=0; done=0 }
    !done && !in_start && /<application([[:space:]>]|$)/ {
      print
      if (index($0, ">")) { print act; done=1 } else { in_start=1 }
      next
    }
    in_start {
      print
      if (index($0, ">")) { print act; in_start=0; done=1 }
      next
    }
    { print }
    END { if (!done) exit 42 }
  ' "$MANIFEST" > "$MANIFEST.tmp" && mv "$MANIFEST.tmp" "$MANIFEST"
  grep -q 'android:name=".browser.BrowserActivity"' "$MANIFEST" || { echo "ERROR: BrowserActivity declaration insertion failed"; exit 1; }
  echo "    + added BrowserActivity"
else
  echo "    = BrowserActivity already present"
fi

echo "==> Ensuring AxonAccessibilityService declaration (read-only screen reader; the owner turns it on in Android settings)"
if ! grep -q "AxonAccessibilityService" "$MANIFEST"; then
  SERVICE_XML='        <service
            android:name=".screenstructure.AxonAccessibilityService"
            android:exported="true"
            android:label="AXON screen reader"
            android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE">
            <intent-filter>
                <action android:name="android.accessibilityservice.AccessibilityService" />
            </intent-filter>
            <meta-data
                android:name="android.accessibilityservice"
                android:resource="@xml/axon_accessibility_service" />
        </service>'
  awk -v svc="$SERVICE_XML" '/<\/application>/ { print svc } { print }' "$MANIFEST" > "$MANIFEST.tmp" && mv "$MANIFEST.tmp" "$MANIFEST"
  grep -q "AxonAccessibilityService" "$MANIFEST" || { echo "ERROR: AxonAccessibilityService declaration insertion failed"; exit 1; }
  echo "    + added AxonAccessibilityService"
else
  echo "    = AxonAccessibilityService already present"
fi

echo "==> Overlay applied successfully."
echo "Next: npx cap sync android && cd android && ./gradlew assembleDebug"
