package com.axon.app.screenstructure;

import android.content.Intent;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

/** Bridge to the read-only accessibility screen reader. The owner enables the service in Android settings. */
@CapacitorPlugin(name = "ScreenStructure")
public class ScreenStructurePlugin extends Plugin {
    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("platform", "android");
        result.put("serviceEnabled", AxonAccessibilityService.isRunning());
        result.put("readOnly", true);
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
}
