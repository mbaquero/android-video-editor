package expo.modules.videoengine

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.net.Uri
import android.opengl.GLES20
import androidx.media3.common.C
import androidx.media3.common.VideoFrameProcessingException
import androidx.media3.common.util.GlProgram
import androidx.media3.common.util.GlUtil
import androidx.media3.common.util.Size
import androidx.media3.common.util.UnstableApi
import androidx.media3.effect.BaseGlShaderProgram
import androidx.media3.effect.GlEffect
import kotlin.math.max
import kotlin.math.min

/**
 * Single-pass per-clip shader: colour grading + preset, vignette, chroma key and
 * in/out transitions. Doing everything in one program keeps exports fast.
 *
 * [clipDurationUs] is the clip's duration in the output timeline (after speed changes);
 * the transition progress is measured from the first frame this program receives.
 */
@UnstableApi
class ClipLookEffect(
  private val filter: FilterSpec,
  private val chroma: ChromaSpec?,
  private val transitionIn: TransitionSpec?,
  private val transitionOut: TransitionSpec?,
  private val clipDurationUs: Long,
) : GlEffect {

  override fun toGlShaderProgram(context: Context, useHdr: Boolean): BaseGlShaderProgram =
    ClipLookShaderProgram(context, useHdr, this)

  override fun isNoOp(inputWidth: Int, inputHeight: Int): Boolean =
    chroma == null && transitionIn == null && transitionOut == null &&
      filter.preset == "none" && filter.brightness == 0f && filter.contrast == 0f &&
      filter.saturation == 0f && filter.warmth == 0f && filter.vignette == 0f

  private class ClipLookShaderProgram(
    private val context: Context,
    useHdr: Boolean,
    private val effect: ClipLookEffect,
  ) : BaseGlShaderProgram(useHdr, /* texturePoolCapacity= */ 1) {

    private val glProgram: GlProgram
    private var backgroundTexId = C.INDEX_UNSET
    private var firstFrameTimeUs = C.TIME_UNSET
    private val look = Presets.resolve(effect.filter)

    init {
      try {
        glProgram = GlProgram(VERTEX_SHADER, FRAGMENT_SHADER)
      } catch (e: GlUtil.GlException) {
        throw VideoFrameProcessingException(e)
      }
      glProgram.setBufferAttribute(
        "aFramePosition",
        GlUtil.getNormalizedCoordinateBounds(),
        GlUtil.HOMOGENEOUS_COORDINATE_VECTOR_SIZE,
      )
      val identity = GlUtil.create4x4IdentityMatrix()
      glProgram.setFloatsUniform("uTransformationMatrix", identity)
      glProgram.setFloatsUniform("uTexTransformationMatrix", identity)
    }

    override fun configure(inputWidth: Int, inputHeight: Int): Size {
      if (backgroundTexId == C.INDEX_UNSET) {
        val bitmap = createBackgroundBitmap(inputWidth, inputHeight)
        backgroundTexId = try {
          GlUtil.createTexture(bitmap)
        } catch (e: GlUtil.GlException) {
          throw VideoFrameProcessingException(e)
        }
        bitmap.recycle()
      }
      glProgram.setFloatUniform("uAspect", inputWidth.toFloat() / inputHeight.toFloat())
      return Size(inputWidth, inputHeight)
    }

    override fun drawFrame(inputTexId: Int, presentationTimeUs: Long) {
      if (firstFrameTimeUs == C.TIME_UNSET) firstFrameTimeUs = presentationTimeUs
      val localUs = presentationTimeUs - firstFrameTimeUs
      val (inType, inProgress) = progress(effect.transitionIn, localUs)
      val (outType, outProgress) =
        progress(effect.transitionOut, effect.clipDurationUs - localUs)
      val chroma = effect.chroma
      val key = chroma?.keyColor ?: Color.GREEN
      try {
        glProgram.use()
        glProgram.setSamplerTexIdUniform("uTexSampler", inputTexId, 0)
        glProgram.setSamplerTexIdUniform("uBgSampler", backgroundTexId, 1)
        glProgram.setFloatsUniform("uColorMatrix", look.matrix)
        glProgram.setFloatUniform("uBrightness", look.brightness)
        glProgram.setFloatUniform("uContrast", look.contrast)
        glProgram.setFloatUniform("uSaturation", look.saturation)
        glProgram.setFloatUniform("uWarmth", look.warmth)
        glProgram.setFloatUniform("uVignette", look.vignette)
        glProgram.setFloatUniform("uChromaEnabled", if (chroma != null) 1f else 0f)
        glProgram.setFloatsUniform(
          "uKeyColor",
          floatArrayOf(Color.red(key) / 255f, Color.green(key) / 255f, Color.blue(key) / 255f),
        )
        glProgram.setFloatUniform("uSimilarity", chroma?.similarity ?: 0.15f)
        glProgram.setFloatUniform("uSmoothness", max(chroma?.smoothness ?: 0.08f, 0.001f))
        glProgram.setFloatUniform("uInType", inType)
        glProgram.setFloatUniform("uInProgress", inProgress)
        glProgram.setFloatUniform("uOutType", outType)
        glProgram.setFloatUniform("uOutProgress", outProgress)
        glProgram.bindAttributesAndUniforms()
        GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4)
      } catch (e: GlUtil.GlException) {
        throw VideoFrameProcessingException(e, presentationTimeUs)
      }
    }

    override fun release() {
      super.release()
      try {
        glProgram.delete()
        if (backgroundTexId != C.INDEX_UNSET) GlUtil.deleteTexture(backgroundTexId)
      } catch (e: GlUtil.GlException) {
        throw VideoFrameProcessingException(e)
      }
    }

    /** Returns (shader transition type, progress 0..1 where 1 means fully visible). */
    private fun progress(spec: TransitionSpec?, distanceFromEdgeUs: Long): Pair<Float, Float> {
      if (spec == null) return 0f to 1f
      val p = distanceFromEdgeUs.toFloat() / (spec.durationMs * 1000f)
      return transitionCode(spec.type) to min(1f, max(0f, p))
    }

    /** Background shown through keyed pixels, scaled to cover the frame. */
    private fun createBackgroundBitmap(width: Int, height: Int): Bitmap {
      val chroma = effect.chroma
      val out = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
      val canvas = Canvas(out)
      canvas.drawColor(chroma?.backgroundColor ?: Color.BLACK)
      val source = chroma?.backgroundUri?.let { loadBitmap(it, width, height) } ?: return out
      val scale = max(width.toFloat() / source.width, height.toFloat() / source.height)
      val matrix = Matrix().apply {
        postScale(scale, scale)
        postTranslate((width - source.width * scale) / 2f, (height - source.height * scale) / 2f)
      }
      canvas.drawBitmap(source, matrix, Paint(Paint.FILTER_BITMAP_FLAG))
      source.recycle()
      return out
    }

    private fun loadBitmap(uri: String, reqWidth: Int, reqHeight: Int): Bitmap? = try {
      val parsed = Uri.parse(uri)
      val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
      context.contentResolver.openInputStream(parsed)?.use {
        BitmapFactory.decodeStream(it, null, bounds)
      }
      var sample = 1
      while (bounds.outWidth / (sample * 2) >= reqWidth && bounds.outHeight / (sample * 2) >= reqHeight) {
        sample *= 2
      }
      val options = BitmapFactory.Options().apply { inSampleSize = sample }
      context.contentResolver.openInputStream(parsed)?.use {
        BitmapFactory.decodeStream(it, null, options)
      }
    } catch (e: Exception) {
      null
    }
  }

  companion object {
    fun transitionCode(type: String): Float = when (type) {
      "fade" -> 1f
      "fadeWhite" -> 2f
      "wipe" -> 3f
      "circle" -> 4f
      "zoom" -> 5f
      "slide" -> 6f
      else -> 0f
    }

    private const val VERTEX_SHADER = """
      attribute vec4 aFramePosition;
      uniform mat4 uTransformationMatrix;
      uniform mat4 uTexTransformationMatrix;
      varying vec2 vTexSamplingCoord;
      void main() {
        gl_Position = uTransformationMatrix * aFramePosition;
        vec4 texturePosition = vec4(aFramePosition.x * 0.5 + 0.5, aFramePosition.y * 0.5 + 0.5, 0.0, 1.0);
        vTexSamplingCoord = (uTexTransformationMatrix * texturePosition).xy;
      }
    """

    private const val FRAGMENT_SHADER = """
      precision mediump float;
      uniform sampler2D uTexSampler;
      uniform sampler2D uBgSampler;
      uniform mat4 uColorMatrix;
      uniform float uBrightness;
      uniform float uContrast;
      uniform float uSaturation;
      uniform float uWarmth;
      uniform float uVignette;
      uniform float uChromaEnabled;
      uniform vec3 uKeyColor;
      uniform float uSimilarity;
      uniform float uSmoothness;
      uniform float uInType;
      uniform float uInProgress;
      uniform float uOutType;
      uniform float uOutProgress;
      uniform float uAspect;
      varying vec2 vTexSamplingCoord;

      vec2 chromaOf(vec3 c) {
        float y = dot(c, vec3(0.299, 0.587, 0.114));
        return vec2((c.b - y) * 0.565, (c.r - y) * 0.713);
      }

      // Geometry part of a transition: where to sample from. Returns uv; sets inside=0 if out of frame.
      vec2 transitionUv(float type, float p, vec2 uv, inout float inside) {
        if (type == 5.0) {
          float s = 1.0 + (1.0 - p) * 0.35;
          uv = (uv - 0.5) / s + 0.5;
        } else if (type == 6.0) {
          uv.x -= (1.0 - p);
        }
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) inside = 0.0;
        return uv;
      }

      // Colour part of a transition applied over the graded colour.
      vec3 transitionColor(float type, float p, vec2 uv, vec3 c) {
        if (type == 1.0 || type == 5.0) return c * p;
        if (type == 2.0) return mix(vec3(1.0), c, p);
        if (type == 3.0) return uv.x <= p ? c : vec3(0.0);
        if (type == 4.0) {
          vec2 d = (uv - 0.5) * vec2(uAspect, 1.0);
          float r = p * 0.5 * length(vec2(uAspect, 1.0));
          return length(d) <= r ? c : vec3(0.0);
        }
        return c;
      }

      void main() {
        float inside = 1.0;
        vec2 uv = transitionUv(uInType, uInProgress, vTexSamplingCoord, inside);
        uv = transitionUv(uOutType, uOutProgress, uv, inside);
        vec4 src = texture2D(uTexSampler, uv);
        vec3 c = src.rgb;

        if (uChromaEnabled > 0.5) {
          float d = distance(chromaOf(c), chromaOf(uKeyColor));
          float a = smoothstep(uSimilarity, uSimilarity + uSmoothness, d);
          // Spill suppression: pull the key channel towards the others on edges.
          float spill = 1.0 - a;
          c.g = mix(c.g, min(c.g, max(c.r, c.b)), spill * step(0.5, uKeyColor.g));
          vec3 bg = texture2D(uBgSampler, vec2(vTexSamplingCoord.x, 1.0 - vTexSamplingCoord.y)).rgb;
          c = mix(bg, c, a);
        }

        c = (uColorMatrix * vec4(c, 1.0)).rgb;
        c += uBrightness;
        c = (c - 0.5) * (1.0 + uContrast) + 0.5;
        float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(vec3(luma), c, 1.0 + uSaturation);
        c.r += uWarmth * 0.08;
        c.b -= uWarmth * 0.08;
        vec2 vd = (vTexSamplingCoord - 0.5) * vec2(uAspect, 1.0);
        c *= 1.0 - uVignette * smoothstep(0.35, 0.95, length(vd) / (0.5 * length(vec2(uAspect, 1.0))));

        c = transitionColor(uInType, uInProgress, vTexSamplingCoord, c);
        c = transitionColor(uOutType, uOutProgress, vec2(1.0 - vTexSamplingCoord.x, vTexSamplingCoord.y), c);
        c *= inside;
        gl_FragColor = vec4(clamp(c, 0.0, 1.0), src.a);
      }
    """
  }
}

/** Filter presets expressed as a colour matrix plus adjustment offsets. */
object Presets {
  class Look(
    val matrix: FloatArray,
    val brightness: Float,
    val contrast: Float,
    val saturation: Float,
    val warmth: Float,
    val vignette: Float,
  )

  // Column-major 4x4 built from a row-major 3x3 plus per-channel offset.
  private fun m(r: FloatArray, offset: FloatArray = floatArrayOf(0f, 0f, 0f)) = floatArrayOf(
    r[0], r[3], r[6], 0f,
    r[1], r[4], r[7], 0f,
    r[2], r[5], r[8], 0f,
    offset[0], offset[1], offset[2], 1f,
  )

  private val IDENTITY = m(floatArrayOf(1f, 0f, 0f, 0f, 1f, 0f, 0f, 0f, 1f))
  private val GRAY = m(floatArrayOf(.299f, .587f, .114f, .299f, .587f, .114f, .299f, .587f, .114f))
  private val SEPIA = m(floatArrayOf(.393f, .769f, .189f, .349f, .686f, .168f, .272f, .534f, .131f))
  private val INVERT = m(floatArrayOf(-1f, 0f, 0f, 0f, -1f, 0f, 0f, 0f, -1f), floatArrayOf(1f, 1f, 1f))
  private val VINTAGE = m(
    floatArrayOf(.9f, .1f, .05f, .05f, .85f, .1f, .05f, .1f, .7f),
    floatArrayOf(.04f, .03f, .06f),
  )
  private val COOL = m(floatArrayOf(.9f, 0f, 0f, 0f, 1f, .05f, 0f, .05f, 1.1f))
  private val CINEMATIC = m(
    floatArrayOf(1.05f, 0f, -.05f, -.02f, 1f, .02f, -.05f, .05f, 1.05f),
    floatArrayOf(0f, .01f, .03f),
  )

  fun resolve(f: FilterSpec): Look {
    // matrix, brightness, contrast, saturation, warmth, vignette deltas for each preset
    val base: Look = when (f.preset) {
      "mono" -> Look(GRAY, 0f, .05f, 0f, 0f, 0f)
      "noir" -> Look(GRAY, -.03f, .35f, 0f, 0f, .4f)
      "sepia" -> Look(SEPIA, 0f, 0f, 0f, 0f, .2f)
      "vintage" -> Look(VINTAGE, .02f, -.1f, -.2f, .3f, .35f)
      "warm" -> Look(IDENTITY, .02f, .05f, .1f, .6f, 0f)
      "cool" -> Look(COOL, 0f, .05f, 0f, -.4f, 0f)
      "vivid" -> Look(IDENTITY, 0f, .15f, .45f, 0f, 0f)
      "cinematic" -> Look(CINEMATIC, -.02f, .2f, -.1f, .15f, .3f)
      "fade" -> Look(IDENTITY, .06f, -.25f, -.25f, 0f, 0f)
      "invert" -> Look(INVERT, 0f, 0f, 0f, 0f, 0f)
      else -> Look(IDENTITY, 0f, 0f, 0f, 0f, 0f)
    }
    return Look(
      base.matrix,
      base.brightness + f.brightness,
      base.contrast + f.contrast,
      base.saturation + f.saturation,
      base.warmth + f.warmth,
      min(1f, base.vignette + f.vignette),
    )
  }
}
