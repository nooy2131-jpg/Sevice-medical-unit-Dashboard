export interface TopItem {
  name: string;
  count: number;
  male?: number;
  female?: number;
}

export interface DailyReport {
  reportDate: string; // YYYY-MM-DD
  totalMale: number;
  totalFemale: number;
  thaiMale: number; // แพทย์แผนไทย (ชาย)
  thaiFemale: number; // แพทย์แผนไทย (หญิง)
  genMale: number;
  genFemale: number;
  procMale: number;
  procFemale: number;
  refillMale: number;
  refillFemale: number;
  referDocMale: number;
  referDocFemale: number;
  admitMale: number;
  admitFemale: number;
  referOutMale: number;
  referOutFemale: number;
  topDiseases: TopItem[];
  topProcedures: TopItem[];
  reporterNote: string;
  updatedAt: string;
  /** Optimistic concurrency version assigned by the server. */
  version?: number;
  /** The account that last published the report. */
  updatedBy?: string;
  lastEditor?: {
    id?: string;
    name?: string | null;
    email?: string | null;
  } | null;
}

export type ReportSaveState =
  "idle" | "loading" | "saving" | "saved" | "error" | "conflict";

export interface ReportDraftResponse {
  draft?: DailyReport | null;
  data?: DailyReport | null;
  expectedVersion?: number;
  version?: number;
  updatedAt?: string;
}

export type ReportsMap = Record<string, DailyReport>;

export function normalizeTopItems(raw: unknown): TopItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): TopItem | null => {
      if (!item || typeof item !== "object") return null;
      const obj = item as Record<string, unknown>;
      const name = String(
        obj.name ?? obj.disease ?? obj.procedure ?? obj.title ?? "",
      ).trim();
      if (!name) return null;
      const male =
        typeof obj.male === "number" ? obj.male : Number(obj.male) || 0;
      const female =
        typeof obj.female === "number" ? obj.female : Number(obj.female) || 0;
      const rawCount =
        obj.count !== undefined
          ? Number(obj.count)
          : obj.total !== undefined
            ? Number(obj.total)
            : male + female;
      return {
        name,
        count: Number.isFinite(rawCount) && rawCount >= 0 ? rawCount : 0,
        male: male > 0 ? male : undefined,
        female: female > 0 ? female : undefined,
      };
    })
    .filter((x): x is TopItem => x !== null && x.name.length > 0);
}

export function formatThaiDate(dateStr: string, short = false): string {
  if (!dateStr) return "-";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return dateStr;

  const thaiYear = year + 543;
  const monthsFull = [
    "มกราคม",
    "กุมภาพันธ์",
    "มีนาคม",
    "เมษายน",
    "พฤษภาคม",
    "มิถุนายน",
    "กรกฎาคม",
    "สิงหาคม",
    "กันยายน",
    "ตุลาคม",
    "พฤศจิกายน",
    "ธันวาคม",
  ];
  const monthsShort = [
    "ม.ค.",
    "ก.พ.",
    "มี.ค.",
    "เม.ย.",
    "พ.ค.",
    "มิ.ย.",
    "ก.ค.",
    "ส.ค.",
    "ก.ย.",
    "ต.ค.",
    "พ.ย.",
    "ธ.ค.",
  ];
  const mName = short ? monthsShort[month] : monthsFull[month];
  return `${day} ${mName} ${thaiYear}`;
}
