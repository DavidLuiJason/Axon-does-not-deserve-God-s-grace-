package com.axon.app.screencapture;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.MediaMetadataRetriever;
import android.media.MediaRecorder;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.SystemClock;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.Surface;
import android.view.WindowManager;

import org.json.JSONObject;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileWriter;
import java.io.FileOutputStream;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/**
 * Visible foreground service for explicit, user-approved MediaProjection recording.
 * Records video-only MP4 segments and extracts one JPEG keyframe per completed segment.
 */
public class ScreenCaptureService extends Service {
    public static final String ACTION_START = "com.axon.app.screencapture.START";
    public static final String ACTION_STOP = "com.axon.app.screencapture.STOP";
    public static final String EXTRA_RESULT_CODE = "resultCode";
    public static final String EXTRA_RESULT_DATA = "resultData";
    public static final String EXTRA_SESSION_ID = "sessionId";
    public static final String EXTRA_SEGMENT_SECONDS = "segmentSeconds";
    public static final String EXTRA_FRAME_RATE = "frameRate";
    public static final String EXTRA_BITRATE = "bitrate";
    public static final String EXTRA_MAX_BYTES = "maxBytes";

    private static final String TAG = "AxonScreenCapture";
    private static final String CHANNEL_ID = "axon_screen_capture";
    private static final int NOTIFICATION_ID = 7314;
    private static volatile boolean processCaptureActive = false;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private MediaProjection projection;
    private final MediaProjection.Callback projectionCallback = new MediaProjection.Callback() {
        @Override public void onStop() { if (!stopping) stopCapture("system-revoked"); }
    };
    private VirtualDisplay virtualDisplay;
    private MediaRecorder recorder;
    private File captureRootDir;
    private File sessionDir;
    private File manifestFile;
    private String sessionId;
    private int sequence = 0;
    private int width;
    private int height;
    private int densityDpi;
    private int frameRate = 15;
    private int bitrate = 1800000;
    private int segmentSeconds = 30;
    private long maxBytes = 268435456L;
    private long startedElapsedMs;
    private long segmentStartedElapsedMs;
    private long lastSegmentEndedElapsedMs;
    private long segmentGapBeforeMs;
    private String segmentStartedLocal;
    private String timeZoneId;
    private String utcOffset;
    private String segmentStartedUtc;
    private boolean stopping = false;
    private boolean running = false;
    private final Runnable rotateRunnable = this::rotateSegment;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) { stopSelf(); return START_NOT_STICKY; }
        if (ACTION_STOP.equals(intent.getAction())) {
            stopCapture("user-stop");
            return START_NOT_STICKY;
        }
        if (!ACTION_START.equals(intent.getAction())) return START_NOT_STICKY;
        if (running) return START_NOT_STICKY;
        int resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, 0);
        Intent resultData = getResultData(intent);
        if (resultData == null || resultCode == 0) {
            writeSnapshot(this, "failed", "Missing MediaProjection consent token.", null);
            stopSelf();
            return START_NOT_STICKY;
        }
        sessionId = intent.getStringExtra(EXTRA_SESSION_ID);
        if (sessionId == null || sessionId.trim().isEmpty()) sessionId = "session-" + System.currentTimeMillis();
        segmentSeconds = clamp(intent.getIntExtra(EXTRA_SEGMENT_SECONDS, 30), 5, 120);
        frameRate = clamp(intent.getIntExtra(EXTRA_FRAME_RATE, 15), 5, 30);
        bitrate = clamp(intent.getIntExtra(EXTRA_BITRATE, 1800000), 500000, 8000000);
        maxBytes = Math.max(16L * 1024L * 1024L, Math.min(4L * 1024L * 1024L * 1024L, intent.getLongExtra(EXTRA_MAX_BYTES, 268435456L)));
        try {
            startForegroundCaptureNotification();
            captureRootDir = getCaptureRoot(this);
            if (!captureRootDir.exists() && !captureRootDir.mkdirs()) throw new IllegalStateException("Cannot create private capture directory.");
            recoverAbandonedSessions(captureRootDir);
            long existingBytes = totalCaptureBytes();
            if (existingBytes >= maxBytes) throw new IllegalStateException("AXON screen-capture storage quota is full. Delete an old saved session first.");
            long remainingBytes = maxBytes - existingBytes;
            long segmentBudgetBytes = Math.max(512L * 1024L, remainingBytes / 8L);
            int budgetSeconds = (int) Math.max(5L, (segmentBudgetBytes * 8L) / Math.max(1, bitrate));
            segmentSeconds = Math.min(segmentSeconds, Math.min(120, budgetSeconds));
            getSharedPreferences("axon_screen_capture", MODE_PRIVATE).edit().putLong("maxStorageBytes", maxBytes).apply();
            MediaProjectionManager manager = (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
            projection = manager.getMediaProjection(resultCode, resultData);
            if (projection == null) throw new IllegalStateException("MediaProjection token was rejected.");
            projection.registerCallback(projectionCallback, handler);
            configureDisplaySize();
            sessionDir = new File(captureRootDir, safeFilePart(sessionId));
            if (!sessionDir.exists() && !sessionDir.mkdirs()) throw new IllegalStateException("Cannot create private capture directory.");
            manifestFile = new File(sessionDir, "segments.jsonl");
            startedElapsedMs = SystemClock.elapsedRealtime();
            startSegment(true);
            running = true;
            processCaptureActive = true;
            writeSnapshot(this, "active", null, sessionId);
            emit("captureStatus", new JSONObject().put("state", "active").put("sessionId", sessionId));
            return START_NOT_STICKY;
        } catch (Exception error) {
            Log.e(TAG, "Unable to start projection", error);
            emitGap(json("type", "capture-start-failed", "reason", error.getMessage()));
            stopCapture("start-failed");
            return START_NOT_STICKY;
        }
    }

    private Intent getResultData(Intent intent) {
        if (Build.VERSION.SDK_INT >= 33) return intent.getParcelableExtra(EXTRA_RESULT_DATA, Intent.class);
        //noinspection deprecation
        return intent.getParcelableExtra(EXTRA_RESULT_DATA);
    }

    private void configureDisplaySize() {
        DisplayMetrics metrics = new DisplayMetrics();
        WindowManager wm = (WindowManager) getSystemService(WINDOW_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            android.view.Display display = wm.getDefaultDisplay();
            android.graphics.Point size = new android.graphics.Point();
            display.getRealSize(size);
            width = size.x;
            height = size.y;
        } else {
            //noinspection deprecation
            wm.getDefaultDisplay().getRealMetrics(metrics);
            width = metrics.widthPixels;
            height = metrics.heightPixels;
        }
        // Preserve aspect ratio while keeping the first prototype within a widely supported
        // hardware-encoder profile. Later profiles can select higher limits per codec/device.
        float scale = Math.min(1f, Math.min(1920f / width, 1080f / height));
        width = Math.max(2, ((int) (width * scale)) & ~1);
        height = Math.max(2, ((int) (height * scale)) & ~1);
        densityDpi = getResources().getDisplayMetrics().densityDpi;
        timeZoneId = java.util.TimeZone.getDefault().getID();
        utcOffset = new SimpleDateFormat("Z", Locale.US).format(new Date());

    }

    private void startSegment(boolean first) throws Exception {
        if (stopping) return;
        sequence += 1;
        File partial = new File(sessionDir, String.format(Locale.US, "segment-%06d.partial.mp4", sequence));
        MediaRecorder next = prepareRecorder(partial);
        if (virtualDisplay == null) {
            virtualDisplay = projection.createVirtualDisplay("AXON Screen Intelligence", width, height,
                    densityDpi, DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                    next.getSurface(), null, handler);
            if (virtualDisplay == null) throw new IllegalStateException("Virtual display could not be created.");
        } else {
            virtualDisplay.resize(width, height, densityDpi);
            virtualDisplay.setSurface(next.getSurface());
        }
        try {
            next.start();
        } catch (Exception error) {
            try { next.release(); } catch (Exception ignored) { }
            if (partial.exists()) partial.delete();
            throw error;
        }
        recorder = next;
        segmentStartedElapsedMs = SystemClock.elapsedRealtime();
        segmentGapBeforeMs = lastSegmentEndedElapsedMs == 0 ? 0 : Math.max(0, segmentStartedElapsedMs - lastSegmentEndedElapsedMs);
        segmentStartedUtc = utcNow();
        segmentStartedLocal = localNow();
        handler.removeCallbacks(rotateRunnable);
        handler.postDelayed(rotateRunnable, segmentSeconds * 1000L);
        if (first) emit("captureStatus", new JSONObject().put("state", "recording").put("sessionId", sessionId));
    }

    private MediaRecorder prepareRecorder(File output) throws Exception {
        Exception lastError = null;
        for (int attempt = 0; attempt < 4; attempt++) {
            MediaRecorder candidate = new MediaRecorder();
            try {
                candidate.setVideoSource(MediaRecorder.VideoSource.SURFACE);
                candidate.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
                candidate.setVideoEncoder(MediaRecorder.VideoEncoder.H264);
                candidate.setVideoSize(width, height);
                candidate.setVideoFrameRate(frameRate);
                candidate.setVideoEncodingBitRate(bitrate);
                candidate.setOutputFile(output.getAbsolutePath());
                candidate.prepare();
                return candidate;
            } catch (Exception error) {
                lastError = error;
                try { candidate.release(); } catch (Exception ignored) { }
                if (output.exists()) output.delete();
                if (attempt == 3) break;
                width = Math.max(2, ((int) (width * 0.75f)) & ~1);
                height = Math.max(2, ((int) (height * 0.75f)) & ~1);
                frameRate = Math.max(5, frameRate - 3);
                bitrate = Math.max(500000, (int) (bitrate * 0.75f));
            }
        }
        throw lastError == null ? new IllegalStateException("No compatible video encoder configuration was found.") : lastError;
    }

    private void rotateSegment() {
        if (stopping || !running && recorder == null) return;
        try {
            finishCurrentSegment("segment-rotation");
            if (totalCaptureBytes() >= maxBytes) {
                emitGap(new JSONObject().put("type", "storage-limit-reached").put("sessionId", sessionId));
                stopCapture("storage-limit");
                return;
            }
            startSegment(false);
        } catch (Exception error) {
            emitGap(json("type", "segment-rotation-failed", "reason", error.getMessage()));
            stopCapture("segment-failed");
        }
    }

    private void finishCurrentSegment(String reason) {
        MediaRecorder current = recorder;
        recorder = null;
        if (current == null) return;
        File partial = new File(sessionDir, String.format(Locale.US, "segment-%06d.partial.mp4", sequence));
        try {
            current.stop();
            current.reset();
            current.release();
            File completed = new File(sessionDir, String.format(Locale.US, "segment-%06d.mp4", sequence));
            if (!partial.renameTo(completed)) throw new IllegalStateException("Could not commit completed segment file.");
            long endedElapsed = SystemClock.elapsedRealtime();
            long bytes = completed.length();
            String thumbnailPath = extractThumbnail(completed, sequence);
            JSONObject record = new JSONObject()
                    .put("sessionId", sessionId)
                    .put("sequence", sequence)
                    .put("file", completed.getAbsolutePath())
                    .put("thumbnail", thumbnailPath)
                    .put("startedAtUtc", segmentStartedUtc)
                    .put("endedAtUtc", utcNow())
                    .put("startedAtLocal", segmentStartedLocal)
                    .put("endedAtLocal", localNow())
                    .put("timeZoneId", timeZoneId)
                    .put("utcOffset", utcOffset)
                    .put("startedElapsedMs", segmentStartedElapsedMs)
                    .put("endedElapsedMs", endedElapsed)
                    .put("durationMs", Math.max(0, endedElapsed - segmentStartedElapsedMs))
                    .put("width", width)
                    .put("height", height)
                    .put("frameRate", frameRate)
                    .put("bitrate", bitrate)
                    .put("bytes", bytes)
                    .put("gapBeforeMs", segmentGapBeforeMs)
                    .put("reason", reason)
                    .put("audioCaptured", false);
            appendManifest(record);
            lastSegmentEndedElapsedMs = endedElapsed;
            emit("segmentSaved", record);
            if (segmentGapBeforeMs > 250) emitGap(new JSONObject().put("type", "segment-boundary-gap").put("gapMs", segmentGapBeforeMs).put("sequence", sequence));
        } catch (Exception error) {
            try { current.release(); } catch (Exception ignored) { }
            if (partial.exists()) partial.delete();
            emitGap(json("type", "segment-finalize-failed", "sequence", sequence, "reason", error.getMessage()));
        }
    }

    private String extractThumbnail(File video, int index) {
        MediaMetadataRetriever retriever = new MediaMetadataRetriever();
        try {
            retriever.setDataSource(video.getAbsolutePath());
            android.graphics.Bitmap bitmap = retriever.getFrameAtTime(0, MediaMetadataRetriever.OPTION_CLOSEST_SYNC);
            if (bitmap == null) return null;
            File thumb = new File(sessionDir, String.format(Locale.US, "frame-%06d.jpg", index));
            try (FileOutputStream out = new FileOutputStream(thumb)) {
                bitmap.compress(android.graphics.Bitmap.CompressFormat.JPEG, 78, out);
            }
            bitmap.recycle();
            return thumb.getAbsolutePath();
        } catch (Exception ignored) {
            return null;
        } finally {
            try { retriever.release(); } catch (Exception ignored) { }
        }
    }

    private void appendManifest(JSONObject record) throws Exception {
        try (BufferedWriter writer = new BufferedWriter(new FileWriter(manifestFile, true))) {
            writer.write(record.toString());
            writer.newLine();
        }
    }

    private long totalCaptureBytes() { return directoryBytes(captureRootDir); }

    public static File getCaptureRoot(Context context) {
        return new File(context.getFilesDir(), "axon-screen-capture");
    }

    public static long directoryBytes(File directory) {
        if (directory == null || !directory.exists()) return 0;
        File[] files = directory.listFiles();
        long total = 0;
        if (files != null) for (File file : files) total += file.isDirectory() ? directoryBytes(file) : file.length();
        return total;
    }

    private void recoverAbandonedSessions(File root) {
        File[] sessions = root.listFiles();
        if (sessions == null) return;
        for (File folder : sessions) {
            if (!folder.isDirectory() || folder.equals(sessionDir)) continue;
            File[] files = folder.listFiles();
            if (files == null) continue;
            for (File file : files) {
                if (file.getName().endsWith(".partial.mp4")) {
                    long size = file.length();
                    file.delete();
                    appendRecoveryGap(folder, file.getName(), "incomplete-segment-after-process-interruption", size);
                } else if (file.getName().endsWith(".mp4") && !isListedInManifest(folder, file.getName())) {
                    appendRecoveryGap(folder, file.getName(), "completed-file-without-committed-manifest-record", file.length());
                }
            }
        }
    }

    private boolean isListedInManifest(File folder, String fileName) {
        File manifest = new File(folder, "segments.jsonl");
        if (!manifest.isFile()) return false;
        try (java.io.BufferedReader reader = new java.io.BufferedReader(new java.io.FileReader(manifest))) {
            String line;
            while ((line = reader.readLine()) != null) {
                JSONObject record = new JSONObject(line);
                String recordedPath = record.optString("file", "");
                if (!recordedPath.isEmpty() && new File(recordedPath).getName().equals(fileName)) return true;
            }
        } catch (Exception ignored) { }
        return false;
    }

    private void appendRecoveryGap(File folder, String fileName, String reason, long bytes) {
        try {
            JSONObject gap = new JSONObject().put("file", fileName).put("reason", reason)
                    .put("bytes", bytes).put("detectedAtUtc", utcNow());
            File file = new File(folder, "recovery-gaps.jsonl");
            try (BufferedWriter writer = new BufferedWriter(new FileWriter(file, true))) {
                writer.write(gap.toString()); writer.newLine();
            }
            emit("captureGap", gap.put("sessionId", folder.getName()));
        } catch (Exception ignored) { }
    }

    private void stopCapture(String reason) {
        if (stopping) return;
        if ("system-revoked".equals(reason)) {
            emitGap(json("type", "projection-revoked", "reason", reason, "atUtc", utcNow()));
        }
        stopping = true;
        handler.removeCallbacks(rotateRunnable);
        finishCurrentSegment(reason);
        if (virtualDisplay != null) { virtualDisplay.release(); virtualDisplay = null; }
        if (projection != null) {
            try { projection.unregisterCallback(projectionCallback); } catch (Exception ignored) { }
            try { projection.stop(); } catch (Exception ignored) { }
            projection = null;
        }
        running = false;
        processCaptureActive = false;
        writeSnapshot(this, "stopped", reason, sessionId);
        emit("captureStatus", json("state", "stopped", "reason", reason, "sessionId", sessionId));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) stopForeground(STOP_FOREGROUND_REMOVE);
        else {
            //noinspection deprecation
            stopForeground(true);
        }
        stopSelf();
    }


    private void startForegroundCaptureNotification() {
        Intent stopIntent = new Intent(this, ScreenCaptureService.class).setAction(ACTION_STOP);
        PendingIntent stopPending = PendingIntent.getService(this, 7315, stopIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
        Notification.Builder builder = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(this, CHANNEL_ID)
                : new Notification.Builder(this);
        Notification notification = builder
                .setSmallIcon(com.axon.app.R.drawable.ic_notification)
                .setContentTitle("AXON screen capture is active")
                .setContentText("Your screen is being recorded. Tap Stop to end the session.")
                .setOngoing(true)
                .addAction(android.R.drawable.ic_media_pause, "Stop", stopPending)
                .build();
        if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);
        else startForeground(NOTIFICATION_ID, notification);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "AXON screen capture", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Visible status and stop control for an active screen-capture session.");
            NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            manager.createNotificationChannel(channel);
        }
    }

    private JSONObject json(Object... values) {
        JSONObject result = new JSONObject();
        try {
            for (int i = 0; i + 1 < values.length; i += 2) result.put(String.valueOf(values[i]), values[i + 1]);
        } catch (Exception ignored) { }
        return result;
    }

    private void emit(String event, JSONObject payload) { ScreenCapturePlugin.emitEvent(event, payload); }

    private void emitGap(JSONObject payload) {
        try {
            if (sessionDir != null && sessionDir.exists()) {
                File gaps = new File(sessionDir, "gaps.jsonl");
                try (BufferedWriter writer = new BufferedWriter(new FileWriter(gaps, true))) {
                    writer.write(payload.toString()); writer.newLine();
                }
            }
        } catch (Exception ignored) { }
        emit("captureGap", payload);
    }

    public static boolean isProcessCaptureActive() { return processCaptureActive; }

    public static JSONObject readSnapshot(Context context) {
        String raw = context.getSharedPreferences("axon_screen_capture", MODE_PRIVATE).getString("snapshot", "{}");
        try { return new JSONObject(raw); } catch (Exception ignored) { return new JSONObject(); }
    }

    /** Reconciles a persisted active marker after Android has killed the service/process. */
    public static JSONObject reconcileSnapshot(Context context) {
        JSONObject snapshot = readSnapshot(context);
        String state = snapshot.optString("state", "idle");
        if (("active".equals(state) || "starting".equals(state) || "recording".equals(state)) && !processCaptureActive) {
            String session = snapshot.optString("sessionId", "");
            try {
                snapshot.put("state", "interrupted");
                snapshot.put("reason", "capture-process-no-longer-active");
                snapshot.put("updatedAtUtc", utcNow());
                context.getSharedPreferences("axon_screen_capture", MODE_PRIVATE).edit().putString("snapshot", snapshot.toString()).apply();
                if (!session.isEmpty()) {
                    File folder = new File(getCaptureRoot(context), safeFilePart(session));
                    if (folder.exists()) {
                        JSONObject gap = new JSONObject().put("sessionId", session).put("reason", "capture-process-no-longer-active").put("detectedAtUtc", utcNow());
                        File gaps = new File(folder, "recovery-gaps.jsonl");
                        try (BufferedWriter writer = new BufferedWriter(new FileWriter(gaps, true))) { writer.write(gap.toString()); writer.newLine(); }
                    }
                }
            } catch (Exception ignored) { }
        }
        return snapshot;
    }

    private static void writeSnapshot(Context context, String state, String reason, String session) {
        try {
            JSONObject value = new JSONObject().put("state", state).put("reason", reason).put("sessionId", session).put("updatedAtUtc", utcNow());
            context.getSharedPreferences("axon_screen_capture", MODE_PRIVATE).edit().putString("snapshot", value.toString()).apply();
        } catch (Exception ignored) { }
    }

    private static String localNow() {
        return new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSZ", Locale.US).format(new Date());
    }

    private static String utcNow() {
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        format.setTimeZone(TimeZone.getTimeZone("UTC"));
        return format.format(new Date());
    }

    private static int clamp(int value, int min, int max) { return Math.max(min, Math.min(max, value)); }
    private static String safeFilePart(String value) { return value.replaceAll("[^A-Za-z0-9_-]", "_"); }

    @Override public IBinder onBind(Intent intent) { return null; }
    @Override public void onDestroy() {
        if (!stopping && (running || recorder != null)) stopCapture("service-destroyed");
        processCaptureActive = false;
        super.onDestroy();
    }
}
