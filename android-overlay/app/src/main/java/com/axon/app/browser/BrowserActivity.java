package com.axon.app.browser;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.Context;
import android.database.Cursor;
import android.content.Intent;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.SafeBrowsingResponse;
import android.webkit.SslErrorHandler;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceError;
import android.webkit.WebBackForwardList;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Iterator;

/**
 * First AXON Web native host. Normal tabs only; tabs share the default WebView cookie store.
 * No JavaScript interface is injected into websites. Site camera/mic/location grants are denied.
 */
public final class BrowserActivity extends Activity {
    public static final String EXTRA_URL = "com.axon.app.browser.URL";
    private static final int FILE_CHOOSER_REQUEST = 4817;
    private static volatile BrowserActivity instance;

    private static final class BrowserTab {
        WebView view;
        String url = "about:blank";
        String title = "New tab";
        boolean loading = false;
        Bundle savedState;
    }

    private final ArrayList<BrowserTab> tabs = new ArrayList<>();
    private final ArrayList<JSONObject> history = new ArrayList<>();
    private final ArrayList<JSONObject> bookmarks = new ArrayList<>();
    private final ArrayList<String> bookmarkFolders = new ArrayList<>();
    private final ArrayList<JSONObject> readingList = new ArrayList<>();
    private final ArrayList<Long> downloadIds = new ArrayList<>();
    private LinearLayout root;
    private LinearLayout toolbar;
    private FrameLayout pageFrame;
    private EditText address;
    private TextView status;
    private Button tabsButton;
    private int activeIndex = 0;
    private ValueCallback<Uri[]> uploadCallback;
    private boolean desktopSite = false;

    public static BrowserActivity getInstance() { return instance; }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        instance = this;
        loadSavedData();
        buildLayout();
        String first = getIntent().getStringExtra(EXTRA_URL);
        if (tabs.isEmpty()) createTabInternal(first == null ? "https://www.google.com" : first, false);
        else {
            ensureWebView(active());
            attachActiveTab();
        }
        updateChrome();
    }

    private int dp(float value) { return (int) (value * getResources().getDisplayMetrics().density + 0.5f); }

    private void buildLayout() {
        root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(0xFF17181B);

        LinearLayout addressRow = new LinearLayout(this);
        addressRow.setOrientation(LinearLayout.HORIZONTAL);
        addressRow.setGravity(Gravity.CENTER_VERTICAL);
        addressRow.setPadding(dp(8), dp(8), dp(8), dp(4));
        address = new EditText(this);
        address.setSingleLine(true);
        address.setTextColor(0xFFF0F0F0);
        address.setHintTextColor(0xFF9A9DA3);
        address.setHint("Search or enter website");
        address.setTextSize(14);
        address.setImeOptions(EditorInfo.IME_ACTION_GO);
        address.setSelectAllOnFocus(true);
        address.setBackgroundColor(0xFF292B30);
        address.setPadding(dp(12), dp(8), dp(12), dp(8));
        addressRow.addView(address, new LinearLayout.LayoutParams(0, dp(44), 1));
        Button go = button("Go");
        addressRow.addView(go, new LinearLayout.LayoutParams(dp(52), dp(44)));
        go.setOnClickListener(v -> navigate(address.getText().toString()));
        address.setOnEditorActionListener((v, action, event) -> {
            if (action == EditorInfo.IME_ACTION_GO || action == EditorInfo.IME_ACTION_DONE) {
                navigate(address.getText().toString()); return true;
            }
            return false;
        });
        root.addView(addressRow);

        toolbar = new LinearLayout(this);
        toolbar.setOrientation(LinearLayout.HORIZONTAL);
        toolbar.setGravity(Gravity.CENTER_VERTICAL);
        toolbar.setPadding(dp(4), dp(2), dp(4), dp(4));
        Button back = button("‹"); back.setContentDescription("Back"); back.setOnClickListener(v -> goBack()); toolbar.addView(back, weightButton());
        Button forward = button("›"); forward.setContentDescription("Forward"); forward.setOnClickListener(v -> goForward()); toolbar.addView(forward, weightButton());
        Button reload = button("↻"); reload.setContentDescription("Reload or stop"); reload.setOnClickListener(v -> { if (active().loading) stop(); else reload(); }); toolbar.addView(reload, weightButton());
        tabsButton = button("Tabs 1"); tabsButton.setOnClickListener(v -> showTabs()); toolbar.addView(tabsButton, new LinearLayout.LayoutParams(0, dp(40), 1.35f));
        Button add = button("+"); add.setContentDescription("New tab"); add.setOnClickListener(v -> newTab("https://www.google.com")); toolbar.addView(add, weightButton());
        Button menu = button("⋮"); menu.setContentDescription("Browser menu"); menu.setOnClickListener(v -> showMenu()); toolbar.addView(menu, weightButton());
        root.addView(toolbar);

        status = new TextView(this);
        status.setTextColor(0xFF9A9DA3);
        status.setTextSize(11);
        status.setPadding(dp(12), dp(2), dp(12), dp(4));
        root.addView(status);

        pageFrame = new FrameLayout(this);
        root.addView(pageFrame, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));
        setContentView(root);
    }

    private LinearLayout.LayoutParams weightButton() { return new LinearLayout.LayoutParams(0, dp(40), 1); }
    private Button button(String label) {
        Button b = new Button(this); b.setText(label); b.setTextSize(14); b.setTextColor(0xFFECECEC);
        b.setAllCaps(false); b.setMinWidth(0); b.setPadding(dp(2), 0, dp(2), 0); b.setBackgroundTintList(android.content.res.ColorStateList.valueOf(0xFF292B30));
        return b;
    }

    private BrowserTab active() { return tabs.isEmpty() ? null : tabs.get(Math.max(0, Math.min(activeIndex, tabs.size() - 1))); }

    private void createTabInternal(String url, boolean save) {
        suspendActiveTab();
        BrowserTab tab = new BrowserTab();
        tab.url = normalizeAddress(url == null ? "https://www.google.com" : url);
        tabs.add(tab); activeIndex = tabs.size() - 1;
        ensureWebView(tab);
        attachActiveTab(); updateChrome(); if (save) saveTabs();
    }

    private void createWebView(BrowserTab tab) {
        WebView web = new WebView(this);
        tab.view = web;
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadsImagesAutomatically(true);
        settings.setSupportMultipleWindows(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) settings.setSafeBrowsingEnabled(true);
        CookieManager.getInstance().setAcceptCookie(true);
        web.setBackgroundColor(0xFFFFFFFF);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl(); String scheme = uri.getScheme();
                return uri.getUserInfo() != null || !("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme));
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, String url) {
                Uri uri = Uri.parse(url); String scheme = uri.getScheme();
                return uri.getUserInfo() != null || !("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme));
            }
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                tab.url = url; tab.loading = true; if (tab == active()) updateChrome();
            }
            @Override public void onPageFinished(WebView view, String url) {
                tab.url = url; tab.title = view.getTitle() == null ? url : view.getTitle(); tab.loading = false;
                addHistory(tab.title, url); if (tab == active()) updateChrome(); saveTabs();
            }
            @Override public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) { handler.cancel(); }
            @Override public void onSafeBrowsingHit(WebView view, WebResourceRequest request, int threatType, SafeBrowsingResponse response) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) response.backToSafety(true);
                else super.onSafeBrowsingHit(view, request, threatType, response);
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) { tab.loading = false; if (tab == active()) status.setText("Page could not be loaded: " + error.getDescription()); }
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view, int progress) {
                if (tab == active()) status.setText(progress < 100 ? "Loading " + progress + "%" : safeHost(tab.url));
            }
            @Override public void onReceivedTitle(WebView view, String title) { tab.title = title == null ? tab.url : title; if (tab == active()) updateChrome(); }
            @Override public void onPermissionRequest(android.webkit.PermissionRequest request) { request.deny(); }
            @Override public void onGeolocationPermissionsShowPrompt(String origin, android.webkit.GeolocationPermissions.Callback callback) { callback.invoke(origin, false, false); }
            @Override public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (uploadCallback != null) uploadCallback.onReceiveValue(null);
                uploadCallback = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
                try { startActivityForResult(intent, FILE_CHOOSER_REQUEST); return true; }
                catch (Exception e) { uploadCallback = null; callback.onReceiveValue(null); return false; }
            }
            @Override public boolean onCreateWindow(WebView view, boolean dialog, boolean userGesture, android.os.Message resultMsg) {
                if (!userGesture) return false;
                BrowserTab next = createTabObject();
                WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                transport.setWebView(next.view); resultMsg.sendToTarget();
                return true;
            }
        });
        web.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> startDownload(url, userAgent, contentDisposition, mimeType));
    }

    /** Keep only the selected tab's renderer alive; other tabs retain navigation state only. */
    private void ensureWebView(BrowserTab tab) {
        if (tab == null || tab.view != null) return;
        createWebView(tab);
        if (tab.savedState != null) {
            WebBackForwardList restored = tab.view.restoreState(tab.savedState);
            tab.savedState = null;
            if (restored == null && tab.url != null) tab.view.loadUrl(tab.url);
            else if (tab.view.getUrl() != null) tab.url = tab.view.getUrl();
        } else if (tab.url != null && !tab.url.isEmpty()) {
            tab.view.loadUrl(tab.url);
        }
    }

    private void suspendActiveTab() {
        BrowserTab tab = active();
        if (tab == null || tab.view == null) return;
        try {
            Bundle state = new Bundle();
            tab.view.saveState(state);
            tab.savedState = state;
            if (tab.view.getUrl() != null) tab.url = tab.view.getUrl();
            if (tab.view.getTitle() != null) tab.title = tab.view.getTitle();
        } catch (Exception ignored) { }
        if (tab.view.getParent() instanceof ViewGroup) ((ViewGroup) tab.view.getParent()).removeView(tab.view);
        tab.view.stopLoading(); tab.view.onPause(); tab.view.destroy(); tab.view = null;
    }

    private BrowserTab createTabObject() {
        suspendActiveTab();
        BrowserTab tab = new BrowserTab(); tab.url = "about:blank"; tabs.add(tab); activeIndex = tabs.size() - 1;
        ensureWebView(tab); attachActiveTab(); updateChrome(); saveTabs(); return tab;
    }

    private void attachActiveTab() {
        if (pageFrame == null || tabs.isEmpty()) return;
        pageFrame.removeAllViews(); BrowserTab tab = active();
        if (tab != null) {
            ensureWebView(tab);
            if (tab.view != null) {
                if (tab.view.getParent() instanceof ViewGroup) ((ViewGroup) tab.view.getParent()).removeView(tab.view);
                pageFrame.addView(tab.view, new FrameLayout.LayoutParams(-1, -1));
                tab.view.onResume();
            }
        }
        updateChrome();
    }

    private String normalizeAddress(String raw) {
        String value = raw == null ? "" : raw.trim();
        if (value.isEmpty()) return "https://www.google.com";
        if (value.matches("(?i)^[a-z][a-z0-9+.-]*:.*") && !value.matches("(?i)^https?://.*")) return "https://www.google.com/search?q=" + encode(value);
        if (value.contains(" ") || (!value.contains(".") && !value.equalsIgnoreCase("localhost"))) return "https://www.google.com/search?q=" + encode(value);
        if (!value.matches("(?i)^https?://.*")) value = "https://" + value;
        Uri uri = Uri.parse(value);
        String scheme = uri.getScheme();
        if (uri.getUserInfo() != null) { toast("Website addresses containing embedded usernames or passwords are blocked."); return "about:blank"; }
        if (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme)) return "https://www.google.com/search?q=" + encode(raw);
        return value;
    }
    private String encode(String value) { try { return URLEncoder.encode(value, "UTF-8"); } catch (Exception e) { return value; } }
    private String safeHost(String url) { try { String host = Uri.parse(url).getHost(); return host == null ? "" : host; } catch (Exception e) { return ""; } }

    public void navigate(String raw) {
        if (active() == null) { createTabInternal(raw, true); return; }
        String url = normalizeAddress(raw); address.setText(url); hideKeyboard(); active().view.loadUrl(url); saveTabs();
    }
    public void goBack() { BrowserTab t = active(); if (t != null && t.view.canGoBack()) t.view.goBack(); }
    public void goForward() { BrowserTab t = active(); if (t != null && t.view.canGoForward()) t.view.goForward(); }
    public void reload() { BrowserTab t = active(); if (t != null) t.view.reload(); }
    public void stop() { BrowserTab t = active(); if (t != null) { t.view.stopLoading(); t.loading = false; updateChrome(); } }
    public void newTab(String url) { createTabInternal(url, true); }
    public void switchTab(int index) { if (index >= 0 && index < tabs.size() && index != activeIndex) { suspendActiveTab(); activeIndex = index; attachActiveTab(); saveTabs(); } }
    public void closeTab(int index) {
        if (index < 0 || index >= tabs.size()) return;
        BrowserTab removed = tabs.get(index);
        boolean closingActive = index == activeIndex;
        if (closingActive) suspendActiveTab();
        if (removed.view != null) { if (removed.view.getParent() instanceof ViewGroup) ((ViewGroup) removed.view.getParent()).removeView(removed.view); removed.view.stopLoading(); removed.view.destroy(); removed.view = null; }
        tabs.remove(index);
        if (tabs.isEmpty()) { activeIndex = 0; createTabInternal("https://www.google.com", false); }
        else { if (activeIndex >= tabs.size()) activeIndex = tabs.size() - 1; else if (index < activeIndex) activeIndex--; attachActiveTab(); }
        saveTabs(); updateChrome();
    }
    public void findInPage(String text) { BrowserTab t = active(); if (t != null && text != null) t.view.findAllAsync(text); }
    public void zoomBy(int delta) { BrowserTab t = active(); if (t != null) t.view.zoomBy(delta); }
    public void setDesktopSite(boolean enabled) {
        desktopSite = enabled; BrowserTab t = active(); if (t == null) return;
        String defaultAgent = WebSettings.getDefaultUserAgent(this);
        String desktopAgent = defaultAgent.replaceAll("\\s*\\(Linux; Android [^)]*\\)", " (X11; Linux x86_64)")
            .replace("Version/4.0 ", "").replace(" Mobile", "").replace("; wv", "");
        t.view.getSettings().setUserAgentString(enabled ? desktopAgent : defaultAgent);
        t.view.reload();
    }

    private void updateChrome() {
        BrowserTab t = active(); if (t == null || address == null) return;
        if (!address.hasFocus()) address.setText(t.url.startsWith("about:") ? "" : t.url);
        if (tabsButton != null) tabsButton.setText("Tabs " + tabs.size());
        if (status != null) status.setText(t.loading ? "Loading…" : (t.title == null ? safeHost(t.url) : t.title));
    }
    private void hideKeyboard() { try { ((InputMethodManager) getSystemService(INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(address.getWindowToken(), 0); address.clearFocus(); } catch (Exception ignored) {} }

    private void showTabs() {
        String[] labels = new String[tabs.size()];
        for (int i = 0; i < tabs.size(); i++) { BrowserTab t = tabs.get(i); labels[i] = (i == activeIndex ? "✓ " : "") + (t.title == null ? t.url : t.title); }
        new AlertDialog.Builder(this).setTitle("Open tabs").setItems(labels, (d, which) -> switchTab(which)).setPositiveButton("New tab", (d, w) -> newTab("https://www.google.com")).setNegativeButton("Close current", (d, w) -> closeTab(activeIndex)).show();
    }
    private void showMenu() {
        String[] actions = {"Add bookmark", "Save to reading list", "Bookmarks", "Reading list", "History", "Downloads", "Copy URL", "Share URL", "Site information", "Print page", "Save as PDF", "Create bookmark folder", "Clear history", "Find in page", "Desktop site", "Reload", "Close browser"};
        new AlertDialog.Builder(this).setTitle("Browser").setItems(actions, (d, which) -> {
            switch (which) {
                case 0: try { addBookmark(active().title, active().url); toast("Bookmark saved"); } catch (Exception e) { toast(e.getMessage()); } break;
                case 1: try { addToReadingList(active().title, active().url); toast("Saved to reading list"); } catch (Exception e) { toast(e.getMessage()); } break;
                case 2: showBookmarks(); break;
                case 3: showReadingList(); break;
                case 4: showHistory(); break;
                case 5: showDownloads(); break;
                case 6: copyCurrentUrl(); break;
                case 7: shareCurrentUrl(); break;
                case 8: showSiteInfo(); break;
                case 9: printCurrentPage(false); break;
                case 10: printCurrentPage(true); break;
                case 11: showCreateBookmarkFolderDialog(); break;
                case 12: showClearHistoryDialog(); break;
                case 13: showFindDialog(); break;
                case 14: setDesktopSite(!desktopSite); toast(desktopSite ? "Desktop site requested" : "Mobile site requested"); break;
                case 15: reload(); break;
                case 16: finish(); break;
            }
        }).show();
    }
    private void showFindDialog() {
        EditText input = new EditText(this); input.setSingleLine(true); input.setHint("Find on page");
        new AlertDialog.Builder(this).setTitle("Find in page").setView(input).setPositiveButton("Find", (d, w) -> findInPage(input.getText().toString())).setNegativeButton("Cancel", null).show();
    }
    private void showBookmarks() {
        if (bookmarks.isEmpty()) {
            new AlertDialog.Builder(this).setTitle("Bookmarks").setMessage("No bookmarks saved yet.").setPositiveButton("Bookmark this page", (d, w) -> { try { addBookmark(active().title, active().url); toast("Bookmark saved"); } catch (Exception e) { toast(e.getMessage()); } }).setNegativeButton("Close", null).show();
            return;
        }
        String[] labels = new String[bookmarks.size()];
        for (int i=0;i<bookmarks.size();i++) {
            JSONObject item = bookmarks.get(i); String folder = item.optString("folder", "");
            labels[i] = (folder.isEmpty() ? "" : "[" + folder + "] ") + item.optString("title", item.optString("url"));
        }
        new AlertDialog.Builder(this).setTitle("Bookmarks").setItems(labels, (d, which) -> showBookmarkOptions(which)).setPositiveButton("New folder", (d, w) -> showCreateBookmarkFolderDialog()).setNegativeButton("Close", null).show();
    }
    private void showBookmarkOptions(int index) {
        if (index < 0 || index >= bookmarks.size()) return;
        String[] actions = {"Open", "Edit", "Move to folder", "Remove"};
        new AlertDialog.Builder(this).setTitle(bookmarks.get(index).optString("title", "Bookmark")).setItems(actions, (d, which) -> {
            if (which == 0) navigate(bookmarks.get(index).optString("url"));
            else if (which == 1) showEditBookmarkDialog(index);
            else if (which == 2) showMoveBookmarkDialog(index);
            else if (which == 3) new AlertDialog.Builder(this).setMessage("Remove this bookmark?").setPositiveButton("Remove", (confirm, w) -> { removeBookmark(index); showBookmarks(); }).setNegativeButton("Cancel", null).show();
        }).show();
    }
    private void showEditBookmarkDialog(int index) {
        if (index < 0 || index >= bookmarks.size()) return;
        JSONObject item = bookmarks.get(index);
        LinearLayout form = new LinearLayout(this); form.setOrientation(LinearLayout.VERTICAL); form.setPadding(dp(20), dp(8), dp(20), 0);
        EditText title = new EditText(this); title.setSingleLine(true); title.setHint("Bookmark name"); title.setText(item.optString("title"));
        EditText url = new EditText(this); url.setSingleLine(true); url.setHint("https://website.example"); url.setText(item.optString("url"));
        form.addView(title); form.addView(url);
        new AlertDialog.Builder(this).setTitle("Edit bookmark").setView(form).setPositiveButton("Save", (d, w) -> { try { editBookmark(index, title.getText().toString(), url.getText().toString()); toast("Bookmark updated"); } catch (Exception e) { toast(e.getMessage()); } }).setNegativeButton("Cancel", null).show();
    }
    private void showMoveBookmarkDialog(int index) {
        if (index < 0 || index >= bookmarks.size()) return;
        String[] folders = new String[bookmarkFolders.size() + 1]; folders[0] = "No folder";
        for (int i=0;i<bookmarkFolders.size();i++) folders[i + 1] = bookmarkFolders.get(i);
        new AlertDialog.Builder(this).setTitle("Move bookmark").setItems(folders, (d, which) -> { try { moveBookmark(index, which == 0 ? "" : folders[which]); toast("Bookmark moved"); } catch (Exception e) { toast(e.getMessage()); } }).setNegativeButton("Cancel", null).show();
    }
    private void showCreateBookmarkFolderDialog() {
        EditText input = new EditText(this); input.setSingleLine(true); input.setHint("Folder name");
        new AlertDialog.Builder(this).setTitle("Create bookmark folder").setView(input).setPositiveButton("Create", (d, w) -> { try { createBookmarkFolder(input.getText().toString()); toast("Folder created"); } catch (Exception e) { toast(e.getMessage()); } }).setNegativeButton("Cancel", null).show();
    }
    private void showReadingList() {
        if (readingList.isEmpty()) { new AlertDialog.Builder(this).setTitle("Reading list").setMessage("No pages saved for later.").setPositiveButton("Close", null).show(); return; }
        String[] labels = new String[readingList.size()];
        for (int i=0;i<readingList.size();i++) labels[i] = (readingList.get(i).optBoolean("read", false) ? "✓ " : "○ ") + readingList.get(i).optString("title", readingList.get(i).optString("url"));
        new AlertDialog.Builder(this).setTitle("Reading list").setItems(labels, (d, which) -> showReadingListItemOptions(which)).setNegativeButton("Close", null).show();
    }
    private void showReadingListItemOptions(int index) {
        if (index < 0 || index >= readingList.size()) return;
        boolean read = readingList.get(index).optBoolean("read", false);
        String[] actions = {"Open", read ? "Mark as unread" : "Mark as read", "Remove"};
        new AlertDialog.Builder(this).setTitle(readingList.get(index).optString("title", "Saved page")).setItems(actions, (d, which) -> {
            if (which == 0) openReadingListItem(index);
            else if (which == 1) { markReadingListRead(index, !read); showReadingList(); }
            else if (which == 2) new AlertDialog.Builder(this).setMessage("Remove this saved page?").setPositiveButton("Remove", (confirm, w) -> { removeReadingListItem(index); showReadingList(); }).setNegativeButton("Cancel", null).show();
        }).show();
    }
    private void showHistory() {
        if (history.isEmpty()) { new AlertDialog.Builder(this).setTitle("Recent history").setMessage("No browsing history is available.").setPositiveButton("Close", null).show(); return; }
        String[] labels = new String[history.size()]; for (int i=0;i<history.size();i++) labels[i] = history.get(i).optString("title", history.get(i).optString("url"));
        new AlertDialog.Builder(this).setTitle("Recent history").setItems(labels, (d, which) -> navigate(history.get(which).optString("url"))).setPositiveButton("Clear all", (d, w) -> showClearHistoryDialog()).setNeutralButton("Clear by site", (d, w) -> showClearHistoryBySiteDialog()).setNegativeButton("Close", null).show();
    }
    private void showDownloads() {
        JSONArray downloads = getDownloads();
        if (downloads.length() == 0) { new AlertDialog.Builder(this).setTitle("Downloads").setMessage("No AXON Web downloads are recorded.").setPositiveButton("Close", null).show(); return; }
        String[] labels = new String[downloads.length()];
        for (int i=0;i<downloads.length();i++) {
            JSONObject item = downloads.optJSONObject(i);
            labels[i] = (item == null ? "Download" : item.optString("title", "Download")) + " — " + (item == null ? "UNKNOWN" : item.optString("status", "UNKNOWN"));
        }
        new AlertDialog.Builder(this).setTitle("Downloads").setItems(labels, (d, which) -> showDownloadOptions(which, downloads.optJSONObject(which))).setNegativeButton("Close", null).show();
    }
    private void showDownloadOptions(int index, JSONObject item) {
        if (item == null) return;
        boolean complete = "SUCCESSFUL".equals(item.optString("status"));
        String[] actions = complete ? new String[]{"Open", "Share", "Delete"} : new String[]{"Cancel download", "Remove record"};
        new AlertDialog.Builder(this).setTitle(item.optString("title", "Download")).setItems(actions, (d, which) -> {
            try {
                String downloadId = item.optString("id", "");
                if (complete && which == 0) openDownload(downloadId);
                else if (complete && which == 1) shareDownload(downloadId);
                else if (complete && which == 2) deleteDownload(downloadId);
                else if (!complete && which == 0) cancelDownload(downloadId);
                else if (!complete && which == 1) deleteDownload(downloadId);
                showDownloads();
            } catch (Exception e) { toast(e.getMessage()); }
        }).show();
    }
    private void showSiteInfo() {
        JSONObject security = getSecurityDetails(); JSONObject permissions = getSitePermissions();
        String message = "Address: " + security.optString("url", "") + "\nScheme: " + security.optString("scheme", "UNKNOWN")
            + "\nHost: " + security.optString("host", "UNKNOWN")
            + "\nCertificate available: " + security.optBoolean("certificatePresent", false)
            + "\nCertificate subject: " + security.optString("subject", "Not exposed by this WebView")
            + "\nCertificate issuer: " + security.optString("issuer", "Not exposed by this WebView")
            + "\n\nSite permissions (fixed browser policy): " + permissions.optString("summary", "Camera, microphone and location are blocked.");
        new AlertDialog.Builder(this).setTitle("Site information").setMessage(message).setPositiveButton("Close", null).show();
    }
    private void showClearHistoryDialog() {
        new AlertDialog.Builder(this).setTitle("Clear browsing history").setMessage("Remove all saved history entries from AXON Web?").setPositiveButton("Clear", (d, w) -> { clearHistory(); toast("History cleared"); }).setNegativeButton("Cancel", null).show();
    }
    private void showClearHistoryBySiteDialog() {
        EditText input = new EditText(this); input.setSingleLine(true); input.setHint("example.com");
        new AlertDialog.Builder(this).setTitle("Clear history for a site").setView(input).setPositiveButton("Clear", (d, w) -> { try { clearHistoryBySite(input.getText().toString()); toast("Site history cleared"); } catch (Exception e) { toast(e.getMessage()); } }).setNegativeButton("Cancel", null).show();
    }
    private void toast(String message) { Toast.makeText(this, message, Toast.LENGTH_SHORT).show(); }

    private void startDownload(String url, String userAgent, String disposition, String mimeType) {
        try {
            String fileName = URLUtil.guessFileName(url, disposition, mimeType);
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            request.setMimeType(mimeType); request.addRequestHeader("User-Agent", userAgent);
            String cookie = CookieManager.getInstance().getCookie(url); if (cookie != null) request.addRequestHeader("Cookie", cookie);
            request.setTitle(fileName); request.setDescription("Downloading with AXON Web");
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "Axon/" + fileName);
            long downloadId = ((DownloadManager) getSystemService(DOWNLOAD_SERVICE)).enqueue(request);
            downloadIds.add(downloadId); saveDownloadIds();
            toast("Download started: " + fileName);
        } catch (Exception e) { toast("Download could not start: " + e.getMessage()); }
    }

    private void addHistory(String title, String url) {
        if (url == null || !url.startsWith("http")) return;
        try { JSONObject row = new JSONObject(); row.put("title", title == null ? url : title); row.put("url", url); row.put("visitedAt", System.currentTimeMillis()); history.add(0, row); while (history.size() > 500) history.remove(history.size()-1); saveJson("history", history); } catch (JSONException ignored) {}
    }
    private boolean isHttpUrl(String url) {
        if (url == null) return false;
        Uri parsed = Uri.parse(url);
        String scheme = parsed.getScheme();
        return parsed.getHost() != null && ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)) && parsed.getUserInfo() == null;
    }
    public void addBookmark(String title, String url) {
        if (!isHttpUrl(url)) throw new IllegalArgumentException("Only valid HTTP(S) page addresses can be bookmarked.");
        for (Iterator<JSONObject> it = bookmarks.iterator(); it.hasNext();) if (url.equals(it.next().optString("url"))) it.remove();
        try { JSONObject row = new JSONObject(); row.put("title", title == null || title.trim().isEmpty() ? url : title.trim()); row.put("url", url); row.put("addedAt", System.currentTimeMillis()); row.put("folder", ""); bookmarks.add(0, row); saveJson("bookmarks", bookmarks); } catch (JSONException ignored) {}
    }
    public void editBookmark(int index, String title, String url) {
        if (index < 0 || index >= bookmarks.size()) throw new IllegalArgumentException("Bookmark index is out of range.");
        if (!isHttpUrl(url)) throw new IllegalArgumentException("Only valid HTTP(S) page addresses can be bookmarked.");
        JSONObject old = bookmarks.get(index);
        for (int i = bookmarks.size() - 1; i >= 0; i--) if (i != index && url.equals(bookmarks.get(i).optString("url"))) bookmarks.remove(i);
        try { old.put("title", title == null || title.trim().isEmpty() ? url : title.trim()); old.put("url", url); saveJson("bookmarks", bookmarks); } catch (JSONException ignored) {}
    }
    public void removeBookmark(int index) {
        if (index < 0 || index >= bookmarks.size()) throw new IllegalArgumentException("Bookmark index is out of range.");
        bookmarks.remove(index); saveJson("bookmarks", bookmarks);
    }
    public void createBookmarkFolder(String name) {
        String clean = name == null ? "" : name.trim();
        if (clean.isEmpty() || clean.length() > 48) throw new IllegalArgumentException("Folder name must contain 1 to 48 characters.");
        for (String item : bookmarkFolders) if (item.equalsIgnoreCase(clean)) return;
        bookmarkFolders.add(clean); saveBookmarkFolders();
    }
    public void moveBookmark(int index, String folder) {
        if (index < 0 || index >= bookmarks.size()) throw new IllegalArgumentException("Bookmark index is out of range.");
        String target = folder == null ? "" : folder.trim();
        if (!target.isEmpty()) {
            boolean exists = false; for (String item : bookmarkFolders) if (item.equals(target)) { exists = true; break; }
            if (!exists) throw new IllegalArgumentException("The destination bookmark folder does not exist.");
        }
        try { bookmarks.get(index).put("folder", target); saveJson("bookmarks", bookmarks); } catch (JSONException ignored) {}
    }
    public JSONArray getBookmarks() { return new JSONArray(bookmarks); }
    public JSONArray getBookmarkFolders() { JSONArray out = new JSONArray(); for (String folder : bookmarkFolders) out.put(folder); return out; }
    private void saveBookmarkFolders() { JSONArray out = new JSONArray(); for (String folder : bookmarkFolders) out.put(folder); getSharedPreferences("axon_web_normal", MODE_PRIVATE).edit().putString("bookmarkFolders", out.toString()).apply(); }
    public JSONArray getHistory(String query) {
        JSONArray out = new JSONArray(); String q = query == null ? "" : query.toLowerCase();
        for (JSONObject row : history) if (row.optString("url").toLowerCase().contains(q) || row.optString("title").toLowerCase().contains(q)) out.put(row);
        return out;
    }
    public void clearHistory() { history.clear(); saveJson("history", history); for (BrowserTab tab : tabs) if (tab.view != null) tab.view.clearHistory(); }
    public void clearHistoryBySite(String host) {
        String target = host == null ? "" : host.trim().toLowerCase();
        if (target.isEmpty() || target.contains("/") || target.contains(":")) throw new IllegalArgumentException("A site host is required.");
        for (Iterator<JSONObject> it = history.iterator(); it.hasNext();) {
            String found = Uri.parse(it.next().optString("url")).getHost();
            if (found != null) { found = found.toLowerCase(); if (found.equals(target) || found.endsWith("." + target)) it.remove(); }
        }
        saveJson("history", history);
    }
    public void addToReadingList(String title, String url) {
        if (!isHttpUrl(url)) throw new IllegalArgumentException("Only valid HTTP(S) page addresses can be saved.");
        for (JSONObject item : readingList) if (url.equals(item.optString("url"))) { try { item.put("title", title == null || title.trim().isEmpty() ? url : title.trim()); } catch (JSONException ignored) {} saveJson("readingList", readingList); return; }
        try { JSONObject row = new JSONObject(); row.put("title", title == null || title.trim().isEmpty() ? url : title.trim()); row.put("url", url); row.put("addedAt", System.currentTimeMillis()); row.put("read", false); readingList.add(0, row); saveJson("readingList", readingList); } catch (JSONException ignored) {}
    }
    public void removeReadingListItem(int index) {
        if (index < 0 || index >= readingList.size()) throw new IllegalArgumentException("Reading-list index is out of range.");
        readingList.remove(index); saveJson("readingList", readingList);
    }
    public void markReadingListRead(int index, boolean read) {
        if (index < 0 || index >= readingList.size()) throw new IllegalArgumentException("Reading-list index is out of range.");
        try { readingList.get(index).put("read", read); saveJson("readingList", readingList); } catch (JSONException ignored) {}
    }
    public JSONArray getReadingList() { return new JSONArray(readingList); }
    public void openReadingListItem(int index) {
        if (index < 0 || index >= readingList.size()) throw new IllegalArgumentException("Reading-list index is out of range.");
        navigate(readingList.get(index).optString("url"));
    }
    private DownloadManager downloadManager() { return (DownloadManager) getSystemService(DOWNLOAD_SERVICE); }
    public JSONArray getDownloads() {
        JSONArray out = new JSONArray(); DownloadManager manager = downloadManager();
        for (Long id : new ArrayList<>(downloadIds)) {
            Cursor cursor = null;
            try {
                cursor = manager.query(new DownloadManager.Query().setFilterById(id));
                if (cursor == null || !cursor.moveToFirst()) continue;
                int statusCode = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
                int reason = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON));
                String statusText = statusCode == DownloadManager.STATUS_SUCCESSFUL ? "SUCCESSFUL"
                    : statusCode == DownloadManager.STATUS_FAILED ? "FAILED"
                    : statusCode == DownloadManager.STATUS_PAUSED ? "PAUSED" : "RUNNING";
                JSONObject row = new JSONObject();
                row.put("id", String.valueOf(id));
                row.put("title", cursor.getString(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TITLE)));
                row.put("status", statusText); row.put("reason", reason);
                row.put("mimeType", manager.getMimeTypeForDownloadedFile(id));
                row.put("downloadedBytes", cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)));
                row.put("totalBytes", cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES)));
                Uri file = manager.getUriForDownloadedFile(id); row.put("uri", file == null ? "" : file.toString());
                out.put(row);
            } catch (Exception ignored) {
                // Missing DownloadManager rows are omitted instead of fabricated as complete.
            } finally { if (cursor != null) cursor.close(); }
        }
        return out;
    }
    public void openDownload(String rawId) {
        long id = parseDownloadId(rawId); Uri uri = downloadManager().getUriForDownloadedFile(id);
        if (uri == null) throw new IllegalStateException("This download is not complete or its file is unavailable.");
        String mime = downloadManager().getMimeTypeForDownloadedFile(id); if (mime == null || mime.trim().isEmpty()) mime = "*/*";
        Intent intent = new Intent(Intent.ACTION_VIEW); intent.setDataAndType(uri, mime); intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        startActivity(intent);
    }
    public void shareDownload(String rawId) {
        long id = parseDownloadId(rawId); Uri uri = downloadManager().getUriForDownloadedFile(id);
        if (uri == null) throw new IllegalStateException("This download is not complete or its file is unavailable.");
        String mime = downloadManager().getMimeTypeForDownloadedFile(id); if (mime == null || mime.trim().isEmpty()) mime = "*/*";
        Intent intent = new Intent(Intent.ACTION_SEND); intent.setType(mime); intent.putExtra(Intent.EXTRA_STREAM, uri); intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        startActivity(Intent.createChooser(intent, "Share download"));
    }
    public void cancelDownload(String rawId) { removeDownload(rawId); }
    public void deleteDownload(String rawId) { removeDownload(rawId); }
    private long parseDownloadId(String rawId) {
        try {
            long id = Long.parseLong(rawId);
            if (!downloadIds.contains(id)) throw new IllegalArgumentException("This download is not in the AXON Web download list.");
            return id;
        } catch (NumberFormatException error) {
            throw new IllegalArgumentException("A valid download ID is required.");
        }
    }
    private void removeDownload(String rawId) {
        long id = parseDownloadId(rawId); downloadManager().remove(id); downloadIds.remove(id); saveDownloadIds();
    }
    private void saveDownloadIds() {
        JSONArray out = new JSONArray(); for (Long id : downloadIds) out.put(id);
        getSharedPreferences("axon_web_normal", MODE_PRIVATE).edit().putString("downloads", out.toString()).apply();
    }
    public void copyCurrentUrl() {
        BrowserTab tab = active(); if (tab == null || !isHttpUrl(tab.url)) throw new IllegalStateException("There is no website address to copy.");
        android.content.ClipboardManager clipboard = (android.content.ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
        clipboard.setPrimaryClip(android.content.ClipData.newPlainText("AXON Web address", tab.url)); toast("Address copied");
    }
    public void shareCurrentUrl() {
        BrowserTab tab = active(); if (tab == null || !isHttpUrl(tab.url)) throw new IllegalStateException("There is no website address to share.");
        Intent intent = new Intent(Intent.ACTION_SEND); intent.setType("text/plain"); intent.putExtra(Intent.EXTRA_TEXT, tab.url);
        startActivity(Intent.createChooser(intent, "Share page"));
    }
    public void printCurrentPage(boolean savePdf) {
        BrowserTab tab = active(); if (tab == null || tab.view == null) throw new IllegalStateException("There is no page to print.");
        android.print.PrintManager manager = (android.print.PrintManager) getSystemService(PRINT_SERVICE);
        String title = tab.title == null || tab.title.trim().isEmpty() ? safeHost(tab.url) : tab.title;
        String jobName = (savePdf ? "Save PDF - " : "Print - ") + title;
        manager.print(jobName, tab.view.createPrintDocumentAdapter(jobName), new android.print.PrintAttributes.Builder()
            .setMediaSize(android.print.PrintAttributes.MediaSize.ISO_A4).build());
        if (savePdf) toast("Choose Save as PDF in the Android print options.");
    }
    public JSONObject getSecurityDetails() {
        JSONObject out = new JSONObject(); BrowserTab tab = active();
        if (tab == null) return out;
        Uri uri = Uri.parse(tab.url); String scheme = uri.getScheme();
        try {
            out.put("url", tab.url); out.put("scheme", scheme == null ? "UNKNOWN" : scheme.toUpperCase());
            out.put("host", uri.getHost() == null ? "" : uri.getHost());
            android.net.http.SslCertificate cert = tab.view == null ? null : tab.view.getCertificate();
            out.put("certificatePresent", cert != null);
            out.put("subject", cert == null || cert.getIssuedTo() == null ? "" : cert.getIssuedTo().getDName());
            out.put("issuer", cert == null || cert.getIssuedBy() == null ? "" : cert.getIssuedBy().getDName());
        } catch (JSONException ignored) { }
        return out;
    }
    public JSONObject getSitePermissions() {
        JSONObject out = new JSONObject(); BrowserTab tab = active();
        try {
            String origin = "";
            if (tab != null) { Uri uri = Uri.parse(tab.url); origin = uri.getScheme() + "://" + uri.getHost(); }
            JSONArray permissions = new JSONArray();
            for (String name : new String[]{"camera", "microphone", "geolocation"}) {
                JSONObject item = new JSONObject(); item.put("name", name); item.put("state", "BLOCKED"); permissions.put(item);
            }
            out.put("origin", origin); out.put("permissions", permissions); out.put("summary", "Camera, microphone and geolocation are denied by the current browser host.");
        } catch (JSONException ignored) { }
        return out;
    }
    public JSONObject getState() {
        JSONObject out = new JSONObject(); BrowserTab t = active();
        try { out.put("available", true); out.put("tabCount", tabs.size()); out.put("activeIndex", activeIndex); out.put("url", t == null ? "" : t.url); out.put("title", t == null ? "" : t.title); out.put("loading", t != null && t.loading); out.put("canGoBack", t != null && t.view.canGoBack()); out.put("canGoForward", t != null && t.view.canGoForward()); out.put("engine", "android-system-webview"); out.put("incognito", false); } catch (JSONException ignored) {}
        return out;
    }
    public void getPageText(ValueCallback<String> callback) {
        BrowserTab t = active(); if (t == null) { callback.onReceiveValue(""); return; }
        t.view.evaluateJavascript("(function(){return (document.body && document.body.innerText || '').slice(0,50000)})()", value -> {
            String decoded = value == null ? "" : value;
            try { Object parsed = new org.json.JSONTokener(decoded).nextValue(); if (parsed instanceof String) decoded = (String) parsed; }
            catch (Exception ignored) { }
            callback.onReceiveValue(decoded);
        });
    }

    private void loadSavedData() {
        android.content.SharedPreferences prefs = getSharedPreferences("axon_web_normal", MODE_PRIVATE);
        try {
            JSONArray savedTabs = new JSONArray(prefs.getString("tabs", "[]")); activeIndex = prefs.getInt("active", 0);
            for (int i=0;i<savedTabs.length();i++) { JSONObject item=savedTabs.optJSONObject(i); BrowserTab t=new BrowserTab(); t.url=item==null?"https://www.google.com":item.optString("url","https://www.google.com"); t.title=item==null?t.url:item.optString("title",t.url); tabs.add(t); }
            JSONArray savedHistory = new JSONArray(prefs.getString("history", "[]")); for(int i=0;i<savedHistory.length();i++) history.add(savedHistory.getJSONObject(i));
            JSONArray savedBookmarks = new JSONArray(prefs.getString("bookmarks", "[]")); for(int i=0;i<savedBookmarks.length();i++) bookmarks.add(savedBookmarks.getJSONObject(i));
            JSONArray savedFolders = new JSONArray(prefs.getString("bookmarkFolders", "[]")); for(int i=0;i<savedFolders.length();i++) bookmarkFolders.add(savedFolders.getString(i));
            JSONArray savedReading = new JSONArray(prefs.getString("readingList", "[]")); for(int i=0;i<savedReading.length();i++) readingList.add(savedReading.getJSONObject(i));
            JSONArray savedDownloads = new JSONArray(prefs.getString("downloads", "[]")); for(int i=0;i<savedDownloads.length();i++) downloadIds.add(savedDownloads.getLong(i));
        } catch (Exception ignored) { tabs.clear(); history.clear(); bookmarks.clear(); bookmarkFolders.clear(); readingList.clear(); downloadIds.clear(); }
        if (activeIndex < 0 || activeIndex >= tabs.size()) activeIndex = 0;
    }
    private void saveTabs() {
        JSONArray array = new JSONArray();
        for (BrowserTab t : tabs) { JSONObject item = new JSONObject(); try { item.put("url", t.url); item.put("title", t.title); array.put(item); } catch (JSONException ignored) {} }
        getSharedPreferences("axon_web_normal", MODE_PRIVATE).edit().putString("tabs", array.toString()).putInt("active", activeIndex).apply();
    }
    private void saveJson(String key, ArrayList<JSONObject> rows) { JSONArray array = new JSONArray(rows); getSharedPreferences("axon_web_normal", MODE_PRIVATE).edit().putString(key, array.toString()).apply(); }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_REQUEST && uploadCallback != null) {
            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null) {
                if (data.getClipData() != null) { int count=data.getClipData().getItemCount(); results=new Uri[count]; for(int i=0;i<count;i++) results[i]=data.getClipData().getItemAt(i).getUri(); }
                else if (data.getData() != null) results = new Uri[]{data.getData()};
            }
            uploadCallback.onReceiveValue(results); uploadCallback = null;
        }
    }
    @Override public void onBackPressed() { BrowserTab t=active(); if(t!=null && t.view.canGoBack()) t.view.goBack(); else finish(); }
    @Override protected void onPause() { super.onPause(); BrowserTab t=active(); if(t!=null && t.view!=null) t.view.onPause(); saveTabs(); }
    @Override protected void onResume() { super.onResume(); BrowserTab t=active(); if(t!=null && t.view!=null) t.view.onResume(); }
    @Override protected void onDestroy() {
        saveTabs(); for(BrowserTab t:tabs) if(t.view!=null) { if(t.view.getParent() instanceof ViewGroup) ((ViewGroup)t.view.getParent()).removeView(t.view); t.view.stopLoading(); t.view.destroy(); }
        tabs.clear(); if(instance==this) instance=null; super.onDestroy();
    }
}
