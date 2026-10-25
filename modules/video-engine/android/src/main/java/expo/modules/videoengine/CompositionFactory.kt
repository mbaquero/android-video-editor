package expo.modules.videoengine

import android.net.Uri
import androidx.media3.common.C
import androidx.media3.common.Effect
import androidx.media3.common.MediaItem
import androidx.media3.common.audio.AudioProcessor
import androidx.media3.common.audio.SpeedProvider
import androidx.media3.common.util.UnstableApi
import androidx.media3.effect.OverlayEffect
import androidx.media3.effect.Presentation
import androidx.media3.effect.TextureOverlay
import androidx.media3.transformer.Composition
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.EditedMediaItemSequence
import androidx.media3.transformer.Effects

/** Turns a [ProjectSpec] into a Media3 [Composition]. */
@UnstableApi
object CompositionFactory {

  fun build(project: ProjectSpec): Composition {
    require(project.clips.isNotEmpty()) { "The project has no clips" }
    val layout = when (project.fit) {
      "crop" -> Presentation.LAYOUT_SCALE_TO_FIT_WITH_CROP
      "stretch" -> Presentation.LAYOUT_STRETCH_TO_FIT
      else -> Presentation.LAYOUT_SCALE_TO_FIT
    }
    val width = even(project.width)
    val height = even(project.height)

    val mainItems = project.clips.map { buildClip(it, width, height, layout) }
    val sequences = mutableListOf(
      EditedMediaItemSequence.Builder(setOf(C.TRACK_TYPE_AUDIO, C.TRACK_TYPE_VIDEO))
        .addItems(mainItems)
        .build(),
    )
    project.audioTracks.forEach { sequences.add(buildAudioTrack(it)) }

    val overlays: List<TextureOverlay> = project.texts
      .filter { it.text.isNotBlank() && it.endMs > it.startMs }
      .map { AnimatedTextOverlay(it) }
    val compositionEffects = if (overlays.isEmpty()) {
      Effects.EMPTY
    } else {
      Effects(emptyList(), listOf<Effect>(OverlayEffect(overlays)))
    }
    return Composition.Builder(sequences)
      .setEffects(compositionEffects)
      // Phones often record HDR; the custom shaders and H.264 output are 8-bit SDR.
      .setHdrMode(Composition.HDR_MODE_TONE_MAP_HDR_TO_SDR_USING_OPEN_GL)
      .build()
  }

  /** Output duration of a clip in ms, after trimming and speed changes. */
  fun outputDurationMs(clip: ClipSpec): Long {
    val sourceUs = (clip.endMs - clip.startMs) * 1000
    if (clip.isImage) return clip.endMs - clip.startMs
    val provider = speedProvider(clip) ?: return (sourceUs / clip.speed / 1000).toLong()
    var t = 0L
    var outUs = 0.0
    while (t < sourceUs) {
      val next = provider.getNextSpeedChangeTimeUs(t).let { if (it == C.TIME_UNSET) sourceUs else minOf(it, sourceUs) }
      outUs += (next - t) / provider.getSpeed(t).toDouble()
      t = next
    }
    return (outUs / 1000).toLong()
  }

  private fun buildClip(clip: ClipSpec, width: Int, height: Int, layout: Int): EditedMediaItem {
    val mediaItemBuilder = MediaItem.Builder().setUri(Uri.parse(clip.uri))
    if (clip.isImage) {
      mediaItemBuilder.setImageDurationMs(clip.endMs - clip.startMs)
    } else {
      mediaItemBuilder.setClippingConfiguration(
        MediaItem.ClippingConfiguration.Builder()
          .setStartPositionMs(clip.startMs)
          .setEndPositionMs(clip.endMs)
          .build(),
      )
    }

    val videoEffects = listOf<Effect>(
      Presentation.createForWidthAndHeight(width, height, layout),
      ClipLookEffect(clip.filter, clip.chroma, clip.transitionIn, clip.transitionOut, outputDurationMs(clip) * 1000),
    )
    val audioProcessors = mutableListOf<AudioProcessor>()
    if (!clip.isImage && (clip.volume != 1f || clip.denoise)) {
      audioProcessors.add(AudioFxProcessor(volume = clip.volume, denoise = clip.denoise))
    }

    val builder = EditedMediaItem.Builder(mediaItemBuilder.build())
      .setEffects(Effects(audioProcessors, videoEffects))
    if (clip.isImage) {
      builder.setFrameRate(30).setDurationUs((clip.endMs - clip.startMs) * 1000)
    } else {
      if (clip.volume <= 0f) builder.setRemoveAudio(true)
      speedProvider(clip)?.let {
        builder.setSpeed(it)
        // Cap the frame rate so fast-forwarded clips don't produce huge frame rates.
        builder.setFrameRate(60)
      }
    }
    return builder.build()
  }

  /**
   * Constant speed or a ramp. Ramp points are (position 0..1 within the trimmed clip, speed);
   * speeds are linearly interpolated and approximated with short constant segments.
   */
  private fun speedProvider(clip: ClipSpec): SpeedProvider? {
    if (clip.isImage) return null
    val durationUs = (clip.endMs - clip.startMs) * 1000
    val ramp = clip.speedRamp.sortedBy { it.at }
    if (ramp.size < 2) {
      return if (clip.speed == 1f) null else ConstantSpeed(clip.speed.coerceIn(0.1f, 8f))
    }
    val segmentUs = 100_000L
    val boundaries = mutableListOf<Long>()
    val speeds = mutableListOf<Float>()
    var t = 0L
    while (t < durationUs) {
      val mid = (t + segmentUs / 2).coerceAtMost(durationUs).toFloat() / durationUs
      boundaries.add(t)
      speeds.add(interpolate(ramp, mid).coerceIn(0.1f, 8f))
      t += segmentUs
    }
    return SegmentedSpeed(boundaries.toLongArray(), speeds.toFloatArray())
  }

  private fun interpolate(points: List<SpeedPoint>, at: Float): Float {
    if (at <= points.first().at) return points.first().speed
    if (at >= points.last().at) return points.last().speed
    for (i in 0 until points.size - 1) {
      val a = points[i]
      val b = points[i + 1]
      if (at >= a.at && at <= b.at) {
        val span = (b.at - a.at).takeIf { it > 0f } ?: return b.speed
        return a.speed + (b.speed - a.speed) * (at - a.at) / span
      }
    }
    return points.last().speed
  }

  private fun buildAudioTrack(track: AudioTrackSpec): EditedMediaItemSequence {
    val clipping = MediaItem.ClippingConfiguration.Builder().setStartPositionMs(track.trimStartMs)
    if (!track.loop && track.durationMs > 0) {
      clipping.setEndPositionMs(track.trimStartMs + track.durationMs)
    }
    val mediaItem = MediaItem.Builder()
      .setUri(Uri.parse(track.uri))
      .setClippingConfiguration(clipping.build())
      .build()
    val processor = AudioFxProcessor(
      volume = track.volume,
      fadeInMs = track.fadeInMs,
      fadeOutMs = track.fadeOutMs,
      fadeOutEndMs = track.durationMs,
      denoise = track.denoise,
    )
    val item = EditedMediaItem.Builder(mediaItem)
      .setRemoveVideo(true)
      .setEffects(Effects(listOf(processor), emptyList()))
      .build()
    val builder = EditedMediaItemSequence.Builder(setOf(C.TRACK_TYPE_AUDIO))
    // A looping sequence repeats its gap as well, so looping tracks always start at 0.
    if (track.startMs > 0 && !track.loop) builder.addGap(track.startMs * 1000)
    return builder.addItem(item).setIsLooping(track.loop).build()
  }

  private fun even(v: Int) = if (v % 2 == 0) v else v - 1

  private class ConstantSpeed(private val speed: Float) : SpeedProvider {
    override fun getSpeed(timeUs: Long) = speed
    override fun getNextSpeedChangeTimeUs(timeUs: Long) = C.TIME_UNSET
  }

  private class SegmentedSpeed(
    private val startsUs: LongArray,
    private val speeds: FloatArray,
  ) : SpeedProvider {
    private fun indexFor(timeUs: Long): Int {
      var i = startsUs.binarySearch(timeUs)
      if (i < 0) i = -i - 2
      return i.coerceIn(0, speeds.size - 1)
    }

    override fun getSpeed(timeUs: Long) = speeds[indexFor(timeUs)]

    override fun getNextSpeedChangeTimeUs(timeUs: Long): Long {
      val next = indexFor(timeUs) + 1
      return if (next < startsUs.size) startsUs[next] else C.TIME_UNSET
    }
  }
}
