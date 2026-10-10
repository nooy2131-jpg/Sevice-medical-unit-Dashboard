import type { ReportMapping, MappingKind } from "../types/normalization";
import { normalizeTopItems, type DailyReport, type TopItem } from "../types/report";

export type NormalizationStatus = "mapped" | "unmapped";

export type RawBreakdown = {
  rawName: string;
  count: number;
  male?: number;
  female?: number;
};

export type NormalizedTopItem = {
  /** Stable key includes status and group so an unmapped alias cannot collide with a mapped label. */
  key: string;
  kind: MappingKind;
  name: string;
  normalizedName: string;
  groupName: string;
  status: NormalizationStatus;
  count: number;
  male?: number;
  female?: number;
  rawBreakdown: RawBreakdown[];
};

export type NormalizedGroupTotal = {
  key: string;
  kind: MappingKind;
  groupName: string;
  status: NormalizationStatus;
  count: number;
  male?: number;
  female?: number;
  items: NormalizedTopItem[];
};

const keyPart = (value: string): string => `${value.length}:${value}`;

export function mappingKey(kind: MappingKind, rawName: string): string {
  return `${kind}\u0000${rawName}`;
}

export function mappingForRawName(
  kind: MappingKind,
  rawName: string,
  mappings: readonly ReportMapping[],
): ReportMapping | undefined {
  return mappings.find((mapping) => mappingKey(mapping.kind, mapping.rawName) === mappingKey(kind, rawName));
}

function knownCount(item: TopItem, key: "male" | "female"): number | undefined {
  const value = item[key];
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

export function rawReportTopItems(items: unknown): TopItem[] {
  const normalized = normalizeTopItems(items);
  if (!Array.isArray(items)) return normalized;
  return items.flatMap((source) => {
    const item = normalizeTopItems([source])[0];
    if (!item) return [];
    if (!source || typeof source !== "object" || Array.isArray(source)) return [item];
    const record = source as Record<string, unknown>;
    const rawName = typeof record.name === "string"
      ? record.name
      : typeof record.disease === "string"
        ? record.disease
        : typeof record.procedure === "string"
          ? record.procedure
          : item.name;
    const male = typeof record.male === "number" && Number.isFinite(record.male) && record.male >= 0 ? record.male : item.male;
    const female = typeof record.female === "number" && Number.isFinite(record.female) && record.female >= 0 ? record.female : item.female;
    return [{ ...item, name: rawName, male, female }];
  });
}

function itemKey(status: NormalizationStatus, normalizedName: string, groupName: string): string {
  return [status, keyPart(normalizedName), keyPart(groupName)].join("|");
}

/** Resolve one raw item without changing the source object. Matching is exact rawName + kind. */
export function normalizeReportItem(
  item: TopItem,
  kind: MappingKind,
  mappings: readonly ReportMapping[],
): NormalizedTopItem {
  const rawName = item.name;
  const mapping = mappingForRawName(kind, rawName, mappings);
  const status: NormalizationStatus = mapping ? "mapped" : "unmapped";
  const normalizedName = mapping?.normalizedName ?? rawName;
  const groupName = mapping?.groupName ?? "";
  const raw: RawBreakdown = {
    rawName,
    count: item.count,
    ...(knownCount(item, "male") === undefined ? {} : { male: knownCount(item, "male") }),
    ...(knownCount(item, "female") === undefined ? {} : { female: knownCount(item, "female") }),
  };
  return {
    key: itemKey(status, normalizedName, groupName),
    kind,
    name: normalizedName,
    normalizedName,
    groupName,
    status,
    count: item.count,
    male: knownCount(item, "male"),
    female: knownCount(item, "female"),
    rawBreakdown: [raw],
  };
}

export function normalizeReportTopItems(
  items: unknown,
  kind: MappingKind,
  mappings: readonly ReportMapping[],
): NormalizedTopItem[] {
  return rawReportTopItems(items).map((item) => normalizeReportItem(item, kind, mappings));
}

export function normalizedItemsForReport(
  report: Pick<DailyReport, "topDiseases" | "topProcedures">,
  kind: MappingKind,
  mappings: readonly ReportMapping[],
): NormalizedTopItem[] {
  return normalizeReportTopItems(kind === "disease" ? report.topDiseases : report.topProcedures, kind, mappings);
}

export function aggregateNormalizedItems(
  reports: readonly DailyReport[],
  field: "topDiseases" | "topProcedures",
  mappings: readonly ReportMapping[],
  limit?: number,
): NormalizedTopItem[] {
  const kind: MappingKind = field === "topDiseases" ? "disease" : "procedure";
  const totals = new Map<string, NormalizedTopItem>();
  const genderKnown = new Map<string, { male: boolean; female: boolean }>();
  for (const report of reports) {
    for (const item of normalizedItemsForReport(report, kind, mappings)) {
      const previous = totals.get(item.key);
      const known = genderKnown.get(item.key) ?? { male: true, female: true };
      known.male = known.male && item.male !== undefined;
      known.female = known.female && item.female !== undefined;
      genderKnown.set(item.key, known);
      if (!previous) {
        totals.set(item.key, { ...item, rawBreakdown: item.rawBreakdown.map((raw) => ({ ...raw })) });
        continue;
      }
      totals.set(item.key, {
        ...previous,
        count: previous.count + item.count,
        male: previous.male !== undefined && item.male !== undefined ? previous.male + item.male : undefined,
        female: previous.female !== undefined && item.female !== undefined ? previous.female + item.female : undefined,
        rawBreakdown: [...previous.rawBreakdown, ...item.rawBreakdown].map((raw) => ({ ...raw })),
      });
    }
  }
  const result = [...totals.values()].map((item) => {
    const known = genderKnown.get(item.key);
    return {
      ...item,
      male: known?.male ? item.male : undefined,
      female: known?.female ? item.female : undefined,
      rawBreakdown: combineRawBreakdown(item.rawBreakdown),
    };
  });
  result.sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, "th") || left.key.localeCompare(right.key));
  return limit === undefined ? result : result.slice(0, limit);
}

function combineRawBreakdown(items: readonly RawBreakdown[]): RawBreakdown[] {
  const totals = new Map<string, RawBreakdown>();
  const known = new Map<string, { male: boolean; female: boolean }>();
  for (const item of items) {
    const previous = totals.get(item.rawName);
    const flags = known.get(item.rawName) ?? { male: true, female: true };
    flags.male = flags.male && item.male !== undefined;
    flags.female = flags.female && item.female !== undefined;
    known.set(item.rawName, flags);
    totals.set(item.rawName, {
      rawName: item.rawName,
      count: (previous?.count ?? 0) + item.count,
      male: previous?.male !== undefined && item.male !== undefined ? previous.male + item.male : item.male,
      female: previous?.female !== undefined && item.female !== undefined ? previous.female + item.female : item.female,
    });
  }
  return [...totals.values()].map((item) => {
    const flags = known.get(item.rawName);
    return { ...item, male: flags?.male ? item.male : undefined, female: flags?.female ? item.female : undefined };
  }).sort((left, right) => right.count - left.count || left.rawName.localeCompare(right.rawName, "th"));
}

export function aggregateNormalizedGroups(
  reports: readonly DailyReport[],
  field: "topDiseases" | "topProcedures",
  mappings: readonly ReportMapping[],
): NormalizedGroupTotal[] {
  const items = aggregateNormalizedItems(reports, field, mappings);
  const groups = new Map<string, NormalizedGroupTotal>();
  for (const item of items) {
    const key = `${item.status}|${keyPart(item.groupName)}`;
    const previous = groups.get(key);
    if (!previous) {
      groups.set(key, { key, kind: item.kind, groupName: item.groupName, status: item.status, count: item.count, male: item.male, female: item.female, items: [item] });
      continue;
    }
    groups.set(key, {
      ...previous,
      count: previous.count + item.count,
      male: previous.male !== undefined && item.male !== undefined ? previous.male + item.male : undefined,
      female: previous.female !== undefined && item.female !== undefined ? previous.female + item.female : undefined,
      items: [...previous.items, item],
    });
  }
  return [...groups.values()].sort((left, right) => right.count - left.count || left.groupName.localeCompare(right.groupName, "th"));
}

export function normalizedExportItems(
  report: Pick<DailyReport, "topDiseases" | "topProcedures">,
  kind: MappingKind,
  mappings: readonly ReportMapping[],
): Array<{ rawName: string; name: string; group: string; mappingStatus: NormalizationStatus; count: number; male?: number; female?: number }> {
  return normalizedItemsForReport(report, kind, mappings).map((item) => ({
    rawName: item.rawBreakdown[0]?.rawName ?? item.name,
    name: item.normalizedName,
    group: item.groupName,
    mappingStatus: item.status,
    count: item.count,
    ...(item.male === undefined ? {} : { male: item.male }),
    ...(item.female === undefined ? {} : { female: item.female }),
  }));
}
