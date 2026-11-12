package com.axon.app.screenstructure;

import android.accessibilityservice.AccessibilityService;
import android.content.Intent;
import android.graphics.Rect;
import android.os.Build;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.accessibility.AccessibilityWindowInfo;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * READ-ONLY screen structure reader. The owner turns it on in Android Accessibility settings.
 * It never taps, types, scrolls or performs global actions (that is a later, ask-first stage),
 * and it never sends the text of a password field.
 */
public class AxonAccessibilityService extends AccessibilityService {
    private static volatile AxonAccessibilityService instance;
    private static final int MAX_DEPTH = 40;

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
    public void onAccessibilityEvent(AccessibilityEvent event) { }

    @Override
    public void onInterrupt() { }

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
