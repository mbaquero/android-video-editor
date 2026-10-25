package expo.modules.videoengine

import android.graphics.Color
import org.json.JSONArray
import org.json.JSONObject

/**
 * Plain data model of an editing project, decoded from the JSON the JS side sends.
 * All times are milliseconds. Clip times are in the source media's timeline; text and
 * audio track times are in the output timeline.
 */
data class ProjectSpec(
  val width: Int,
  val height: Int,
  val fit: String,
  val clips: List<ClipSpec>,
  val texts: List<TextSpec>,
  val audioTracks: List<AudioTrackSpec>,
)

data class SpeedPoint(val at: Float, val speed: Float)

data class ClipSpec(
  val uri: String,
  val isImage: Boolean,
  val startMs: Long,
  val endMs: Long,
  val speed: Float,
  val speedRamp: List<SpeedPoint>,
  val volume: Float,
  val denoise: Boolean,
  val filter: FilterSpec,
  val chroma: ChromaSpec?,
  val transitionIn: TransitionSpec?,
  val transitionOut: TransitionSpec?,
)

data class FilterSpec(
  val preset: String,
  val brightness: Float,
  val contrast: Float,
  val saturation: Float,
  val warmth: Float,
  val vignette: Float,
)

data class ChromaSpec(
  val keyColor: Int,
  val similarity: Float,
  val smoothness: Float,
  val backgroundUri: String?,
  val backgroundColor: Int,
)

data class TransitionSpec(val type: String, val durationMs: Long)

data class TextSpec(
  val text: String,
  val startMs: Long,
  val endMs: Long,
  val x: Float,
  val y: Float,
  val size: Float,
  val color: Int,
  val backgroundColor: Int,
  val bold: Boolean,
  val animation: String,
)

data class AudioTrackSpec(
  val uri: String,
  val startMs: Long,
  val trimStartMs: Long,
  val durationMs: Long,
  val volume: Float,
  val loop: Boolean,
  val fadeInMs: Long,
  val fadeOutMs: Long,
  val denoise: Boolean,
)

object ProjectParser {
  fun parse(json: String): ProjectSpec {
    val o = JSONObject(json)
    return ProjectSpec(
      width = o.getInt("width"),
      height = o.getInt("height"),
      fit = o.optString("fit", "fit"),
      clips = o.getJSONArray("clips").objects().map(::parseClip),
      texts = o.optJSONArray("texts").objects().map(::parseText),
      audioTracks = o.optJSONArray("audioTracks").objects().map(::parseAudio),
    )
  }

  private fun parseClip(o: JSONObject): ClipSpec {
    val filter = o.optJSONObject("filter")
    val chroma = o.optJSONObject("chroma")
    return ClipSpec(
      uri = o.getString("uri"),
      isImage = o.optString("type") == "image",
      startMs = o.optLong("startMs", 0),
      endMs = o.getLong("endMs"),
      speed = o.optDouble("speed", 1.0).toFloat(),
      speedRamp = o.optJSONArray("speedRamp").objects().map {
        SpeedPoint(it.getDouble("at").toFloat(), it.getDouble("speed").toFloat())
      },
      volume = o.optDouble("volume", 1.0).toFloat(),
      denoise = o.optBoolean("denoise", false),
      filter = FilterSpec(
        preset = filter?.optString("preset", "none") ?: "none",
        brightness = filter?.optDouble("brightness", 0.0)?.toFloat() ?: 0f,
        contrast = filter?.optDouble("contrast", 0.0)?.toFloat() ?: 0f,
        saturation = filter?.optDouble("saturation", 0.0)?.toFloat() ?: 0f,
        warmth = filter?.optDouble("warmth", 0.0)?.toFloat() ?: 0f,
        vignette = filter?.optDouble("vignette", 0.0)?.toFloat() ?: 0f,
      ),
      chroma = chroma?.takeIf { it.optBoolean("enabled", false) }?.let {
        ChromaSpec(
          keyColor = parseColor(it.optString("keyColor"), Color.GREEN),
          similarity = it.optDouble("similarity", 0.15).toFloat(),
          smoothness = it.optDouble("smoothness", 0.08).toFloat(),
          backgroundUri = it.optString("backgroundUri").ifEmpty { null },
          backgroundColor = parseColor(it.optString("backgroundColor"), Color.BLACK),
        )
      },
      transitionIn = o.optJSONObject("transitionIn")?.let(::parseTransition),
      transitionOut = o.optJSONObject("transitionOut")?.let(::parseTransition),
    )
  }

  private fun parseTransition(o: JSONObject): TransitionSpec? {
    val type = o.optString("type", "none")
    val duration = o.optLong("durationMs", 0)
    return if (type == "none" || duration <= 0) null else TransitionSpec(type, duration)
  }

  private fun parseText(o: JSONObject) = TextSpec(
    text = o.getString("text"),
    startMs = o.optLong("startMs", 0),
    endMs = o.getLong("endMs"),
    x = o.optDouble("x", 0.5).toFloat(),
    y = o.optDouble("y", 0.5).toFloat(),
    size = o.optDouble("size", 0.06).toFloat(),
    color = parseColor(o.optString("color"), Color.WHITE),
    backgroundColor = parseColor(o.optString("backgroundColor"), Color.TRANSPARENT),
    bold = o.optBoolean("bold", true),
    animation = o.optString("animation", "none"),
  )

  private fun parseAudio(o: JSONObject) = AudioTrackSpec(
    uri = o.getString("uri"),
    startMs = o.optLong("startMs", 0),
    trimStartMs = o.optLong("trimStartMs", 0),
    durationMs = o.optLong("durationMs", 0),
    volume = o.optDouble("volume", 1.0).toFloat(),
    loop = o.optBoolean("loop", false),
    fadeInMs = o.optLong("fadeInMs", 0),
    fadeOutMs = o.optLong("fadeOutMs", 0),
    denoise = o.optBoolean("denoise", false),
  )

  private fun parseColor(value: String?, fallback: Int): Int =
    if (value.isNullOrEmpty()) fallback else try {
      Color.parseColor(value)
    } catch (e: IllegalArgumentException) {
      fallback
    }

  private fun JSONArray?.objects(): List<JSONObject> =
    if (this == null) emptyList() else (0 until length()).map { getJSONObject(it) }
}
