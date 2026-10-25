import { NativeModule, requireNativeModule } from 'expo';

import { ExportResult, MediaInfo, VideoEngineModuleEvents } from './VideoEngine.types';

declare class VideoEngineModule extends NativeModule<VideoEngineModuleEvents> {
  /** Renders the project (JSON-encoded EngineProject) to an MP4 in the cache directory. */
  exportAsync(projectJson: string): Promise<ExportResult>;
  cancelExportAsync(): Promise<void>;
  getMediaInfoAsync(uri: string): Promise<MediaInfo>;
  getThumbnailsAsync(uri: string, timesMs: number[], maxWidth: number): Promise<(string | null)[]>;
}

export default requireNativeModule<VideoEngineModule>('VideoEngine');
