import { describe, expect, it } from 'bun:test';
import { ReportValidationError, validateReport } from './report-validation';

const valid = {
  reportDate: '2025-01-01', totalMale: 10, totalFemale: 20, thaiMale: 1, thaiFemale: 2, genMale: 3, genFemale: 4,
  procMale: 5, procFemale: 6, refillMale: 7, refillFemale: 8, referDocMale: 9, referDocFemale: 10,
  admitMale: 11, admitFemale: 12, referOutMale: 13, referOutFemale: 14, topDiseases: [], topProcedures: [], reporterNote: '',
};

describe('report validation', () => {
  it('keeps independently entered totals even when category sums differ', () => {
    expect(validateReport(valid).totalMale).toBe(10);
  });

  it('rejects unsafe and negative counts', () => {
    expect(() => validateReport({ ...valid, totalMale: -1 })).toThrow(ReportValidationError);
    expect(() => validateReport({ ...valid, totalFemale: Number.MAX_SAFE_INTEGER + 1 })).toThrow(ReportValidationError);
  });

  it('bounds notes and top item shape', () => {
    expect(() => validateReport({ ...valid, reporterNote: 'x'.repeat(10_001) })).toThrow(ReportValidationError);
    expect(() => validateReport({ ...valid, topDiseases: [{ name: 'flu', count: 1.5 }] })).toThrow(ReportValidationError);
  });

  it('preserves exact raw names but rejects whitespace-only names', () => {
    const rawName = ' Common cld ';
    expect(validateReport({ ...valid, topDiseases: [{ name: rawName, count: 2 }] }).topDiseases[0].name).toBe(rawName);
    expect(() => validateReport({ ...valid, topDiseases: [{ name: '   ', count: 2 }] })).toThrow(ReportValidationError);
  });
});
