import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

import VideoEngine from '@modules/video-engine';

import { createClip, newId } from '@/state/ProjectContext';
import type { AudioItem, AudioKind, Clip } from '@/state/types';

export const DEFAULT_IMAGE_MS = 3000;
export const MAX_IMAGE_MS = 30000;

/** Opens the gallery and turns the picked videos/photos into timeline clips. */
export async function pickClips(): Promise<Clip[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['videos', 'images'],
    allowsMultipleSelection: true,
    quality: 1,
  });
  if (result.canceled) return [];
  const clips: Clip[] = [];
  for (const asset of result.assets) {
    clips.push(await clipFromAsset(asset));
  }
  return clips;
}

export async function pickImage(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  return result.canceled ? null : result.assets[0].uri;
}

async function clipFromAsset(asset: ImagePicker.ImagePickerAsset): Promise<Clip> {
  const isVideo = asset.type === 'video' || asset.mimeType?.startsWith('video/');
  if (!isVideo) {
    return createClip({
      uri: asset.uri,
      type: 'image',
      sourceDurationMs: MAX_IMAGE_MS,
      endMs: DEFAULT_IMAGE_MS,
      width: asset.width,
      height: asset.height,
      hasAudio: false,
      thumbnail: asset.uri,
    });
  }
  const info = await VideoEngine.getMediaInfoAsync(asset.uri).catch(() => null);
  const duration = info?.durationMs || asset.duration || 0;
  const [thumbnail] = await VideoEngine.getThumbnailsAsync(asset.uri, [Math.min(500, duration / 2)], 240).catch(
    () => [null],
  );
  return createClip({
    uri: asset.uri,
    type: 'video',
    sourceDurationMs: duration,
    width: info?.width || asset.width,
    height: info?.height || asset.height,
    hasAudio: info?.hasAudio ?? true,
    thumbnail: thumbnail ?? undefined,
  });
}

export async function audioItemFromUri(
  uri: string,
  name: string,
  kind: AudioKind,
  startMs: number,
): Promise<AudioItem> {
  const info = await VideoEngine.getMediaInfoAsync(uri).catch(() => null);
  return {
    id: newId('audio'),
    uri,
    name,
    kind,
    sourceDurationMs: info?.durationMs ?? 0,
    startMs: kind === 'music' ? 0 : startMs,
    trimStartMs: 0,
    volume: kind === 'music' ? 0.6 : 1,
    loop: kind === 'music',
    fadeIn: kind === 'music',
    fadeOut: kind === 'music',
    denoise: kind === 'voiceover',
  };
}

export async function pickAudio(kind: AudioKind, startMs: number): Promise<AudioItem | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
  if (result.canceled) return null;
  const asset = result.assets[0];
  return audioItemFromUri(asset.uri, asset.name, kind, startMs);
}

export async function pickTextFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (result.canceled) return null;
  return new File(result.assets[0].uri).text();
}
