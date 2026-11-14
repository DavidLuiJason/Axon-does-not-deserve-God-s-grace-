package com.axon.app.screenstructure;

import android.accessibilityservice.AccessibilityService;
import android.content.Intent;
import android.graphics.Rect;
import android.os.Build;
import android.os.Bundle;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.accessibility.AccessibilityWindowInfo;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Screen structure reader and ACTION EXECUTOR. The owner turns it on in Android Accessibility settings.
 * It reads the screen, and it carries out ONLY actions the JS action gate already allowed or the owner approved
 * (tap, long-press, type, switch, scroll, Back, Home). It re-checks the app and the element first, never types into
 * a password field, never sends the text of a password field, and uses no screen gestures.
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
