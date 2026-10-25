package expo.modules.videoengine

import android.content.Context
import android.graphics.Bitmap
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import androidx.media3.common.MimeTypes
import androidx.media3.common.util.UnstableApi
import androidx.media3.transformer.Composition
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.ProgressHolder
import androidx.media3.transformer.Transformer
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream

@UnstableApi
class VideoEngineModule : Module() {
  private val mainHandler = Handler(Looper.getMainLooper())
  private var transformer: Transformer? = null
  private var pendingPromise: Promise? = null

  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("VideoEngine")

    Events("onProgress")

    AsyncFunction("exportAsync") { projectJson: String, promise: Promise ->
      mainHandler.post { startExport(projectJson, promise) }
    }

    AsyncFunction("cancelExportAsync") {
      mainHandler.post {
        transformer?.cancel()
        transformer = null
        pendingPromise?.reject(CodedException("ERR_CANCELLED", "Export cancelled", null))
        pendingPromise = null
      }
    }

    AsyncFunction("getMediaInfoAsync") { uri: String ->
      val retriever = MediaMetadataRetriever()
      try {
        retriever.setDataSource(context, Uri.parse(uri))
        fun meta(key: Int) = retriever.extractMetadata(key)
        val rotation = meta(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)?.toIntOrNull() ?: 0
        var width = meta(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)?.toIntOrNull() ?: 0
        var height = meta(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)?.toIntOrNull() ?: 0
        if (rotation == 90 || rotation == 270) width = height.also { height = width }
        mapOf(
          "durationMs" to (meta(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L),
          "width" to width,
          "height" to height,
          "hasAudio" to (meta(MediaMetadataRetriever.METADATA_KEY_HAS_AUDIO) == "yes"),
          "hasVideo" to (meta(MediaMetadataRetriever.METADATA_KEY_HAS_VIDEO) == "yes"),
        )
      } finally {
        retriever.release()
      }
    }

    AsyncFunction("getThumbnailsAsync") { uri: String, timesMs: List<Double>, maxWidth: Int ->
      val retriever = MediaMetadataRetriever()
      val dir = File(context.cacheDir, "thumbs").apply { mkdirs() }
      try {
        retriever.setDataSource(context, Uri.parse(uri))
        timesMs.map { t ->
          val frame = frameAt(retriever, (t * 1000).toLong(), maxWidth) ?: return@map null
          val file = File(dir, "t_${uri.hashCode()}_${t.toLong()}_$maxWidth.jpg")
          FileOutputStream(file).use { frame.compress(Bitmap.CompressFormat.JPEG, 80, it) }
          frame.recycle()
          Uri.fromFile(file).toString()
        }
      } finally {
        retriever.release()
      }
    }
  }

  private fun frameAt(retriever: MediaMetadataRetriever, timeUs: Long, maxSize: Int): Bitmap? {
    val option = MediaMetadataRetriever.OPTION_CLOSEST_SYNC
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      return retriever.getScaledFrameAtTime(timeUs, option, maxSize, maxSize)
    }
    val full = retriever.getFrameAtTime(timeUs, option) ?: return null
    val scale = maxSize.toFloat() / maxOf(full.width, full.height)
    if (scale >= 1f) return full
    return Bitmap.createScaledBitmap(full, (full.width * scale).toInt(), (full.height * scale).toInt(), true)
      .also { full.recycle() }
  }

  private fun startExport(projectJson: String, promise: Promise) {
    if (transformer != null) {
      promise.reject(CodedException("ERR_BUSY", "An export is already running", null))
      return
    }
    val composition: Composition
    try {
      composition = CompositionFactory.build(ProjectParser.parse(projectJson))
    } catch (e: Exception) {
      promise.reject(CodedException("ERR_INVALID_PROJECT", e.message ?: "Invalid project", e))
      return
    }
    val dir = File(context.cacheDir, "exports").apply { mkdirs() }
    val output = File(dir, "edit_${System.currentTimeMillis()}.mp4")

    val instance = Transformer.Builder(context)
      .setVideoMimeType(MimeTypes.VIDEO_H264)
      .setAudioMimeType(MimeTypes.AUDIO_AAC)
      .addListener(object : Transformer.Listener {
        override fun onCompleted(composition: Composition, exportResult: ExportResult) {
          finish()
          sendEvent("onProgress", mapOf("progress" to 1.0))
          promise.resolve(
            mapOf(
              "uri" to Uri.fromFile(output).toString(),
              "durationMs" to exportResult.approximateDurationMs,
              "sizeBytes" to output.length(),
            ),
          )
        }

        override fun onError(
          composition: Composition,
          exportResult: ExportResult,
          exportException: ExportException,
        ) {
          finish()
          output.delete()
          promise.reject(
            CodedException("ERR_EXPORT", exportException.message ?: "Export failed", exportException),
          )
        }
      })
      .build()
    transformer = instance
    pendingPromise = promise
    sendEvent("onProgress", mapOf("progress" to 0.0))
    instance.start(composition, output.absolutePath)
    pollProgress(instance)
  }

  private fun finish() {
    transformer = null
    pendingPromise = null
  }

  private fun pollProgress(instance: Transformer) {
    val holder = ProgressHolder()
    mainHandler.postDelayed(object : Runnable {
      override fun run() {
        if (transformer !== instance) return
        if (instance.getProgress(holder) == Transformer.PROGRESS_STATE_AVAILABLE) {
          sendEvent("onProgress", mapOf("progress" to holder.progress / 100.0))
        }
        mainHandler.postDelayed(this, 300)
      }
    }, 300)
  }
}
