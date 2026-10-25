import type { useProject } from '@/state/ProjectContext';
import type { Clip, Project } from '@/state/types';

export type PanelProps = {
  project: Project;
  clip: Clip;
  clipIndex: number;
  /** Playhead in the selected clip's source timeline. */
  playheadMs: number;
  /** Playhead mapped to the output timeline. */
  outputPlayheadMs: number;
  dispatch: ReturnType<typeof useProject>['dispatch'];
  onSelectClip: (id: string | undefined) => void;
};
