#!/usr/bin/env python3
"""Regression test for idempotent Android overlay insertion on generated manifest shapes."""
from pathlib import Path
import shutil
import subprocess
import tempfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "apply-android-overlay.sh"
OVERLAY = ROOT / "android-overlay"


def run_case(manifest_text: str, name: str) -> None:
    with tempfile.TemporaryDirectory(prefix=f"axon-overlay-{name}-") as raw:
        tmp = Path(raw)
        (tmp / "scripts").mkdir()
        (tmp / "android/app/src/main").mkdir(parents=True)
        (tmp / "android/app/build.gradle").write_text("plugins { id 'com.android.application' }\ndependencies {\n}\n", encoding="utf-8")
        shutil.copy2(SCRIPT, tmp / "scripts/apply-android-overlay.sh")
        shutil.copytree(OVERLAY, tmp / "android-overlay")
        # The WEB7 mini-base intentionally omits unrelated overlay payloads. Supply
        # temporary fixture placeholders so this test can exercise the complete
        # idempotent script path without adding unrelated files to the return ZIP.
        omitted = [
            "app/src/main/java/com/axon/app/background/BackgroundJobService.java",
            "app/src/main/java/com/axon/app/background/BackgroundJobsPlugin.java",
            "app/src/main/java/com/axon/app/filesaver/FileSaverPlugin.java",
            "app/src/main/java/com/axon/app/screencapture/ScreenCapturePlugin.java",
            "app/src/main/java/com/axon/app/screencapture/ScreenCaptureService.java",
            "app/src/main/res/drawable/ic_notification.xml",
        ]
        for relative in omitted:
            fixture = tmp / "android-overlay" / relative
            fixture.parent.mkdir(parents=True, exist_ok=True)
            fixture.write_text("<!-- temporary WEB7 overlay-test fixture -->\n" if fixture.suffix == ".xml" else "// temporary WEB7 overlay-test fixture\n", encoding="utf-8")
        manifest = tmp / "android/app/src/main/AndroidManifest.xml"
        manifest.write_text(manifest_text, encoding="utf-8")

        for _ in range(2):
            subprocess.run(["bash", str(tmp / "scripts/apply-android-overlay.sh")], check=True, capture_output=True, text=True)

        gradle = (tmp / "android/app/build.gradle").read_text(encoding="utf-8")
        assert gradle.count('androidx.webkit:webkit:1.12.1') == 1, f"{name}: WebKit dependency missing or duplicated"
        content = manifest.read_text(encoding="utf-8")
        ET.fromstring(content)
        for class_name in [".browser.BrowserActivity", ".background.BackgroundJobService"]:
            count = content.count(f'android:name="{class_name}"')
            assert count == 1, f"{name}: expected one {class_name}, found {count}"
        for permission in [
            "POST_NOTIFICATIONS", "FOREGROUND_SERVICE", "FOREGROUND_SERVICE_SPECIAL_USE",
            "REQUEST_IGNORE_BATTERY_OPTIMIZATIONS", "WAKE_LOCK", "INTERNET", "WRITE_EXTERNAL_STORAGE",
        ]:
            count = content.count(f'android:name="android.permission.{permission}"')
            assert count == 1, f"{name}: expected one permission {permission}, found {count}"
        for java_file in [
            "com/axon/app/browser/BrowserActivity.java",
            "com/axon/app/browser/BrowserPlugin.java",
            "com/axon/app/MainActivity.java",
        ]:
            assert (tmp / "android/app/src/main/java" / java_file).is_file(), f"{name}: missing {java_file}"


run_case(
    """<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.axon.app">
    <application android:allowBackup="true" android:label="AXON">
        <activity android:name=".MainActivity" android:exported="true" />
    </application>
</manifest>
""",
    "single-line-application",
)
run_case(
    """<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.axon.app">
    <application
        android:allowBackup="true"
        android:label="AXON">
        <activity android:name=".MainActivity" android:exported="true" />
    </application>
</manifest>
""",
    "multi-line-application",
)
print("BROWSER_OVERLAY_APPLY_OK: 2 manifest layouts, twice each, XML valid, no duplicate declarations, WebKit dependency exactly once")
