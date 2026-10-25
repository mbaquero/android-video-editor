import Ionicons from '@expo/vector-icons/Ionicons';
import { useEvent, useEventListener } from 'expo';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatTime, outputSize, sourceToOutputMs } from '@/lib/timeline';
import type { Clip, Project } from '@/state/types';
import { LabeledSlider } from '@/ui/controls';
import { radius, spacing } from '@/ui/theme';

type Props = {
  project: Project;
  clipIndex: number;
  /** Position in the selected clip's source timeline. */
  playheadMs: number;
  onPlayheadChange: (ms: number) => void;
  maxHeight: number;
};

/**
 * Plays the selected clip inside a frame with the output aspect ratio, honouring trim,
 * constant speed and volume, and overlays text items that are active at the playhead.
 * Pixel effects (filters, transitions, chroma key) are only visible in a rendered preview.
 */
export function Preview({ project, clipIndex, playheadMs, onPlayheadChange, maxHeight }: Props) {
  const clip: Clip | undefined = project.clips[clipIndex];
  const [boxWidth, setBoxWidth] = useState(0);
  const player = useVideoPlayer(null, (p) => {
    p.timeUpdateEventInterval = 0.1;
    p.loop = false;
  });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const clipRef = useRef(clip);
  useEffect(() => {
    clipRef.current = clip;
  });

  const isVideo = clip?.type === 'video';

  useEffect(() => {
    if (!clip || clip.type !== 'video') {
      player.pause();
      return;
    }
    let cancelled = false;
    player.replaceAsync(clip.uri).then(() => {
      if (cancelled) return;
      seekTo(player, clip.startMs);
    });
    return () => {
      cancelled = true;
    };
    // Reload only when the selected media changes, not on every edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip?.id, clip?.uri]);

  useEffect(() => {
    if (!clip || clip.type !== 'video') return;
    applyClipSettings(player, clip);
  }, [player, clip]);

  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    const c = clipRef.current;
    if (!c || c.type !== 'video') return;
    const ms = currentTime * 1000;
    if (ms >= c.endMs - 30 || ms < c.startMs - 250) {
      seekTo(player, c.startMs);
      if (ms >= c.endMs - 30) player.pause();
      onPlayheadChange(c.startMs);
      return;
    }
    onPlayheadChange(ms);
  });

  const { ratio } = outputSize(project);
  let frameW = boxWidth;
  let frameH = boxWidth / ratio;
  if (frameH > maxHeight) {
    frameH = maxHeight;
    frameW = maxHeight * ratio;
  }
  const outputMs = sourceToOutputMs(project, clipIndex, playheadMs);
  const activeTexts = project.texts.filter((t) => outputMs >= t.startMs && outputMs <= t.endMs);
  const shortSide = Math.min(frameW, frameH);
  const fit = project.fit === 'crop' ? 'cover' : 'contain';

  const togglePlay = () => {
    if (!isVideo) return;
    if (isPlaying) player.pause();
    else player.play();
  };

  const seek = (ms: number) => {
    onPlayheadChange(ms);
    if (isVideo) seekTo(player, ms);
  };

  return (
    <View onLayout={(e: LayoutChangeEvent) => setBoxWidth(e.nativeEvent.layout.width)}>
      <View style={[styles.stage, { height: frameH || maxHeight }]}>
        <Pressable onPress={togglePlay} style={[styles.frame, { width: frameW, height: frameH }]}>
          {clip?.type === 'video' && (
            <VideoView player={player} style={StyleSheet.absoluteFill} contentFit={fit} nativeControls={false} surfaceType="textureView" />
          )}
          {clip?.type === 'image' && <Image source={{ uri: clip.uri }} style={StyleSheet.absoluteFill} contentFit={fit} />}
          {activeTexts.map((t) => (
            <View
              key={t.id}
              pointerEvents="none"
              style={[
                styles.textWrap,
                // Zero-height box centred on the anchor point so the text centres on (x, y).
                { left: t.x * frameW - frameW * 0.45, width: frameW * 0.9, top: t.y * frameH },
              ]}
            >
              <Text
                style={{
                  color: t.color,
                  fontSize: Math.max(8, t.size * shortSide),
                  fontWeight: t.bold ? '700' : '400',
                  textAlign: 'center',
                  backgroundColor: t.backgroundColor === 'transparent' ? undefined : toCssColor(t.backgroundColor),
                  paddingHorizontal: t.size * shortSide * 0.35,
                  paddingVertical: t.size * shortSide * 0.2,
                  borderRadius: t.size * shortSide * 0.3,
                  overflow: 'hidden',
                  textShadowColor: 'rgba(0,0,0,0.65)',
                  textShadowRadius: t.backgroundColor === 'transparent' ? 4 : 0,
                }}
              >
                {t.text}
              </Text>
            </View>
          ))}
          {isVideo && !isPlaying && (
            <View style={styles.playBadge} pointerEvents="none">
              <Ionicons name="play" size={28} color="#fff" />
            </View>
          )}
        </Pressable>
      </View>
      {clip && (
        <View style={styles.scrubber}>
          <LabeledSlider
            label={`Clip ${clipIndex + 1} · ${formatTime(playheadMs - clip.startMs)} / ${formatTime(clip.endMs - clip.startMs)}`}
            value={Math.min(Math.max(playheadMs, clip.startMs), clip.endMs)}
            min={clip.startMs}
            max={Math.max(clip.endMs, clip.startMs + 1)}
            step={10}
            format={() => `Timeline ${formatTime(outputMs)}`}
            onChange={seek}
            onLiveChange={seek}
          />
        </View>
      )}
    </View>
  );
}

// expo-video players are imperative objects; writing to them through plain helpers keeps
// the React Compiler from treating these writes as mutations of hook values.
function seekTo(player: VideoPlayer, ms: number) {
  player.currentTime = ms / 1000;
}

function applyClipSettings(player: VideoPlayer, clip: Clip) {
  player.playbackRate = clip.ramp === 'none' ? clip.speed : 1;
  player.volume = Math.min(1, clip.volume);
  player.muted = clip.volume === 0;
}

/** Converts #AARRGGBB (Android style, used by the engine) to an rgba() string. */
export function toCssColor(hex: string): string {
  if (/^#[0-9a-f]{8}$/i.test(hex)) {
    const a = parseInt(hex.slice(1, 3), 16) / 255;
    const r = parseInt(hex.slice(3, 5), 16);
    const g = parseInt(hex.slice(5, 7), 16);
    const b = parseInt(hex.slice(7, 9), 16);
    return `rgba(${r},${g},${b},${a.toFixed(2)})`;
  }
  return hex;
}

const styles = StyleSheet.create({
  stage: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#000', borderRadius: radius.md, overflow: 'hidden' },
  frame: { backgroundColor: '#000', overflow: 'hidden' },
  textWrap: { position: 'absolute', height: 0, alignItems: 'center', justifyContent: 'center' },
  playBadge: {
    position: 'absolute',
    alignSelf: 'center',
    top: '50%',
    marginTop: -28,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrubber: { paddingHorizontal: spacing.xs, marginTop: spacing.sm },
});
