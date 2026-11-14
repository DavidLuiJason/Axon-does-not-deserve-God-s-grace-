package com.axoncode.host

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder

/** Foreground notification source for long-running AXON Code jobs. Device behaviour is NOT RUN. */
class AxonCodeForegroundJobService : Service() {
    companion object {
        const val ACTION_START = "com.axoncode.host.action.START_JOB"
        const val ACTION_PAUSE = "com.axoncode.host.action.PAUSE_JOB"
        const val ACTION_CANCEL = "com.axoncode.host.action.CANCEL_JOB"
        const val EXTRA_JOB_ID = "jobId"
        const val CHANNEL_ID = "axon_code_background_jobs"
        const val NOTIFICATION_ID = 7412
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val jobId = intent?.getStringExtra(EXTRA_JOB_ID).orEmpty()
        when (intent?.action) {
            ACTION_PAUSE -> {
                if (jobId.isNotBlank()) JobActionDispatcher.current?.pause(jobId)
                updateNotification(jobId, "Pause requested")
            }
            ACTION_CANCEL -> {
                if (jobId.isNotBlank()) JobActionDispatcher.current?.cancel(jobId)
                updateNotification(jobId, "Cancellation requested")
            }
            ACTION_START -> {
                startForeground(NOTIFICATION_ID, buildNotification(jobId, "Running in background"))
            }
            else -> {
                stopSelf(startId)
                return START_NOT_STICKY
            }
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        // Durable job state is owned by the job journal; Android may kill this service at any time.
        super.onDestroy()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            CHANNEL_ID,
            "AXON Code background jobs",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Shows the state of AXON Code jobs running in the background."
            setShowBadge(false)
        }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    private fun actionIntent(action: String, jobId: String, requestCode: Int): PendingIntent {
        val intent = Intent(this, AxonCodeForegroundJobService::class.java).apply {
            this.action = action
            putExtra(EXTRA_JOB_ID, jobId)
        }
        return PendingIntent.getService(
            this,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun buildNotification(jobId: String, state: String): Notification {
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            Notification.Builder(this)
        }
        return builder
            .setContentTitle("AXON Code job")
            .setContentText(if (jobId.isBlank()) state else "$state · $jobId")
            .setSmallIcon(android.R.drawable.stat_sys_upload)
            .setOngoing(true)
            .addAction(Notification.Action.Builder(
                android.R.drawable.ic_media_pause,
                "Pause",
                actionIntent(ACTION_PAUSE, jobId, 7413)
            ).build())
            .addAction(Notification.Action.Builder(
                android.R.drawable.ic_menu_close_clear_cancel,
                "Cancel",
                actionIntent(ACTION_CANCEL, jobId, 7414)
            ).build())
            .build()
    }

    private fun updateNotification(jobId: String, state: String) {
        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(NOTIFICATION_ID, buildNotification(jobId, state))
    }
}

/** Registered by the real Android host integration; null means the provider is unavailable. */
object JobActionDispatcher {
    interface Dispatcher {
        fun pause(jobId: String): Boolean
        fun cancel(jobId: String): Boolean
    }

    @Volatile
    var current: Dispatcher? = null
}
