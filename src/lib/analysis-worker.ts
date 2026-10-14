import { analyzeRelationships, type RelationshipSettings } from '../../shared/relationships';
import { fitMultivariable, type ModelSettings } from '../../shared/multivariable';
import type { EntrySummary } from '../../shared/schema';
export type AnalysisJob =
  | { kind: 'relationships'; entries: EntrySummary[]; settings: RelationshipSettings }
  | { kind: 'model'; entries: EntrySummary[]; settings: ModelSettings };
self.onmessage = (event: MessageEvent<AnalysisJob>) => {
  try {
    const job = event.data;
    const result =
      job.kind === 'relationships'
        ? analyzeRelationships(job.entries, job.settings)
        : fitMultivariable(job.entries, job.settings);
    self.postMessage({ result });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : 'Analysis could not be completed.',
    });
  }
};
