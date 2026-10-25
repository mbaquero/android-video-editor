package expo.modules.videoengine

import androidx.media3.common.C
import androidx.media3.common.audio.AudioProcessor.AudioFormat
import androidx.media3.common.audio.AudioProcessor.UnhandledAudioFormatException
import androidx.media3.common.audio.BaseAudioProcessor
import androidx.media3.common.util.UnstableApi
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.exp
import kotlin.math.max
import kotlin.math.min

/**
 * Volume, fade in/out and a basic de-noise (high-pass rumble filter + downward expander
 * that attenuates the low-level noise floor between speech/music).
 *
 * [fadeOutEndMs] is where the fade-out finishes, measured from this processor's first sample;
 * 0 disables the fade-out. The position is deliberately kept across flushes so looping tracks
 * still fade at the right time.
 */
@UnstableApi
class AudioFxProcessor(
  private val volume: Float,
  private val fadeInMs: Long = 0,
  private val fadeOutMs: Long = 0,
  private val fadeOutEndMs: Long = 0,
  private val denoise: Boolean = false,
) : BaseAudioProcessor() {

  private var framesProcessed = 0L
  private var hpPrevIn = FloatArray(0)
  private var hpPrevOut = FloatArray(0)
  private var hpAlpha = 1f
  private var envelope = 0f
  private var gateGain = 1f
  private var attack = 0f
  private var release = 0f

  override fun onConfigure(inputAudioFormat: AudioFormat): AudioFormat {
    if (inputAudioFormat.encoding != C.ENCODING_PCM_16BIT &&
      inputAudioFormat.encoding != C.ENCODING_PCM_FLOAT
    ) {
      throw UnhandledAudioFormatException(inputAudioFormat)
    }
    val rate = inputAudioFormat.sampleRate.toFloat()
    val rc = 1f / (2f * PI.toFloat() * HIGH_PASS_HZ)
    hpAlpha = rc / (rc + 1f / rate)
    hpPrevIn = FloatArray(inputAudioFormat.channelCount)
    hpPrevOut = FloatArray(inputAudioFormat.channelCount)
    attack = 1f - exp(-1f / (0.005f * rate))
    release = 1f - exp(-1f / (0.150f * rate))
    val active = volume != 1f || fadeInMs > 0 || (fadeOutMs > 0 && fadeOutEndMs > 0) || denoise
    return if (active) inputAudioFormat else AudioFormat.NOT_SET
  }

  override fun queueInput(inputBuffer: ByteBuffer) {
    val format = inputAudioFormat
    val channels = format.channelCount
    val isFloat = format.encoding == C.ENCODING_PCM_FLOAT
    val bytesPerSample = if (isFloat) 4 else 2
    val remaining = inputBuffer.remaining()
    val frames = remaining / (bytesPerSample * channels)
    val output = replaceOutputBuffer(remaining).order(ByteOrder.nativeOrder())
    val input = inputBuffer.order(ByteOrder.nativeOrder())
    val sample = FloatArray(channels)
    val rate = format.sampleRate.toDouble()

    for (f in 0 until frames) {
      var peak = 0f
      for (ch in 0 until channels) {
        var s = if (isFloat) input.float else input.short / 32768f
        if (denoise) {
          val y = hpAlpha * (hpPrevOut[ch] + s - hpPrevIn[ch])
          hpPrevIn[ch] = s
          hpPrevOut[ch] = y
          s = y
        }
        sample[ch] = s
        peak = max(peak, abs(s))
      }

      var gain = volume
      if (denoise) {
        envelope += (peak - envelope) * (if (peak > envelope) attack else release)
        val target = if (envelope >= GATE_THRESHOLD) 1f else max(GATE_FLOOR, envelope / GATE_THRESHOLD)
        gateGain += (target - gateGain) * (if (target > gateGain) attack else release)
        gain *= gateGain
      }
      val tMs = (framesProcessed * 1000.0 / rate)
      if (fadeInMs > 0 && tMs < fadeInMs) gain *= (tMs / fadeInMs).toFloat()
      if (fadeOutMs > 0 && fadeOutEndMs > 0) {
        val left = fadeOutEndMs - tMs
        if (left < fadeOutMs) gain *= max(0.0, left / fadeOutMs).toFloat()
      }

      for (ch in 0 until channels) {
        val v = sample[ch] * gain
        if (isFloat) {
          output.putFloat(v)
        } else {
          output.putShort((min(1f, max(-1f, v)) * 32767f).toInt().toShort())
        }
      }
      framesProcessed++
    }
    inputBuffer.position(inputBuffer.limit())
    output.flip()
  }

  override fun onReset() {
    framesProcessed = 0
    envelope = 0f
    gateGain = 1f
  }

  companion object {
    private const val HIGH_PASS_HZ = 90f
    private const val GATE_THRESHOLD = 0.012f
    private const val GATE_FLOOR = 0.12f
  }
}
