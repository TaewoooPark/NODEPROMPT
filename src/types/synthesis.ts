export type SegmentKind =
  | 'original'
  | 'heading'
  | 'hierarchy-node'
  | 'cross-edge'
  | 'excluded'
  | 'instruction'
  | 'text';

export interface SegmentProvenance {
  nodeIds: string[];
  edgeIds: string[];
  weight?: number;
  deletedMark?: boolean;
}

export interface SynthesisSegment {
  text: string;
  kind: SegmentKind;
  provenance: SegmentProvenance;
}

export function flattenSegments(segments: SynthesisSegment[]): string {
  return segments.map((s) => s.text).join('');
}
