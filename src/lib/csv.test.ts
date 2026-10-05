import { describe, expect, it } from 'bun:test';
import { parseImportText, REPORT_CSV_HEADERS, stringifyReportsCsv } from './csv';

const report = {
  reportDate: '2025-01-01', totalMale: 1, totalFemale: 2, thaiMale: 0, thaiFemale: 0, genMale: 1, genFemale: 2,
  procMale: 0, procFemale: 0, refillMale: 0, refillFemale: 0, referDocMale: 0, referDocFemale: 0,
  admitMale: 0, admitFemale: 0, referOutMale: 0, referOutFemale: 0,
  topDiseases: [{ name: 'โรค,ตัวอย่าง', count: 1 }], topProcedures: [], reporterNote: 'line one\nline two, with comma', updatedAt: '2025-01-01T00:00:00.000Z',
};

describe('CSV import/export', () => {
  it('round trips quoted JSON, multiline Thai notes, and formula-leading text', () => {
    const values = ['=formula', "'=literal", "''=literal", "'plain", "''plain", ' \t=whitespace-formula'];
    for (const value of values) {
      const csv = stringifyReportsCsv([{ ...report, reporterNote: value }]);
      const rows = parseImportText(csv) as Array<Record<string, unknown>>;
      expect(rows).toHaveLength(1);
      expect(rows[0].reporterNote).toBe(value);
    }
    const csv = stringifyReportsCsv([{ ...report, reporterNote: "'=literal\n=safe\nหมายเหตุ" }]);
    const rows = parseImportText(csv) as Array<Record<string, unknown>>;
    expect(rows[0].topDiseases).toEqual(report.topDiseases);
  });

  it('accepts TSV and JSON object maps', () => {
    const tsvHeaders = REPORT_CSV_HEADERS.filter((header) => header !== 'UpdatedAt');
    const tsvValues = tsvHeaders.map((header) => ({ ReportDate: '2025-01-01', TotalMale: '1', TotalFemale: '2' } as Record<string, string>)[header] ?? '').join('\t');
    const tsv = `${tsvHeaders.join('\t')}\n${tsvValues}`;
    expect((parseImportText(tsv)[0] as Record<string, unknown>).reportDate).toBe('2025-01-01');
    expect(parseImportText('{"2025-01-01": ' + JSON.stringify(report) + '}')).toHaveLength(1);
  });

  it('preserves missing and malformed numeric cells for validation', () => {
    const headers = REPORT_CSV_HEADERS.filter((header) => header !== 'UpdatedAt');
    const values = headers.map((header) => ({ ReportDate: '2025-01-01', TotalMale: '', TotalFemale: 'oops' } as Record<string, string>)[header] ?? '');
    const rows = parseImportText(`${headers.join(',')}\n${values.join(',')}`) as Array<Record<string, unknown>>;
    expect(rows[0].totalMale).toBe('');
    expect(rows[0].totalFemale).toBe('oops');
    expect(rows[0].thaiMale).toBe('');
  });

  it('does not coerce non-array JSON item fields to empty arrays', () => {
    const row = Array.from({ length: 21 }, () => '');
    row[0] = '2025-01-01';
    row[17] = '{}';
    const rows = parseImportText(`ReportDate,TotalMale,TotalFemale,ThaiMale,ThaiFemale,GenMale,GenFemale,ProcMale,ProcFemale,RefillMale,RefillFemale,ReferDocMale,ReferDocFemale,AdmitMale,AdmitFemale,ReferOutMale,ReferOutFemale,TopDiseasesJson,TopProceduresJson,ReporterNote,UpdatedAt\n${row.map((cell) => JSON.stringify(cell)).join(',')}`) as Array<Record<string, unknown>>;
    expect(rows[0].topDiseases).toEqual({});
  });

  it('maps known headers by name and rejects unknown or duplicate headers', () => {
    const headers = REPORT_CSV_HEADERS.filter((header) => header !== 'UpdatedAt');
    const reordered = ['TotalFemale', 'ReportDate', 'TotalMale', ...headers.filter((header) => !['TotalFemale', 'ReportDate', 'TotalMale'].includes(header))];
    const values = reordered.map((header) => ({ ReportDate: '2025-01-01', TotalMale: '1', TotalFemale: '2' } as Record<string, string>)[header] ?? '');
    expect(parseImportText(`${reordered.join(',')}\n${values.join(',')}`)[0]).toMatchObject({
      reportDate: '2025-01-01',
      totalMale: 1,
      totalFemale: 2,
    });
    expect(() => parseImportText('ReportDate,TotalMale,Unknown\n2025-01-01,1,2')).toThrow('CSV header is not supported');
    expect(() => parseImportText('ReportDate,ReportDate\n2025-01-01,2025-01-01')).toThrow('CSV header is duplicated');
    expect(() => parseImportText('ReportDate,TotalMale\n2025-01-01,1')).toThrow('CSV header is missing required column');
  });

  it('does not strip ordinary text that happens to contain an equals sign', () => {
    const csv = stringifyReportsCsv([{ ...report, reporterNote: 'x=abc' }]);
    const rows = parseImportText(csv) as Array<Record<string, unknown>>;
    expect(rows[0].reporterNote).toBe('x=abc');
  });

  it('does not truncate malformed dates while parsing', () => {
    const headers = REPORT_CSV_HEADERS.filter((header) => header !== 'UpdatedAt');
    const values = headers.map((header) => ({ ReportDate: '2025-01-01T00:00:00.000Z', TotalMale: '1' } as Record<string, string>)[header] ?? '');
    const row = parseImportText(`${headers.join(',')}\n${values.join(',')}`)[0] as Record<string, unknown>;
    expect(row.reportDate).toBe('2025-01-01T00:00:00.000Z');
  });
});
