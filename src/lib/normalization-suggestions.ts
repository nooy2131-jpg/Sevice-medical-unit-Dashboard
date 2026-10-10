import type { MappingCandidate, MappingKind } from '@/src/types/normalization';

type MappingSuggestion = NonNullable<MappingCandidate['suggestion']>;

const SUGGESTIONS: ReadonlyMap<string, MappingSuggestion> = new Map([
  ['disease\u0000Common cld', { normalizedName: 'ไข้หวัด', groupName: 'ระบบทางเดินหายใจ' }],
  ['disease\u0000Common cold', { normalizedName: 'ไข้หวัด', groupName: 'ระบบทางเดินหายใจ' }],
  ['disease\u0000common cold', { normalizedName: 'ไข้หวัด', groupName: 'ระบบทางเดินหายใจ' }],
  ['disease\u0000ไข้หวัด', { normalizedName: 'ไข้หวัด', groupName: 'ระบบทางเดินหายใจ' }],
  ['disease\u0000HT', { normalizedName: 'ความดันโลหิตสูง', groupName: 'โรคเรื้อรัง' }],
  ['disease\u0000็HT', { normalizedName: 'ความดันโลหิตสูง', groupName: 'โรคเรื้อรัง' }],
  ['disease\u0000I10', { normalizedName: 'ความดันโลหิตสูง', groupName: 'โรคเรื้อรัง' }],
  ['disease\u0000ความดันโลหิตสูง (Essential Hypertension)', { normalizedName: 'ความดันโลหิตสูง', groupName: 'โรคเรื้อรัง' }],
  ['procedure\u0000Dressing', { normalizedName: 'ทำแผล', groupName: 'การดูแลบาดแผล' }],
  ['procedure\u0000ทำแผลทั่วไป', { normalizedName: 'ทำแผล', groupName: 'การดูแลบาดแผล' }],
  ['procedure\u0000ล้างแผล', { normalizedName: 'ทำแผล', groupName: 'การดูแลบาดแผล' }],
  ['procedure\u0000ทำแผล', { normalizedName: 'ทำแผล', groupName: 'การดูแลบาดแผล' }],
]);

/** Return a suggestion only for the explicitly curated, exact raw alias. */
export function suggestMapping(kind: MappingKind, rawName: string): MappingSuggestion | null {
  return SUGGESTIONS.get(`${kind}\u0000${rawName}`) ?? null;
}
