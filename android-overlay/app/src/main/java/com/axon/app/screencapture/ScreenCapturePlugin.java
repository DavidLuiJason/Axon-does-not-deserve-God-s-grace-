package com.axon.app.screencapture;

import android.app.Activity;
import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.media.projection.MediaProjectionManager;
import android.os.Build;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;

/** User-initiated Android MediaProjection bridge. No accessibility automation is provided. */
@CapacitorPlugin(
        name = "ScreenCapture",
        permissions = { @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications") }
)
public class ScreenCapturePlugin extends Plugin {
    private static ScreenCapturePlugin instance;

    @Override
    public void load() {
        super.load();
        instance = this;
    }

    public static void emitEvent(String name, JSONObject value) {
        ScreenCapturePlugin plugin = instance;
        if (plugin == null) return;
        try { plugin.notifyListeners(name, JSObject.fromJSONObject(value)); }
        catch (Exception ignored) { }
    }

    @PluginMethod
    public void getCapabilities(PluginCall call) {
        JSObject result = new JSObject();
        result.put("platform", "android");
        result.put("screenRecording", true);
        result.put("screenSnapshots", true);
        result.put("snapshotMethod", "segment-keyframe-extraction");
        result.put("accessibilityTree", false);
        result.put("crossAppCapture", true);
        result.put("requiresUserConsentEachSession", true);
        result.put("requiresVisibleForegroundService", true);
        result.put("audioCapture", false);
        result.put("androidApiLevel", Build.VERSION.SDK_INT);
        android.util.DisplayMetrics metrics = getContext().getResources().getDisplayMetrics();
        result.put("displayWidth", metrics.widthPixels);
        result.put("displayHeight", metrics.heightPixels);
        result.put("defaultFrameRate", 15);
        result.put("defaultMaxDimension", 1920);
        result.put("reason", "Uses user-approved MediaProjection. Protected or secure content may be unavailable.");
        call.resolve(result);
    }

    @PluginMethod
    public void startSession(PluginCall call) {
        String state = ScreenCaptureService.reconcileSnapshot(getContext()).optString("state", "idle");
        if ("active".equals(state) || "starting".equals(state) || "recording".equals(state)) {
            call.reject("A screen-capture session is already active.");
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "notificationPermissionResult");
            return;
        }
        launchScreenCaptureConsent(call);
    }

    @PermissionCallback
    private void notificationPermissionResult(PluginCall call) {
        if (call == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && getPermissionState("notifications") != PermissionState.GRANTED) {
            call.reject("Notification permission is required so the active screen recording has a persistent visible stop control.", "NOTIFICATION_PERMISSION_DENIED");
            return;
        }
        launchScreenCaptureConsent(call);
    }

    private void launchScreenCaptureConsent(PluginCall call) {
        MediaProjectionManager manager = (MediaProjectionManager) getContext().getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        if (manager == null) {
            call.reject("MediaProjection is unavailable on this device.");
            return;
        }
        Intent consentIntent = manager.createScreenCaptureIntent();
        startActivityForResult(call, consentIntent, "screenCaptureConsentResult");
    }

    @ActivityCallback
    private void screenCaptureConsentResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result == null || result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("Screen-capture permission was not granted.", "PERMISSION_DENIED");
            return;
        }
        Intent service = new Intent(getContext(), ScreenCaptureService.class);
        service.setAction(ScreenCaptureService.ACTION_START);
        service.putExtra(ScreenCaptureService.EXTRA_RESULT_CODE, result.getResultCode());
        service.putExtra(ScreenCaptureService.EXTRA_RESULT_DATA, result.getData());
        JSONObject options = call.getData().optJSONObject("options");
        if (options != null) {
            service.putExtra(ScreenCaptureService.EXTRA_SESSION_ID, options.optString("sessionId", ""));
            service.putExtra(ScreenCaptureService.EXTRA_SEGMENT_SECONDS, options.optInt("segmentDurationSeconds", 30));
            service.putExtra(ScreenCaptureService.EXTRA_FRAME_RATE, options.optInt("frameRate", 15));
            service.putExtra(ScreenCaptureService.EXTRA_BITRATE, options.optInt("bitrate", 1800000));
            service.putExtra(ScreenCaptureService.EXTRA_MAX_BYTES, options.optLong("maxStorageBytes", 268435456L));
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) getContext().startForegroundService(service);
            else getContext().startService(service);
            JSObject response = new JSObject();
            response.put("granted", true);
            response.put("state", "starting");
            response.put("requiresVisibleForegroundService", true);
            call.resolve(response);
        } catch (Exception error) {
            call.reject("Unable to start the screen-capture service: " + error.getMessage(), "START_FAILED");
        }
    }

    @PluginMethod
    public void stopSession(PluginCall call) {
        Intent service = new Intent(getContext(), ScreenCaptureService.class);
        service.setAction(ScreenCaptureService.ACTION_STOP);
        try {
            getContext().startService(service);
            call.resolve();
        } catch (Exception error) {
            call.reject("Unable to stop screen capture: " + error.getMessage());
        }
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        try {
            call.resolve(JSObject.fromJSONObject(ScreenCaptureService.reconcileSnapshot(getContext())));
        } catch (Exception error) {
            call.reject("Unable to read the screen-capture status: " + error.getMessage());
        }
    }

    @PluginMethod
    public void getStorageStats(PluginCall call) {
        File root = ScreenCaptureService.getCaptureRoot(getContext());
        JSObject result = new JSObject();
        result.put("usedBytes", ScreenCaptureService.directoryBytes(root));
        result.put("maxStorageBytes", getContext().getSharedPreferences("axon_screen_capture", Context.MODE_PRIVATE).getLong("maxStorageBytes", 268435456L));
        result.put("root", root.getAbsolutePath());
        result.put("privateAppStorage", true);
        call.resolve(result);
    }

    @PluginMethod
    public void listSessions(PluginCall call) {
        JSArray sessions = new JSArray();
        File root = ScreenCaptureService.getCaptureRoot(getContext());
        File[] folders = root.listFiles();
        if (folders != null) for (File folder : folders) {
            if (!folder.isDirectory()) continue;
            JSObject item = new JSObject();
            item.put("sessionId", folder.getName());
            item.put("bytes", ScreenCaptureService.directoryBytes(folder));
            item.put("privateAppStorage", true);
            sessions.put(item);
        }
        JSObject result = new JSObject();
        result.put("sessions", sessions);
        call.resolve(result);
    }

    @PluginMethod
    public void deleteSession(PluginCall call) {
        String sessionId = call.getString("sessionId", "");
        if (sessionId.trim().isEmpty()) { call.reject("sessionId is required."); return; }
        JSONObject snapshot = ScreenCaptureService.reconcileSnapshot(getContext());
        String active = snapshot.optString("sessionId", "");
        if (sessionId.equals(active) && ("active".equals(snapshot.optString("state", "")) || "recording".equals(snapshot.optString("state", "")))) {
            call.reject("Stop the active capture session before deleting it."); return;
        }
        try {
            File root = ScreenCaptureService.getCaptureRoot(getContext()).getCanonicalFile();
            File target = new File(root, sessionId.replaceAll("[^A-Za-z0-9_-]", "_")).getCanonicalFile();
            if (!target.getPath().startsWith(root.getPath() + File.separator)) { call.reject("Invalid session path."); return; }
            boolean deleted = deleteRecursively(target);
            JSObject result = new JSObject(); result.put("deleted", deleted); result.put("sessionId", sessionId); call.resolve(result);
        } catch (Exception error) { call.reject("Could not delete capture session: " + error.getMessage()); }
    }

    private boolean deleteRecursively(File file) {
        if (!file.exists()) return true;
        File[] children = file.listFiles();
        if (children != null) for (File child : children) if (!deleteRecursively(child)) return false;
        return file.delete();
    }

    @PluginMethod
    public void listSegments(PluginCall call) {
        JSArray segments = new JSArray();
        File root = new File(getContext().getFilesDir(), "axon-screen-capture");
        if (root.exists()) {
            File[] sessions = root.listFiles();
            if (sessions != null) {
                for (File session : sessions) {
                    File manifest = new File(session, "segments.jsonl");
                    if (!manifest.isFile()) continue;
                    try (BufferedReader reader = new BufferedReader(new FileReader(manifest))) {
                        String line;
                        while ((line = reader.readLine()) != null) {
                            try { segments.put(new JSObject(line)); } catch (Exception ignored) { }
                        }
                    } catch (Exception ignored) { }
                }
            }
        }
        JSObject response = new JSObject();
        response.put("segments", segments);
        call.resolve(response);
    }
}
