package com.axon.app.screenstructure;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Path;
import android.graphics.PixelFormat;
import android.graphics.Rect;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Display;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.accessibility.AccessibilityWindowInfo;
import android.widget.Button;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Screen structure reader and ACTION EXECUTOR. The owner turns it on in Android Accessibility settings.
 * It reads the screen, and it carries out ONLY actions the JS action gate already allowed or the owner approved
 * (tap, long-press, type, switch, scroll, Back, Home). It re-checks the app and the element first, never types into
 * a password field, never sends the text of a password field, and uses no screen gestures.
 * It can also take ONE screenshot on request (Android 11+) for picture-text reading; the pixels stay in memory only.
 * Auto-clicker parts: coordinate taps and swipes (re-checked against the app in front), a STOP button drawn over every app
 * (accessibility overlay, no draw-over-apps permission) that sets a kill switch checked by every action, and an optional
 * recorder of taps and scrolls by label (never typed text, never password fields, never blocked apps).
 */
public class AxonAccessibilityService extends AccessibilityService {
    private static volatile AxonAccessibilityService instance;
    private static final int MAX_DEPTH = 40;
    private static final int MAX_RECORDED = 500;
    private static volatile boolean stopRequested = false;
    private static volatile boolean recording = false;
    private static volatile Set<String> recordBlocked = new HashSet<>();
    private static final List<JSONObject> recorded = new ArrayList<>();
    private View stopView;

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        instance = this;
    }

    @Override
    public boolean onUnbind(Intent intent) {
        instance = null;
        return super.onUnbind(intent);
    }

    @Override
    public void onDestroy() {
        instance = null;
        super.onDestroy();
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (!recording || event == null) return;
        int type = event.getEventType();
        String kind;
        if (type == AccessibilityEvent.TYPE_VIEW_CLICKED) kind = "click";
        else if (type == AccessibilityEvent.TYPE_VIEW_LONG_CLICKED) kind = "long-click";
        else if (type == AccessibilityEvent.TYPE_VIEW_SCROLLED) kind = "scroll";
        else if (type == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) kind = "window";
        else return;
        CharSequence pkgText = event.getPackageName();
        if (pkgText == null) return;
        String pkg = pkgText.toString();
        if (recordBlocked.contains(pkg)) return;
        try {
            JSONObject o = new JSONObject();
            o.put("t", System.currentTimeMillis());
            o.put("type", kind);
            o.put("packageName", pkg);
            CharSequence cls = event.getClassName();
            if (cls != null) o.put("className", cls.toString());
            if (!"window".equals(kind)) {
                String label = null;
                AccessibilityNodeInfo source = event.getSource();
                if (source != null) {
                    if (source.isPassword()) return;
                    // Typed text must never be recorded: a field's text is its content, so editable fields only give their description.
                    if (source.isEditable()) label = firstText(source.getContentDescription(), Build.VERSION.SDK_INT >= 26 ? source.getHintText() : null);
                    else label = firstText(source.getText(), source.getContentDescription());
                    Rect r = new Rect();
                    source.getBoundsInScreen(r);
                    JSONObject bounds = new JSONObject();
                    bounds.put("l", r.left);
                    bounds.put("t", r.top);
                    bounds.put("r", r.right);
                    bounds.put("b", r.bottom);
                    o.put("bounds", bounds);
                    JSONObject screen = new JSONObject();
                    screen.put("width", getResources().getDisplayMetrics().widthPixels);
                    screen.put("height", getResources().getDisplayMetrics().heightPixels);
                    o.put("screen", screen);
                } else if (cls == null || !cls.toString().contains("EditText")) {
                    List<CharSequence> texts = event.getText();
                    if (texts != null && !texts.isEmpty()) label = firstText(texts.get(0), null);
                }
                if (label != null) o.put("label", label);
            }
            if ("scroll".equals(kind) && Build.VERSION.SDK_INT >= 28) {
                o.put("scrollDx", event.getScrollDeltaX());
                o.put("scrollDy", event.getScrollDeltaY());
            }
            synchronized (recorded) {
                if (recorded.size() < MAX_RECORDED) recorded.add(o);
            }
        } catch (Exception ignored) { }
    }

    private static String firstText(CharSequence a, CharSequence b) {
        if (a != null && a.toString().trim().length() > 0) return a.toString().trim();
        if (b != null && b.toString().trim().length() > 0) return b.toString().trim();
        return null;
    }

    @Override
    public void onInterrupt() { }

    /** Result of one screenshot request: a software bitmap, or an error code. Memory only, never written anywhere. */
    static final class ShotResult {
        Bitmap bitmap;
        String error;
    }

    public static AxonAccessibilityService current() {
        return instance;
    }

    ShotResult takeShot(long timeoutMs) {
        final ShotResult result = new ShotResult();
        if (Build.VERSION.SDK_INT < 30) {
            result.error = "screenshot-needs-android-11";
            return result;
        }
        final CountDownLatch latch = new CountDownLatch(1);
        ExecutorService executor = Executors.newSingleThreadExecutor();
        try {
            takeScreenshot(Display.DEFAULT_DISPLAY, executor, new TakeScreenshotCallback() {
                @Override
                public void onSuccess(ScreenshotResult shot) {
                    try {
                        Bitmap hardware = Bitmap.wrapHardwareBuffer(shot.getHardwareBuffer(), shot.getColorSpace());
                        if (hardware != null) {
                            result.bitmap = hardware.copy(Bitmap.Config.ARGB_8888, false);
                            hardware.recycle();
                        } else {
                            result.error = "screenshot-failed";
                        }
                    } catch (Exception e) {
                        result.error = "screenshot-failed";
                    } finally {
                        try {
                            shot.getHardwareBuffer().close();
                        } catch (Exception ignored) { }
                        latch.countDown();
                    }
                }

                @Override
                public void onFailure(int errorCode) {
                    result.error = errorCode == ERROR_TAKE_SCREENSHOT_SECURE_WINDOW ? "screen-protected" : "screenshot-failed";
                    latch.countDown();
                }
            });
            if (!latch.await(timeoutMs, TimeUnit.MILLISECONDS)) result.error = "screenshot-timeout";
        } catch (Exception e) {
            result.error = "screenshot-failed";
        } finally {
            executor.shutdown();
        }
        if (result.bitmap == null && result.error == null) result.error = "screenshot-failed";
        return result;
    }

    public static boolean isRunning() {
        return instance != null;
    }

    /** Returns null when there is no active window to read. */
    public static JSONObject readActiveScreen(int maxNodes) throws JSONException {
        AxonAccessibilityService service = instance;
        if (service == null) return null;
        AccessibilityNodeInfo root = service.getRootInActiveWindow();
        if (root == null) return null;
        int[] budget = new int[] { maxNodes };
        JSONObject snapshot = new JSONObject();
        CharSequence pkg = root.getPackageName();
        snapshot.put("packageName", pkg == null ? "unknown" : pkg.toString());
        if (Build.VERSION.SDK_INT >= 24) {
            AccessibilityWindowInfo window = root.getWindow();
            if (window != null && window.getTitle() != null) snapshot.put("windowTitle", window.getTitle().toString());
        }
        snapshot.put("capturedAt", System.currentTimeMillis());
        JSONObject screen = new JSONObject();
        screen.put("width", service.getResources().getDisplayMetrics().widthPixels);
        screen.put("height", service.getResources().getDisplayMetrics().heightPixels);
        snapshot.put("screen", screen);
        JSONArray nodes = new JSONArray();
        nodes.put(toJson(root, 0, budget));
        snapshot.put("nodes", nodes);
        snapshot.put("nodeBudgetLeft", budget[0]);
        return snapshot;
    }

    // ---- auto-clicker safety: native kill switch and visible STOP control ----
    public static boolean isStopRequested() {
        return stopRequested;
    }

    public static void requestStop() {
        stopRequested = true;
    }

    public static void clearStop() {
        stopRequested = false;
    }

    /** Draws a STOP button over every app (accessibility overlay). Tapping it sets the kill switch. Returns true when it is showing. */
    public boolean showStopBlocking(final String text, long timeoutMs) {
        final AtomicBoolean shown = new AtomicBoolean(false);
        final CountDownLatch latch = new CountDownLatch(1);
        new Handler(Looper.getMainLooper()).post(new Runnable() {
            @Override
            public void run() {
                try {
                    removeStopNow();
                    WindowManager wm = (WindowManager) getSystemService(WINDOW_SERVICE);
                    Button button = new Button(AxonAccessibilityService.this);
                    button.setText(text);
                    button.setTextColor(0xFFFFFFFF);
                    button.setBackgroundColor(0xE6B00020);
                    button.setPadding(32, 16, 32, 16);
                    button.setOnClickListener(new View.OnClickListener() {
                        @Override
                        public void onClick(View v) {
                            stopRequested = true;
                            removeStopNow();
                        }
                    });
                    WindowManager.LayoutParams lp = new WindowManager.LayoutParams(
                            WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT,
                            WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY, WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
                            PixelFormat.TRANSLUCENT);
                    lp.gravity = Gravity.TOP | Gravity.END;
                    lp.x = 16;
                    lp.y = 160;
                    wm.addView(button, lp);
                    stopView = button;
                    shown.set(true);
                } catch (Exception e) {
                    shown.set(false);
                } finally {
                    latch.countDown();
                }
            }
        });
        try {
            latch.await(timeoutMs, TimeUnit.MILLISECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        return shown.get();
    }

    public void hideStop() {
        new Handler(Looper.getMainLooper()).post(new Runnable() {
            @Override
            public void run() {
                removeStopNow();
            }
        });
    }

    private void removeStopNow() {
        if (stopView == null) return;
        try {
            ((WindowManager) getSystemService(WINDOW_SERVICE)).removeView(stopView);
        } catch (Exception ignored) { }
        stopView = null;
    }

    // ---- recorder (only while the owner has asked for it) ----
    public static void startRecording(Set<String> blockedPackages) {
        synchronized (recorded) {
            recorded.clear();
        }
        recordBlocked = blockedPackages == null ? new HashSet<String>() : blockedPackages;
        recording = true;
    }

    public static JSONArray stopRecording() {
        recording = false;
        JSONArray out = new JSONArray();
        synchronized (recorded) {
            for (JSONObject o : recorded) out.put(o);
            recorded.clear();
        }
        return out;
    }

    // ---- gestures (coordinate tap, long press, swipe): the JS gate already judged what is under the point ----
    public static JSONObject performGesture(JSONObject req) {
        AxonAccessibilityService service = instance;
        if (service == null) return reply(false, "accessibility-service-off");
        if (stopRequested) return reply(false, "stopped-by-owner");
        if (Build.VERSION.SDK_INT < 24) return reply(false, "gestures-need-android-7");
        String kind = req.optString("kind", "");
        if (!"tap-point".equals(kind) && !"long-press-point".equals(kind) && !"swipe".equals(kind)) return reply(false, "unsupported-action");
        AccessibilityNodeInfo root = service.getRootInActiveWindow();
        if (root == null) return reply(false, "no-active-window");
        String expectedPackage = req.optString("packageName", "");
        CharSequence pkg = root.getPackageName();
        if (expectedPackage.isEmpty() || pkg == null || !expectedPackage.equals(pkg.toString())) return reply(false, "screen-changed");
        double x = req.optDouble("x", -1);
        double y = req.optDouble("y", -1);
        if (x < 0 || y < 0 || x > 10000 || y > 10000) return reply(false, "bad-point");
        Path path = new Path();
        path.moveTo((float) x, (float) y);
        long duration;
        if ("swipe".equals(kind)) {
            double x2 = req.optDouble("x2", -1);
            double y2 = req.optDouble("y2", -1);
            if (x2 < 0 || y2 < 0 || x2 > 10000 || y2 > 10000) return reply(false, "bad-point");
            path.lineTo((float) x2, (float) y2);
            duration = Math.max(100L, Math.min(3000L, req.optLong("durationMs", 400L)));
        } else if ("long-press-point".equals(kind)) {
            duration = Math.max(400L, Math.min(2000L, req.optLong("durationMs", 700L)));
        } else {
            duration = Math.max(20L, Math.min(200L, req.optLong("durationMs", 50L)));
        }
        final CountDownLatch latch = new CountDownLatch(1);
        final boolean[] completed = new boolean[1];
        boolean accepted;
        try {
            GestureDescription gesture = new GestureDescription.Builder()
                    .addStroke(new GestureDescription.StrokeDescription(path, 0, duration)).build();
            accepted = service.dispatchGesture(gesture, new GestureResultCallback() {
                @Override
                public void onCompleted(GestureDescription description) {
                    completed[0] = true;
                    latch.countDown();
                }

                @Override
                public void onCancelled(GestureDescription description) {
                    latch.countDown();
                }
            }, null);
        } catch (Exception e) {
            return reply(false, "gesture-rejected");
        }
        if (!accepted) return reply(false, "gesture-rejected");
        try {
            latch.await(duration + 2000L, TimeUnit.MILLISECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        return reply(completed[0], completed[0] ? kind : "gesture-cancelled");
    }

    // ---- executor (SI3e): payload comes from the JS action gate (confirmProposal) ----
    private static JSONObject reply(boolean ok, String code) {
        JSONObject o = new JSONObject();
        try {
            o.put("ok", ok);
            o.put("code", code);
        } catch (JSONException ignored) { }
        return o;
    }

    public static JSONObject perform(JSONObject req) {
        AxonAccessibilityService service = instance;
        if (service == null) return reply(false, "accessibility-service-off");
        if (stopRequested) return reply(false, "stopped-by-owner");
        String kind = req.optString("kind", "");
        if ("back".equals(kind)) return reply(service.performGlobalAction(GLOBAL_ACTION_BACK), "back");
        if ("home".equals(kind)) return reply(service.performGlobalAction(GLOBAL_ACTION_HOME), "home");
        AccessibilityNodeInfo root = service.getRootInActiveWindow();
        if (root == null) return reply(false, "no-active-window");
        String expectedPackage = req.optString("packageName", "");
        CharSequence pkg = root.getPackageName();
        if (expectedPackage.isEmpty() || pkg == null || !expectedPackage.equals(pkg.toString())) return reply(false, "screen-changed");
        AccessibilityNodeInfo node = findByPath(root, req.optString("path", ""));
        if (node == null) return reply(false, "element-not-found");
        if (!labelMatches(node, req.optString("label", ""))) return reply(false, "screen-changed");
        if (!node.isEnabled()) return reply(false, "element-disabled");
        if ("tap".equals(kind) || "toggle".equals(kind)) return clickNodeOrParent(node);
        if ("long-press".equals(kind)) return reply(node.performAction(AccessibilityNodeInfo.ACTION_LONG_CLICK), "long-press");
        if ("scroll".equals(kind)) {
            String direction = req.optString("direction", "down");
            boolean backward = "up".equals(direction) || "left".equals(direction);
            return reply(node.performAction(backward ? AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD : AccessibilityNodeInfo.ACTION_SCROLL_FORWARD), "scroll");
        }
        if ("type".equals(kind)) {
            if (node.isPassword()) return reply(false, "password-field");
            String text = req.optString("text", "");
            if (text.isEmpty() || text.length() > 500) return reply(false, "bad-text");
            Bundle args = new Bundle();
            args.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text);
            return reply(node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args), "type");
        }
        return reply(false, "unsupported-action");
    }

    // Same walk as toJson: path "0" is the root, "0.3.1" is the 2nd child of the 4th child; null children are skipped.
    private static AccessibilityNodeInfo findByPath(AccessibilityNodeInfo root, String path) {
        String[] parts = path.split("\\.");
        if (parts.length == 0 || !"0".equals(parts[0])) return null;
        AccessibilityNodeInfo node = root;
        for (int p = 1; p < parts.length; p++) {
            int wanted;
            try {
                wanted = Integer.parseInt(parts[p]);
            } catch (NumberFormatException e) {
                return null;
            }
            AccessibilityNodeInfo next = null;
            int seen = 0;
            for (int i = 0; i < node.getChildCount(); i++) {
                AccessibilityNodeInfo child = node.getChild(i);
                if (child == null) continue;
                if (seen == wanted) { next = child; break; }
                seen++;
            }
            if (next == null) return null;
            node = next;
        }
        return node;
    }

    private static boolean sameLabel(CharSequence value, String label) {
        return value != null && label.equals(value.toString().trim());
    }

    // The reader's label is the node's text, content description or hint (or a placeholder for hidden inputs).
    private static boolean labelMatches(AccessibilityNodeInfo node, String label) {
        String wanted = label == null ? "" : label.trim();
        if (wanted.isEmpty() || "[input]".equals(wanted) || "[password field]".equals(wanted)) return true;
        if (sameLabel(node.getText(), wanted) || sameLabel(node.getContentDescription(), wanted)) return true;
        return Build.VERSION.SDK_INT >= 26 && sameLabel(node.getHintText(), wanted);
    }

    private static JSONObject clickNodeOrParent(AccessibilityNodeInfo node) {
        AccessibilityNodeInfo target = node;
        for (int level = 0; level < 6 && target != null; level++) {
            if (target.isClickable()) return reply(target.performAction(AccessibilityNodeInfo.ACTION_CLICK), "tap");
            target = target.getParent();
        }
        return reply(false, "not-clickable");
    }

    private static JSONObject toJson(AccessibilityNodeInfo node, int depth, int[] budget) throws JSONException {
        budget[0] -= 1;
        JSONObject o = new JSONObject();
        CharSequence cls = node.getClassName();
        if (cls != null) o.put("className", cls.toString());
        boolean password = node.isPassword();
        CharSequence text = node.getText();
        if (!password && text != null) o.put("text", text.toString());
        CharSequence desc = node.getContentDescription();
        if (desc != null) o.put("contentDescription", desc.toString());
        if (Build.VERSION.SDK_INT >= 26) {
            CharSequence hint = node.getHintText();
            if (hint != null) o.put("hint", hint.toString());
        }
        String viewId = node.getViewIdResourceName();
        if (viewId != null) o.put("viewId", viewId);
        Rect r = new Rect();
        node.getBoundsInScreen(r);
        JSONObject bounds = new JSONObject();
        bounds.put("l", r.left);
        bounds.put("t", r.top);
        bounds.put("r", r.right);
        bounds.put("b", r.bottom);
        o.put("bounds", bounds);
        o.put("clickable", node.isClickable());
        o.put("longClickable", node.isLongClickable());
        o.put("scrollable", node.isScrollable());
        o.put("editable", node.isEditable());
        o.put("password", password);
        o.put("enabled", node.isEnabled());
        o.put("focused", node.isFocused());
        o.put("visible", node.isVisibleToUser());
        if (node.isCheckable()) {
            o.put("checkable", true);
            o.put("checked", node.isChecked());
        }
        JSONArray children = new JSONArray();
        int count = node.getChildCount();
        for (int i = 0; i < count && depth < MAX_DEPTH && budget[0] > 0; i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child != null) children.put(toJson(child, depth + 1, budget));
        }
        if (children.length() > 0) o.put("children", children);
        return o;
    }
}
