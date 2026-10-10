export type MappingKind = 'disease' | 'procedure';

/** An approved alias. Raw report names are never overwritten. */
export type ReportMapping = {
  id: string;
  kind: MappingKind;
  rawName: string;
  normalizedName: string;
  groupName: string;
  version: number;
};

export type MappingCandidate = {
  kind: MappingKind;
  rawName: string;
  count: number;
  dates: string[];
  suggestion: { normalizedName: string; groupName: string } | null;
};

export type MappingResponse = {
  mappings: ReportMapping[];
  candidates?: MappingCandidate[];
};
