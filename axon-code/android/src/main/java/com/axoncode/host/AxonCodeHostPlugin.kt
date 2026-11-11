package com.axoncode.host

import android.content.Intent
import android.net.Uri
import android.provider.DocumentsContract
import android.util.Base64
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.ByteArrayOutputStream
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/** Android SAF bridge source. Device execution and persisted-grant behaviour remain NOT RUN until tested on device. */
@CapacitorPlugin(name = "AxonCodeHost")
class AxonCodeHostPlugin : Plugin() {
    private data class Grant(val id: String, val uris: MutableSet<String>)
    private val grants = ConcurrentHashMap<String, Grant>()

    @PluginMethod fun getCapabilities(call: PluginCall) {
        val result = JSObject()
        result.put("platform", "android")
        result.put("apiLevel", android.os.Build.VERSION.SDK_INT)
        result.put("cpuAbi", android.os.Build.SUPPORTED_ABIS.firstOrNull() ?: "unknown")
        result.put("persistedSafGrants", true)
        result.put("processProvider", false)
        result.put("pythonProvider", false)
        result.put("gradleProvider", false)
        call.resolve(result)
    }

    @PluginMethod fun pickWorkspace(call: PluginCall) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
        }
        startActivityForResult(call, intent, "workspacePicked")
    }

    @com.getcapacitor.annotation.ActivityCallback
    private fun workspacePicked(call: PluginCall, result: com.getcapacitor.ActivityResult) {
        val uri = result.data?.data
        if (result.resultCode != android.app.Activity.RESULT_OK || uri == null) { call.reject("Workspace selection cancelled."); return }
        val flags = result.data?.flags ?: 0
        val persistFlags = flags and (Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
        try { context.contentResolver.takePersistableUriPermission(uri, persistFlags) }
        catch (error: Exception) { call.reject("Persistable Storage Access Framework grant failed.", error); return }
        val id = UUID.randomUUID().toString()
        grants[id] = Grant(id, mutableSetOf(uri.toString()))
        val entry = JSObject().apply { put("uriToken", uri.toString()); put("displayName", "Selected workspace"); put("mimeType", "vnd.android.document/directory"); put("isDirectory", true) }
        call.resolve(JSObject().apply { put("grantId", id); put("entries", JSArray().put(entry)) })
    }

    @PluginMethod fun listChildren(call: PluginCall) {
        val grant = authorizedGrant(call) ?: return
        val treeUri = Uri.parse(grant.uris.firstOrNull() ?: "")
        val parentUri = authorizedUri(call, grant) ?: return
        val parentId = try { DocumentsContract.getDocumentId(parentUri) } catch (error: Exception) { call.reject("Invalid parent document URI.", error); return }
        val maxEntries = call.getInt("maxEntries") ?: 0
        if (maxEntries !in 1..2000) { call.reject("Entry limit outside 1..2000."); return }
        val childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, parentId)
        val rows = JSArray()
        try {
            context.contentResolver.query(childrenUri, arrayOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME, DocumentsContract.Document.COLUMN_MIME_TYPE, DocumentsContract.Document.COLUMN_SIZE), null, null, null)?.use { cursor ->
                var count = 0
                while (cursor.moveToNext()) {
                    if (++count > maxEntries) throw IllegalArgumentException("Workspace listing exceeds entry limit.")
                    val documentId = cursor.getString(0)
                    val name = cursor.getString(1) ?: ""
                    val mime = cursor.getString(2) ?: "application/octet-stream"
                    val size = if (cursor.isNull(3)) -1 else cursor.getLong(3)
                    val childUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, documentId)
                    rows.put(JSObject().apply { put("uriToken", childUri.toString()); put("displayName", name); put("mimeType", mime); if (size >= 0) put("sizeBytes", size); put("isDirectory", mime == DocumentsContract.Document.MIME_TYPE_DIR) })
                }
            } ?: throw IllegalStateException("Workspace listing cursor unavailable.")
            call.resolve(JSObject().apply { put("entries", rows) })
        } catch (error: Exception) { call.reject("Workspace listing failed.", error) }
    }

    @PluginMethod fun readDocument(call: PluginCall) {
        val grant = authorizedGrant(call) ?: return
        val uri = authorizedUri(call, grant) ?: return
        val maxBytes = call.getInt("maxBytes") ?: 0
        if (maxBytes !in 1..(16 * 1024 * 1024)) { call.reject("Read limit outside 1 byte..16 MiB."); return }
        try {
            val output = ByteArrayOutputStream()
            context.contentResolver.openInputStream(uri)?.use { input ->
                val buffer = ByteArray(8192); var total = 0
                while (true) { val count = input.read(buffer); if (count < 0) break; total += count; if (total > maxBytes) throw IllegalArgumentException("Document exceeds read limit."); output.write(buffer, 0, count) }
            } ?: throw IllegalStateException("Document stream unavailable.")
            val bytes = output.toByteArray()
            call.resolve(JSObject().apply { put("bytesBase64", Base64.encodeToString(bytes, Base64.NO_WRAP)); put("sizeBytes", bytes.size) })
        } catch (error: Exception) { call.reject("Document read failed.", error) }
    }

    @PluginMethod fun writeDocument(call: PluginCall) {
        val grant = authorizedGrant(call) ?: return
        val uri = authorizedUri(call, grant) ?: return
        val encoded = call.getString("bytesBase64") ?: ""
        val expected = call.getInt("expectedSizeBytes") ?: -1
        try {
            val bytes = Base64.decode(encoded, Base64.DEFAULT)
            if (bytes.size != expected || bytes.size > 16 * 1024 * 1024) { call.reject("Write size mismatch or limit exceeded."); return }
            context.contentResolver.openOutputStream(uri, "wt")?.use { it.write(bytes); it.flush() } ?: throw IllegalStateException("Document output stream unavailable.")
            call.resolve(JSObject().put("writtenBytes", bytes.size))
        } catch (error: Exception) { call.reject("Document write failed.", error) }
    }

    @PluginMethod fun releaseGrant(call: PluginCall) {
        val id = call.getString("grantId") ?: ""
        val grant = grants.remove(id)
        if (grant == null) { call.resolve(JSObject().put("released", false)); return }
        grant.uris.forEach { raw -> try { context.contentResolver.releasePersistableUriPermission(Uri.parse(raw), Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION) } catch (_: Exception) { } }
        call.resolve(JSObject().put("released", true))
    }

    private fun authorizedGrant(call: PluginCall): Grant? {
        val id = call.getString("grantId") ?: ""
        val grant = grants[id]
        if (grant == null) call.reject("Unknown or released SAF grant.")
        return grant
    }
    private fun authorizedUri(call: PluginCall, grant: Grant): Uri? {
        val raw = call.getString("uriToken") ?: ""
        val treeUri = Uri.parse(grant.uris.firstOrNull() ?: "")
        val requested = Uri.parse(raw)
        try {
            if (requested.authority != treeUri.authority) { call.reject("URI authority is outside the selected SAF grant."); return null }
            val rootId = DocumentsContract.getTreeDocumentId(treeUri)
            val rootDocumentUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, rootId)
            if (raw == treeUri.toString() || requested == rootDocumentUri) return rootDocumentUri
            if (!DocumentsContract.isChildDocument(context.contentResolver, rootDocumentUri, requested)) { call.reject("Document is outside the selected SAF tree."); return null }
            val documentId = DocumentsContract.getDocumentId(requested)
            return DocumentsContract.buildDocumentUriUsingTree(treeUri, documentId)
        } catch (error: Exception) { call.reject("Invalid document URI or grant.", error); return null }
    }
}
