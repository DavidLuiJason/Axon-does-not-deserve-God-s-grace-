package com.axon.app.browser;

import android.content.Intent;
import android.webkit.ValueCallback;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(name = "AxonBrowser")
public final class BrowserPlugin extends Plugin {
    @PluginMethod public void open(PluginCall call) {
        String url = call.getString("url", "https://www.google.com");
        BrowserActivity existing = BrowserActivity.getInstance();
        if (existing != null) {
            existing.runOnUiThread(() -> { existing.navigate(url); JSObject out = new JSObject(); out.put("opened", true); out.put("url", url); call.resolve(out); });
            return;
        }
        Intent intent = new Intent(getContext(), BrowserActivity.class);
        intent.putExtra(BrowserActivity.EXTRA_URL, url);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
            JSObject out = new JSObject(); out.put("opened", true); out.put("url", url); call.resolve(out);
        } catch (Exception e) { call.reject("AXON Web could not open: " + e.getMessage(), e); }
    }
    @PluginMethod public void navigate(PluginCall call) { String url=call.getString("url"); if(url==null||url.trim().isEmpty()){call.reject("url is required");return;} BrowserActivity a=BrowserActivity.getInstance(); if(a==null){call.reject("AXON Web is not open; call open() first");return;} a.runOnUiThread(()->{a.navigate(url);call.resolve(js(a.getState()));}); }
    @PluginMethod public void back(PluginCall call) { withActivity(call, a -> {a.goBack();call.resolve(js(a.getState()));}); }
    @PluginMethod public void forward(PluginCall call) { withActivity(call, a -> {a.goForward();call.resolve(js(a.getState()));}); }
    @PluginMethod public void reload(PluginCall call) { withActivity(call, a -> {a.reload();call.resolve(js(a.getState()));}); }
    @PluginMethod public void stop(PluginCall call) { withActivity(call, a -> {a.stop();call.resolve(js(a.getState()));}); }
    @PluginMethod public void newTab(PluginCall call) { String url=call.getString("url","https://www.google.com"); withActivity(call, a -> {a.newTab(url);call.resolve(js(a.getState()));}); }
    @PluginMethod public void switchTab(PluginCall call) { int index=call.getInt("index",-1); withActivity(call, a -> {a.switchTab(index);call.resolve(js(a.getState()));}); }
    @PluginMethod public void closeTab(PluginCall call) { int index=call.getInt("index",-1); withActivity(call, a -> {a.closeTab(index);call.resolve(js(a.getState()));}); }
    @PluginMethod public void getState(PluginCall call) { withActivity(call, a -> call.resolve(js(a.getState()))); }
    @PluginMethod public void getPageText(PluginCall call) { withActivity(call, a -> a.getPageText(text -> {JSObject out=new JSObject();out.put("text",text);call.resolve(out);})); }
    @PluginMethod public void findInPage(PluginCall call) { String text=call.getString("text"); if(text==null){call.reject("text is required");return;} withActivity(call, a->{a.findInPage(text);call.resolve();}); }
    @PluginMethod public void zoomBy(PluginCall call) { int delta=call.getInt("delta",0); withActivity(call,a->{a.zoomBy(delta);call.resolve();}); }
    @PluginMethod public void setDesktopSite(PluginCall call) { boolean enabled=call.getBoolean("enabled",false); withActivity(call,a->{a.setDesktopSite(enabled);call.resolve(js(a.getState()));}); }
    @PluginMethod public void addBookmark(PluginCall call) { String title=call.getString("title");String url=call.getString("url");if(url==null){call.reject("url is required");return;}withActivity(call,a->{a.addBookmark(title,url);call.resolve();}); }
    @PluginMethod public void editBookmark(PluginCall call) { int index=call.getInt("index",-1);String title=call.getString("title");String url=call.getString("url");withActivity(call,a->{a.editBookmark(index,title,url);call.resolve();}); }
    @PluginMethod public void removeBookmark(PluginCall call) { int index=call.getInt("index",-1);withActivity(call,a->{a.removeBookmark(index);call.resolve();}); }
    @PluginMethod public void createBookmarkFolder(PluginCall call) { String name=call.getString("name");withActivity(call,a->{a.createBookmarkFolder(name);call.resolve();}); }
    @PluginMethod public void moveBookmark(PluginCall call) { int index=call.getInt("index",-1);String folder=call.getString("folder","");withActivity(call,a->{a.moveBookmark(index,folder);call.resolve();}); }
    @PluginMethod public void listBookmarks(PluginCall call) { withActivity(call,a->{JSObject out=new JSObject();out.put("items",a.getBookmarks());out.put("folders",a.getBookmarkFolders());call.resolve(out);}); }
    @PluginMethod public void searchHistory(PluginCall call) { String query=call.getString("query","");withActivity(call,a->{JSObject out=new JSObject();out.put("items",a.getHistory(query));call.resolve(out);}); }
    @PluginMethod public void clearHistory(PluginCall call) { withActivity(call,a->{a.clearHistory();call.resolve();}); }
    @PluginMethod public void clearHistoryBySite(PluginCall call) { String host=call.getString("host");withActivity(call,a->{a.clearHistoryBySite(host);call.resolve();}); }
    @PluginMethod public void addToReadingList(PluginCall call) { String title=call.getString("title");String url=call.getString("url");withActivity(call,a->{a.addToReadingList(title,url);call.resolve();}); }
    @PluginMethod public void removeReadingListItem(PluginCall call) { int index=call.getInt("index",-1);withActivity(call,a->{a.removeReadingListItem(index);call.resolve();}); }
    @PluginMethod public void openReadingListItem(PluginCall call) { int index=call.getInt("index",-1);withActivity(call,a->{a.openReadingListItem(index);call.resolve(js(a.getState()));}); }
    @PluginMethod public void markReadingListRead(PluginCall call) { int index=call.getInt("index",-1);boolean read=call.getBoolean("read",true);withActivity(call,a->{a.markReadingListRead(index,read);call.resolve();}); }
    @PluginMethod public void listReadingList(PluginCall call) { withActivity(call,a->{JSObject out=new JSObject();out.put("items",a.getReadingList());call.resolve(out);}); }
    @PluginMethod public void listDownloads(PluginCall call) { withActivity(call,a->{JSObject out=new JSObject();out.put("items",a.getDownloads());call.resolve(out);}); }
    @PluginMethod public void openDownload(PluginCall call) { String id=call.getString("id");withActivity(call,a->{a.openDownload(id);call.resolve();}); }
    @PluginMethod public void shareDownload(PluginCall call) { String id=call.getString("id");withActivity(call,a->{a.shareDownload(id);call.resolve();}); }
    @PluginMethod public void cancelDownload(PluginCall call) { String id=call.getString("id");withActivity(call,a->{a.cancelDownload(id);call.resolve();}); }
    @PluginMethod public void deleteDownload(PluginCall call) { String id=call.getString("id");withActivity(call,a->{a.deleteDownload(id);call.resolve();}); }
    @PluginMethod public void copyCurrentUrl(PluginCall call) { withActivity(call,a->{a.copyCurrentUrl();call.resolve();}); }
    @PluginMethod public void shareCurrentUrl(PluginCall call) { withActivity(call,a->{a.shareCurrentUrl();call.resolve();}); }
    @PluginMethod public void printPage(PluginCall call) { withActivity(call,a->{a.printCurrentPage(false);call.resolve();}); }
    @PluginMethod public void savePagePdf(PluginCall call) { withActivity(call,a->{a.printCurrentPage(true);call.resolve();}); }
    @PluginMethod public void getSecurityDetails(PluginCall call) { withActivity(call,a->call.resolve(js(a.getSecurityDetails()))); }
    @PluginMethod public void getSitePermissions(PluginCall call) { withActivity(call,a->call.resolve(js(a.getSitePermissions()))); }
    private interface Action { void run(BrowserActivity activity); }
    private static JSObject js(JSONObject o) {
        try { return o == null ? new JSObject() : new JSObject(o.toString()); }
        catch (JSONException e) { return new JSObject(); }
    }

    private void withActivity(PluginCall call, Action action) {
        BrowserActivity activity=BrowserActivity.getInstance();
        if(activity==null){call.reject("AXON Web is not open");return;}
        activity.runOnUiThread(()->{try{action.run(activity);}catch(Exception e){call.reject("Browser action failed: "+e.getMessage(),e);}});
    }
}
