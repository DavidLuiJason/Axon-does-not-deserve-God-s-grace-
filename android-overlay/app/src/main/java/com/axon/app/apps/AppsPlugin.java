package com.axon.app.apps;

import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Base64;

import com.axon.app.screenstructure.AxonAccessibilityService;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * AXON Apps native side: lists launchable apps, opens one, returns a small icon, opens an app's settings page.
 * Package visibility comes from a narrow launcher query in the manifest (no broad all-packages permission).
 * It only lists and launches; reading and acting inside an app is the screen reader and the action gate.
 */
@CapacitorPlugin(name = "AxonApps")
public class AppsPlugin extends Plugin {
    @PluginMethod
    public void listApps(PluginCall call) {
        try {
            PackageManager pm = getContext().getPackageManager();
            Intent main = new Intent(Intent.ACTION_MAIN);
            main.addCategory(Intent.CATEGORY_LAUNCHER);
            List<ResolveInfo> found = pm.queryIntentActivities(main, 0);
            String self = getContext().getPackageName();
            Set<String> seen = new HashSet<>();
            JSArray apps = new JSArray();
            for (ResolveInfo info : found) {
                if (info.activityInfo == null) continue;
                String pkg = info.activityInfo.packageName;
                if (!seen.add(pkg)) continue;
                JSObject app = new JSObject();
                app.put("packageName", pkg);
                CharSequence label = info.loadLabel(pm);
                app.put("label", label == null ? pkg : label.toString());
                ApplicationInfo appInfo = info.activityInfo.applicationInfo;
                app.put("system", appInfo != null && (appInfo.flags & ApplicationInfo.FLAG_SYSTEM) != 0);
                app.put("self", pkg.equals(self));
                app.put("category", Build.VERSION.SDK_INT >= 26 && appInfo != null ? appInfo.category : -1);
                try {
                    PackageInfo pi = pm.getPackageInfo(pkg, 0);
                    if (pi.versionName != null) app.put("versionName", pi.versionName);
                    app.put("firstInstalled", pi.firstInstallTime);
                    app.put("lastUpdated", pi.lastUpdateTime);
                } catch (PackageManager.NameNotFoundException ignored) { }
                apps.put(app);
            }
            JSObject result = new JSObject();
            result.put("apps", apps);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("list-failed", e);
        }
    }

    @PluginMethod
    public void openApp(PluginCall call) {
        String pkg = call.getString("packageName");
        if (pkg == null || pkg.isEmpty()) {
            call.reject("no-package");
            return;
        }
        JSObject result = new JSObject();
        try {
            // The accessibility service is allowed to start apps while AXON is in the background; fall back to the plugin context.
            Context context = AxonAccessibilityService.current() != null ? AxonAccessibilityService.current() : getContext();
            Intent launch = context.getPackageManager().getLaunchIntentForPackage(pkg);
            if (launch == null) {
                result.put("opened", false);
                result.put("code", "not-launchable");
            } else {
                launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(launch);
                result.put("opened", true);
            }
        } catch (Exception e) {
            result.put("opened", false);
            result.put("code", "open-failed");
        }
        call.resolve(result);
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        String pkg = call.getString("packageName");
        if (pkg == null || pkg.isEmpty()) {
            call.reject("no-package");
            return;
        }
        JSObject result = new JSObject();
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + pkg));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            result.put("opened", true);
        } catch (Exception e) {
            result.put("opened", false);
        }
        call.resolve(result);
    }

    @PluginMethod
    public void getAppIcon(PluginCall call) {
        String pkg = call.getString("packageName");
        if (pkg == null || pkg.isEmpty()) {
            call.reject("no-package");
            return;
        }
        int size = call.getInt("size", 96);
        if (size < 24) size = 24;
        if (size > 192) size = 192;
        try {
            Drawable drawable = getContext().getPackageManager().getApplicationIcon(pkg);
            Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bitmap);
            drawable.setBounds(0, 0, size, size);
            drawable.draw(canvas);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, out);
            bitmap.recycle();
            JSObject result = new JSObject();
            result.put("png", Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP));
            result.put("size", size);
            call.resolve(result);
        } catch (PackageManager.NameNotFoundException e) {
            call.reject("no-such-app");
        } catch (Exception e) {
            call.reject("icon-failed", e);
        }
    }
}
