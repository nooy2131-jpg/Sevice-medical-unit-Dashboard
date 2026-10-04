import { describe, expect, it } from 'bun:test';
import { parseImportText, stringifyReportsCsv } from './csv';

const report = {
  reportDate: '2025-01-01', totalMale: 1, totalFemale: 2, thaiMale: 0, thaiFemale: 0, genMale: 1, genFemale: 2,
  procMale: 0, procFemale: 0, refillMale: 0, refillFemale: 0, referDocMale: 0, referDocFemale: 0,
  admitMale: 0, admitFemale: 0, referOutMale: 0, referOutFemale: 0,
  topDiseases: [{ name: 'โรค,ตัวอย่าง', count: 1 }], topProcedures: [], reporterNote: 'line one\nline two, with comma', updatedAt: '2025-01-01T00:00:00.000Z',
};

describe('CSV import/export', () => {
  it('round trips quoted JSON, multiline Thai notes, and formula-leading text', () => {
    const csv = stringifyReportsCsv([{ ...report, reporterNote: '=safe\nหมายเหตุ' }]);
    const rows = parseImportText(csv) as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(1);
    expect(rows[0].reportDate).toBe(report.reportDate);
    expect(rows[0].reporterNote).toBe('=safe\nหมายเหตุ');
    expect(rows[0].topDiseases).toEqual(report.topDiseases);
  });

  it('accepts TSV and JSON object maps', () => {
    const tsv = 'ReportDate\tTotalMale\tTotalFemale\n2025-01-01\t1\t2';
    expect((parseImportText(tsv)[0] as Record<string, unknown>).reportDate).toBe('2025-01-01');
    expect(parseImportText('{"2025-01-01": ' + JSON.stringify(report) + '}')).toHaveLength(1);
  });

  it('preserves missing and malformed numeric cells for validation', () => {
    const rows = parseImportText('ReportDate,TotalMale,TotalFemale\n2025-01-01,,oops') as Array<Record<string, unknown>>;
    expect(rows[0].totalMale).toBe('');
    expect(rows[0].totalFemale).toBe('oops');
    expect(rows[0].thaiMale).toBeUndefined();
  });

  it('does not coerce non-array JSON item fields to empty arrays', () => {
    const header = Array.from({ length: 21 }, (_, index) => `Column${index}`);
    header[0] = 'ReportDate';
    header[17] = 'TopDiseasesJson';
    const row = Array.from({ length: 21 }, () => '');
    row[0] = '2025-01-01';
    row[17] = '{}';
    const rows = parseImportText(`${header.join(',')}\n${row.map((cell) => JSON.stringify(cell)).join(',')}`) as Array<Record<string, unknown>>;
    expect(rows[0].topDiseases).toEqual({});
  });
});
