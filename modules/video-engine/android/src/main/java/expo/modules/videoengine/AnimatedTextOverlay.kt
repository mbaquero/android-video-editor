package expo.modules.videoengine

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import androidx.media3.common.OverlaySettings
import androidx.media3.common.util.Size
import androidx.media3.common.util.UnstableApi
import androidx.media3.effect.BitmapOverlay
import androidx.media3.effect.StaticOverlaySettings
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min

/**
 * A text/caption overlay positioned in the output frame and shown between
 * [TextSpec.startMs] and [TextSpec.endMs] (output timeline), with an optional entry/exit
 * animation: fade, slideUp, pop or typewriter.
 */
@UnstableApi
class AnimatedTextOverlay(private val spec: TextSpec) : BitmapOverlay() {

  private var frameSize = Size(1080, 1920)
  private var cachedChars = -1
  private var cachedBitmap: Bitmap? = null

  override fun configure(videoSize: Size) {
    super.configure(videoSize)
    if (videoSize != frameSize) {
      frameSize = videoSize
      cachedChars = -1
    }
  }

  override fun getBitmap(presentationTimeUs: Long): Bitmap {
    val chars = if (spec.animation == "typewriter") {
      val elapsed = presentationTimeUs / 1000 - spec.startMs
      val total = spec.text.length
      // Type out over the first 60% of the display time, capped at 60ms per character.
      val window = min((spec.endMs - spec.startMs) * 0.6, total * 60.0).coerceAtLeast(1.0)
      (total * (elapsed / window)).toInt().coerceIn(if (total > 0) 1 else 0, total)
    } else {
      spec.text.length
    }
    if (chars != cachedChars || cachedBitmap == null) {
      cachedChars = chars
      cachedBitmap = render(spec.text.substring(0, chars))
    }
    return cachedBitmap!!
  }

  override fun getOverlaySettings(presentationTimeUs: Long): OverlaySettings {
    val tMs = presentationTimeUs / 1000.0
    val visible = tMs >= spec.startMs && tMs <= spec.endMs
    val sinceStart = tMs - spec.startMs
    val untilEnd = spec.endMs - tMs
    val edge = min(sinceStart, untilEnd)
    var alpha = if (visible) 1f else 0f
    var scale = 1f
    var dy = 0f
    if (visible) {
      when (spec.animation) {
        "fade" -> alpha = (edge / FADE_MS).toFloat().coerceIn(0f, 1f)
        "slideUp" -> {
          val p = (sinceStart / SLIDE_MS).toFloat().coerceIn(0f, 1f)
          val eased = 1f - (1f - p) * (1f - p) * (1f - p)
          dy = (1f - eased) * 0.12f
          alpha = min(p * 2f, (untilEnd / FADE_MS).toFloat()).coerceIn(0f, 1f)
        }
        "pop" -> {
          val p = (sinceStart / POP_MS).toFloat().coerceIn(0f, 1f)
          // Overshoot ease (back-out) from 0.4 to 1.0.
          val s = 1.70158f
          val q = p - 1f
          scale = 0.4f + 0.6f * (q * q * ((s + 1f) * q + s) + 1f)
          alpha = min(1f, p * 3f)
        }
      }
    }
    return StaticOverlaySettings.Builder()
      .setAlphaScale(max(0f, alpha))
      .setScale(scale, scale)
      .setBackgroundFrameAnchor(spec.x * 2f - 1f, 1f - (spec.y + dy) * 2f)
      .setOverlayFrameAnchor(0f, 0f)
      .build()
  }

  private fun render(text: String): Bitmap {
    val shortSide = min(frameSize.width, frameSize.height)
    val textPx = max(12f, spec.size * shortSide)
    val paint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
      textSize = textPx
      color = spec.color
      typeface = Typeface.create(Typeface.SANS_SERIF, if (spec.bold) Typeface.BOLD else Typeface.NORMAL)
    }
    val hasBackground = Color.alpha(spec.backgroundColor) > 0
    if (!hasBackground) paint.setShadowLayer(textPx * 0.12f, 0f, textPx * 0.05f, 0xAA000000.toInt())
    val maxWidth = (frameSize.width * 0.9f).toInt()
    // Measure against the full text so the box doesn't jump while typing out.
    val fullWidth = ceil(Layout.getDesiredWidth(spec.text, paint)).toInt()
    val layoutWidth = min(maxWidth, max(1, fullWidth))
    val layout = StaticLayout.Builder.obtain(text.ifEmpty { " " }, 0, text.ifEmpty { " " }.length, paint, layoutWidth)
      .setAlignment(Layout.Alignment.ALIGN_CENTER)
      .setIncludePad(false)
      .build()
    val fullLayout = StaticLayout.Builder.obtain(spec.text.ifEmpty { " " }, 0, spec.text.ifEmpty { " " }.length, paint, layoutWidth)
      .setAlignment(Layout.Alignment.ALIGN_CENTER)
      .setIncludePad(false)
      .build()
    val pad = (textPx * 0.35f).toInt()
    val width = layoutWidth + pad * 2
    val height = fullLayout.height + pad * 2
    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    if (hasBackground) {
      val bg = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = spec.backgroundColor }
      val radius = textPx * 0.3f
      canvas.drawRoundRect(RectF(0f, 0f, width.toFloat(), height.toFloat()), radius, radius, bg)
    }
    canvas.translate(pad.toFloat(), pad.toFloat())
    layout.draw(canvas)
    return bitmap
  }

  companion object {
    private const val FADE_MS = 350.0
    private const val SLIDE_MS = 450.0
    private const val POP_MS = 350.0
  }
}
