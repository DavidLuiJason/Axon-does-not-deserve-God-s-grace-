#!/usr/bin/env python3
"""Read-only inventory of the actual Round 6 test host and absent platform providers."""
from __future__ import annotations
import json, os, platform, shutil, subprocess, sys
from pathlib import Path

COMMANDS = [
    'node', 'npm', 'python3', 'g++', 'clang++', 'rustc', 'cargo', 'java', 'gradle', 'adb', 'sdkmanager',
    'unity-editor', 'Unity', 'UnrealEditor', 'wasmtime', 'wasmer', 'bwrap', 'firejail', 'nsjail', 'docker', 'podman'
]

def version(path: str | None, flag: str = '--version') -> str | None:
    if not path:
        return None
    try:
        done = subprocess.run([path, flag], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=5)
        return done.stdout.strip().splitlines()[0][:240] if done.stdout.strip() else f'exit={done.returncode}'
    except Exception as exc:
        return f'probe-error:{type(exc).__name__}'

inventory = {}
for command in COMMANDS:
    path = shutil.which(command)
    inventory[command] = {'present': bool(path), **({'path': path, 'version': version(path)} if path else {})}

try:
    import playwright
    playwright_available = True
    playwright_version = getattr(playwright, '__version__', 'python-package-present')
except Exception:
    playwright_available = False
    playwright_version = None

try:
    import importlib.metadata
    playwright_version = importlib.metadata.version('playwright') if playwright_available else None
except Exception:
    pass

try:
    import ctypes
    effective_uid = os.geteuid() if hasattr(os, 'geteuid') else None
except Exception:
    effective_uid = None

result = {
    'capturedAt': __import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),
    'host': {'system': platform.system(), 'release': platform.release(), 'machine': platform.machine(), 'platform': platform.platform(),
             'effectiveUid': effective_uid, 'runningAsRoot': effective_uid == 0 if effective_uid is not None else None},
    'commands': inventory,
    'pythonPlaywright': {'available': playwright_available, 'version': playwright_version},
    'browser': {'chromiumPath': shutil.which('chromium'), 'chromiumVersion': version(shutil.which('chromium'))},
    'remoteWorkerConfigured': bool(os.environ.get('AXON_REMOTE_ENDPOINT')),
    'deviceTests': {'androidDevice': False, 'androidWebViewDevice': False, 'iosDevice': False, 'windowsHost': False, 'macosHost': False},
    'executionAssessment': {
      'chromiumWorker': 'ACTUALLY_EXECUTED_IN_ROUND6; browser-level opaque-origin/CSP Worker checks passed; host Chromium was launched with --no-sandbox because this container runs as root, so this is not OS sandbox certification',
      'linuxNativeUserRuntime': 'BLOCKED; no verified OS sandbox provider is installed and this runner is root',
      'pythonCppRustAndroidDesktopGameEnginesRemote': 'BLOCKED_OR_NOT_CONFIGURED; see command inventory and package capability matrix',
      'androidWebViewIosWebKitFirefoxSafariWindowsMacOS': 'NOT_RUN; no corresponding host/device was attached'
    }
}
print(json.dumps(result, indent=2))
