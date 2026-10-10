import { describe, expect, it } from 'bun:test';
import { suggestMapping } from './normalization-suggestions';

describe('normalization suggestions', () => {
  it('matches only the curated exact aliases', () => {
    expect(suggestMapping('disease', 'Common cld')).toEqual({ normalizedName: 'ไข้หวัด', groupName: 'ระบบทางเดินหายใจ' });
    expect(suggestMapping('disease', 'common cold')).toEqual({ normalizedName: 'ไข้หวัด', groupName: 'ระบบทางเดินหายใจ' });
    expect(suggestMapping('disease', 'ความดันโลหิตสูง (Essential Hypertension)')).toEqual({ normalizedName: 'ความดันโลหิตสูง', groupName: 'โรคเรื้อรัง' });
    expect(suggestMapping('procedure', 'ล้างแผล')).toEqual({ normalizedName: 'ทำแผล', groupName: 'การดูแลบาดแผล' });
  });

  it('does not fuzzy-match ambiguous aliases or other kinds', () => {
    expect(suggestMapping('disease', 'DM')).toBeNull();
    expect(suggestMapping('disease', 'Common Cold')).toBeNull();
    expect(suggestMapping('procedure', 'Common cold')).toBeNull();
    expect(suggestMapping('procedure', 'ทำแผลทั่วไป ')).toBeNull();
  });
});
