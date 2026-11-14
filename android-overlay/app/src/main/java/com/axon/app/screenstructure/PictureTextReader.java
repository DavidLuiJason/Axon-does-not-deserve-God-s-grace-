package com.axon.app.screenstructure;

import android.graphics.Bitmap;

import com.google.android.gms.tasks.Tasks;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.concurrent.TimeUnit;

/**
 * Reads the text inside picture regions with on-device ML Kit (Latin script). One screenshot is taken in memory,
 * each region is cut out, read, and thrown away. Nothing is saved, compressed or sent anywhere; only text comes back.
 * Call from a background thread (Capacitor plugin methods already run on one).
 */
final class PictureTextReader {
    private PictureTextReader() { }

    static JSONObject read(AxonAccessibilityService service, JSONArray regions, int maxRegions) throws JSONException {
        JSONObject out = new JSONObject();
        AxonAccessibilityService.ShotResult shot = service.takeShot(4000);
        if (shot.bitmap == null) {
            out.put("ok", false);
            out.put("code", shot.error == null ? "screenshot-failed" : shot.error);
            return out;
        }
        Bitmap screen = shot.bitmap;
        TextRecognizer recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        JSONArray results = new JSONArray();
        try {
            int count = Math.min(regions.length(), maxRegions);
            for (int i = 0; i < count; i++) {
                JSONObject region = regions.optJSONObject(i);
                if (region == null) continue;
                int x = Math.max(0, region.optInt("x", 0));
                int y = Math.max(0, region.optInt("y", 0));
                int width = region.optInt("width", 0);
                int height = region.optInt("height", 0);
                if (x + width > screen.getWidth()) width = screen.getWidth() - x;
                if (y + height > screen.getHeight()) height = screen.getHeight() - y;
                JSONObject item = new JSONObject();
                item.put("ref", region.optString("ref", ""));
                item.put("text", "");
                if (width < 16 || height < 16) {
                    item.put("skipped", "too-small");
                    results.put(item);
                    continue;
                }
                Bitmap crop = Bitmap.createBitmap(screen, x, y, width, height);
                try {
                    Text text = Tasks.await(recognizer.process(InputImage.fromBitmap(crop, 0)), 8, TimeUnit.SECONDS);
                    item.put("text", text.getText());
                } catch (Exception e) {
                    item.put("error", "recognize-failed");
                } finally {
                    crop.recycle();
                }
                results.put(item);
            }
        } finally {
            recognizer.close();
            screen.recycle();
        }
        out.put("ok", true);
        out.put("regions", results);
        return out;
    }
}
