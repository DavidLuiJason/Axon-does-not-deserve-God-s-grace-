package com.axon.app.screenstructure;

import android.content.Intent;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.util.HashSet;
import java.util.Set;

/** Bridge to the accessibility screen reader and executor. The owner enables the service in Android settings. */
@CapacitorPlugin(name = "ScreenStructure")
public class ScreenStructurePlugin extends Plugin {
    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("platform", "android");
        result.put("serviceEnabled", AxonAccessibilityService.isRunning());
        result.put("canAct", true);
        call.resolve(result);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            JSObject result = new JSObject();
            result.put("opened", true);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("settings-unavailable", e);
        }
    }

    @PluginMethod
    public void readScreen(PluginCall call) {
        if (!AxonAccessibilityService.isRunning()) {
            call.reject("accessibility-service-off");
            return;
        }
        int maxNodes = call.getInt("maxNodes", 600);
        if (maxNodes < 1) maxNodes = 1;
        if (maxNodes > 2000) maxNodes = 2000;
        try {
            JSONObject snapshot = AxonAccessibilityService.readActiveScreen(maxNodes);
            if (snapshot == null) {
                call.reject("no-active-window");
                return;
            }
            JSObject result = new JSObject();
            result.put("snapshot", snapshot);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("read-failed", e);
        }
    }

    @PluginMethod
    public void performAction(PluginCall call) {
        JSObject action = call.getObject("action");
        if (action == null) {
            call.reject("no-action");
            return;
        }
        if (!AxonAccessibilityService.isRunning()) {
            call.reject("accessibility-service-off");
            return;
        }
        JSObject result = new JSObject();
        result.put("result", AxonAccessibilityService.perform(action));
        call.resolve(result);
    }

    @PluginMethod
    public void recognizeRegions(PluginCall call) {
        JSArray regions = call.getArray("regions");
        if (regions == null) {
            call.reject("no-regions");
            return;
        }
        AxonAccessibilityService service = AxonAccessibilityService.current();
        if (service == null) {
            call.reject("accessibility-service-off");
            return;
        }
        try {
            JSObject result = new JSObject();
            result.put("result", PictureTextReader.read(service, regions, 12));
            call.resolve(result);
        } catch (Exception e) {
            call.reject("recognize-failed", e);
        }
    }

    @PluginMethod
    public void performGesture(PluginCall call) {
        JSObject action = call.getObject("action");
        if (action == null) {
            call.reject("no-action");
            return;
        }
        JSObject result = new JSObject();
        result.put("result", AxonAccessibilityService.performGesture(action));
        call.resolve(result);
    }

    @PluginMethod
    public void getKillState(PluginCall call) {
        JSObject result = new JSObject();
        result.put("stopRequested", AxonAccessibilityService.isStopRequested());
        call.resolve(result);
    }

    @PluginMethod
    public void requestStop(PluginCall call) {
        AxonAccessibilityService.requestStop();
        call.resolve();
    }

    @PluginMethod
    public void clearStop(PluginCall call) {
        AxonAccessibilityService.clearStop();
        call.resolve();
    }

    @PluginMethod
    public void showStopControl(PluginCall call) {
        AxonAccessibilityService service = AxonAccessibilityService.current();
        JSObject result = new JSObject();
        if (service == null) {
            result.put("shown", false);
            result.put("code", "accessibility-service-off");
        } else {
            String text = call.getString("text");
            result.put("shown", service.showStopBlocking(text == null || text.isEmpty() ? "STOP AXON" : text, 1500));
        }
        call.resolve(result);
    }

    @PluginMethod
    public void hideStopControl(PluginCall call) {
        AxonAccessibilityService service = AxonAccessibilityService.current();
        if (service != null) service.hideStop();
        call.resolve();
    }

    @PluginMethod
    public void startRecording(PluginCall call) {
        JSObject result = new JSObject();
        if (!AxonAccessibilityService.isRunning()) {
            result.put("recording", false);
            result.put("code", "accessibility-service-off");
        } else {
            Set<String> blocked = new HashSet<>();
            JSArray list = call.getArray("blockedPackages");
            if (list != null) {
                for (int i = 0; i < list.length(); i++) blocked.add(list.optString(i));
            }
            AxonAccessibilityService.startRecording(blocked);
            result.put("recording", true);
        }
        call.resolve(result);
    }

    @PluginMethod
    public void stopRecording(PluginCall call) {
        JSObject result = new JSObject();
        result.put("events", AxonAccessibilityService.stopRecording());
        call.resolve(result);
    }
}
