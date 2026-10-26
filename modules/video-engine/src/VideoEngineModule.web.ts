import { NativeModule, registerWebModule } from 'expo';

import { ExportResult, MediaInfo, VideoEngineModuleEvents } from './VideoEngine.types';

/**
 * Browser stand-in so the editor UI can run on web (UI development, store screenshots).
 * Media info and thumbnails use an HTML <video>; rendering is Android-only.
 */
class VideoEngineModule extends NativeModule<VideoEngineModuleEvents> {
  async exportAsync(_projectJson: string): Promise<ExportResult> {
    throw new Error('Exporting is only available in the Android app.');
  }

  async cancelExportAsync(): Promise<void> {}

  async getMediaInfoAsync(uri: string): Promise<MediaInfo> {
    const video = await loadVideo(uri);
    const isAudioOnly = video.videoWidth === 0;
    return {
      durationMs: Math.round(video.duration * 1000),
      width: video.videoWidth,
      height: video.videoHeight,
      hasAudio: true,
      hasVideo: !isAudioOnly,
    };
  }

  async getThumbnailsAsync(uri: string, timesMs: number[], maxWidth: number): Promise<(string | null)[]> {
    const video = await loadVideo(uri);
    const results: (string | null)[] = [];
    for (const t of timesMs) {
      await new Promise<void>((resolve) => {
        video.onseeked = () => resolve();
        video.currentTime = t / 1000;
      });
      const scale = Math.min(1, maxWidth / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
      results.push(canvas.toDataURL('image/jpeg', 0.8));
    }
    return results;
  }
}

function loadVideo(uri: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.onloadeddata = () => resolve(video);
    video.onerror = () => reject(new Error(`Could not load media: ${uri}`));
    video.src = uri;
  });
}

export default registerWebModule(VideoEngineModule, 'VideoEngineModule');
