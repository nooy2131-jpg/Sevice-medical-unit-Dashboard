"use client";
/* Network loading effects intentionally synchronize remote data into local state. */
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Pencil, RefreshCw, Search, Trash2, X } from "lucide-react";
import type {
  MappingCandidate,
  MappingKind,
  MappingResponse,
  ReportMapping,
} from "../types/normalization";

type FilterKind = "all" | MappingKind;
type FilterStatus = "all" | "mapped" | "unmapped";
type MappingRow = {
  key: string;
  kind: MappingKind;
  rawName: string;
  mapping: ReportMapping | null;
  candidate: MappingCandidate | null;
};
type MappingDraft = {
  kind: MappingKind;
  rawName: string;
  normalizedName: string;
  groupName: string;
};

const kindLabel: Record<MappingKind, string> = {
  disease: "โรค",
  procedure: "หัตถการ",
};

function rowKey(kind: MappingKind, rawName: string): string {
  return `${kind}:${rawName}`;
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const value: unknown = await response.json().catch(() => ({}));
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function errorMessage(payload: Record<string, unknown>, fallback: string): string {
  if (typeof payload.error === "string") return payload.error;
  if (payload.error && typeof payload.error === "object" && !Array.isArray(payload.error)) {
    const error = payload.error as Record<string, unknown>;
    if (typeof error.message === "string") return error.message;
  }
  if (typeof payload.message === "string") return payload.message;
  return fallback;
}

function dateLabel(date: string): string {
  const parsed = new Date(`${date}T00:00:00+07:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  });
}

function initialDraft(row: MappingRow): MappingDraft {
  return {
    kind: row.kind,
    rawName: row.rawName,
    normalizedName: row.mapping?.normalizedName ?? row.candidate?.suggestion?.normalizedName ?? "",
    groupName: row.mapping?.groupName ?? row.candidate?.suggestion?.groupName ?? "",
  };
}

export function MappingClient() {
  const [mappings, setMappings] = useState<ReportMapping[]>([]);
  const [candidates, setCandidates] = useState<MappingCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<FilterKind>("all");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [draft, setDraft] = useState<MappingDraft | null>(null);
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);

  const load = useCallback(async (isRefresh = false): Promise<boolean> => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/mappings", { cache: "no-store" });
      const payload = await readJson(response);
      if (!response.ok) throw new Error(errorMessage(payload, "ไม่สามารถโหลด Mapping ได้"));
      const data = payload as Partial<MappingResponse>;
      setMappings(Array.isArray(data.mappings) ? data.mappings : []);
      setCandidates(Array.isArray(data.candidates) ? data.candidates : []);
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "ไม่สามารถโหลด Mapping ได้");
      return false;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo<MappingRow[]>(() => {
    const mappingByKey = new Map(mappings.map((mapping) => [rowKey(mapping.kind, mapping.rawName), mapping]));
    const candidateByKey = new Map(candidates.map((candidate) => [rowKey(candidate.kind, candidate.rawName), candidate]));
    const keys = new Set([...mappingByKey.keys(), ...candidateByKey.keys()]);
    return [...keys]
      .map((key) => {
        const mapping = mappingByKey.get(key) ?? null;
        const candidate = candidateByKey.get(key) ?? null;
        return {
          key,
          kind: mapping?.kind ?? candidate?.kind ?? "disease",
          rawName: mapping?.rawName ?? candidate?.rawName ?? "",
          mapping,
          candidate,
        };
      })
      .sort((left, right) => left.rawName.localeCompare(right.rawName, "th"));
  }, [candidates, mappings]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("th");
    return rows.filter((row) => {
      if (kindFilter !== "all" && row.kind !== kindFilter) return false;
      if (statusFilter === "mapped" && !row.mapping) return false;
      if (statusFilter === "unmapped" && row.mapping) return false;
      if (!query) return true;
      return [
        row.rawName,
        row.mapping?.normalizedName,
        row.mapping?.groupName,
        row.candidate?.suggestion?.normalizedName,
        row.candidate?.suggestion?.groupName,
      ].some((value) => value?.toLocaleLowerCase("th").includes(query));
    });
  }, [kindFilter, rows, search, statusFilter]);

  const approvedNames = useMemo(
    () => [...new Set(mappings.filter((mapping) => !draft || mapping.kind === draft.kind).map((mapping) => mapping.normalizedName))].sort((a, b) => a.localeCompare(b, "th")),
    [draft, mappings],
  );
  const approvedGroups = useMemo(
    () => [...new Set(mappings.filter((mapping) => !draft || mapping.kind === draft.kind).map((mapping) => mapping.groupName))].filter(Boolean).sort((a, b) => a.localeCompare(b, "th")),
    [draft, mappings],
  );

  const selectRow = (row: MappingRow) => {
    setSelectedKey(row.key);
    setSelectedVersion(row.mapping?.version ?? 0);
    setDraft(initialDraft(row));
    setError(null);
    setStatus(null);
  };

  const closeEditor = () => {
    if (busy) return;
    setSelectedKey(null);
    setSelectedVersion(null);
    setDraft(null);
  };

  const save = async () => {
    if (!draft) return;
    const normalizedName = draft.normalizedName.trim();
    const groupName = draft.groupName.trim();
    if (!draft.rawName || !normalizedName || !groupName) {
      setError("กรุณากรอกชื่อมาตรฐานและกลุ่มให้ครบถ้วน");
      return;
    }
    setBusy("save");
    setError(null);
    setStatus(null);
    try {
      const response = await fetch("/api/mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: draft.kind,
          rawName: draft.rawName,
          normalizedName,
          groupName,
          expectedVersion: selectedVersion ?? 0,
        }),
      });
      const payload = await readJson(response);
      if (!response.ok) {
        if (response.status === 409) {
          const refreshed = await load(true);
          if (refreshed) {
            setSelectedKey(null);
            setSelectedVersion(null);
            setDraft(null);
            throw new Error("ข้อมูล Mapping เปลี่ยนแปลงแล้ว จึงโหลดรายการล่าสุดให้แล้ว กรุณาตรวจสอบก่อนบันทึกอีกครั้ง");
          }
          throw new Error("ข้อมูล Mapping เปลี่ยนแปลงแล้ว และโหลดรายการล่าสุดไม่สำเร็จ กรุณากดโหลดข้อมูลล่าสุดแล้วลองใหม่");
        }
        throw new Error(errorMessage(payload, "บันทึก Mapping ไม่สำเร็จ"));
      }
      setStatus(selectedVersion ? "แก้ไข Mapping แล้ว" : "อนุมัติ Mapping แล้ว");
      setSelectedKey(null);
      setSelectedVersion(null);
      setDraft(null);
      await load(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "บันทึก Mapping ไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!draft) return;
    const current = mappings.find((mapping) => rowKey(mapping.kind, mapping.rawName) === rowKey(draft.kind, draft.rawName));
    if (!current) return;
    if (!window.confirm(`ลบ Mapping ของ “${current.rawName}” หรือไม่`)) return;
    setBusy("delete");
    setError(null);
    setStatus(null);
    try {
      const response = await fetch("/api/mappings", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: current.id, expectedVersion: selectedVersion ?? current.version }),
      });
      const payload = await readJson(response);
      if (!response.ok) {
        if (response.status === 409 || response.status === 404) {
          const refreshed = await load(true);
          if (refreshed) {
            setSelectedKey(null);
            setSelectedVersion(null);
            setDraft(null);
            throw new Error("ข้อมูล Mapping เปลี่ยนแปลงแล้ว จึงโหลดรายการล่าสุดให้แล้ว กรุณาตรวจสอบก่อนลบอีกครั้ง");
          }
          throw new Error("ข้อมูล Mapping เปลี่ยนแปลงแล้ว และโหลดรายการล่าสุดไม่สำเร็จ กรุณากดโหลดข้อมูลล่าสุดแล้วลองใหม่");
        }
        throw new Error(errorMessage(payload, "ลบ Mapping ไม่สำเร็จ"));
      }
      setStatus("ลบ Mapping แล้ว รายงานเดิมยังคงใช้ชื่อดิบอยู่");
      setSelectedKey(null);
      setSelectedVersion(null);
      setDraft(null);
      await load(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "ลบ Mapping ไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  };

  const selectedRow = selectedKey ? rows.find((row) => row.key === selectedKey) ?? null : null;
  const hasRows = rows.length > 0;

  return (
    <section className="mx-auto w-full max-w-6xl space-y-6" aria-labelledby="mapping-title">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 id="mapping-title" className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">จัดการ Mapping</h1>
          <p className="mt-2 text-sm text-slate-500">จัดระเบียบชื่อจากรายงานเดิมสำหรับสถิติและการส่งออก</p>
        </div>
        <button type="button" onClick={() => void load(true)} disabled={loading || refreshing || busy !== null} className="control-button w-full sm:w-auto">
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "กำลังโหลด…" : "โหลดข้อมูลล่าสุด"}
        </button>
      </div>

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[minmax(0,1fr)_10rem_10rem] sm:p-5">
        <label htmlFor="mapping-search" className="field-label">
          ค้นหาชื่อ
          <span className="relative mt-1 block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input id="mapping-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ชื่อดิบ ชื่อมาตรฐาน หรือกลุ่ม" className="control-input w-full pl-9" />
          </span>
        </label>
        <label htmlFor="mapping-kind" className="field-label">
          ประเภท
          <select id="mapping-kind" value={kindFilter} onChange={(event) => setKindFilter(event.target.value as FilterKind)} className="control-select mt-1 w-full">
            <option value="all">ทั้งหมด</option>
            <option value="disease">โรค</option>
            <option value="procedure">หัตถการ</option>
          </select>
        </label>
        <label htmlFor="mapping-status" className="field-label">
          สถานะ
          <select id="mapping-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as FilterStatus)} className="control-select mt-1 w-full">
            <option value="all">ทั้งหมด</option>
            <option value="mapped">อนุมัติแล้ว</option>
            <option value="unmapped">รออนุมัติ</option>
          </select>
        </label>
      </div>

      {status && <p role="status" className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">{status}</p>}
      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-1 border-b border-slate-200 px-4 py-4 sm:px-5">
          <h2 className="text-lg font-semibold text-slate-900">ชื่อจากรายงาน</h2>
          <p className="text-sm text-slate-600">ตรวจสอบคำแนะนำ แล้วกดแก้ไขเพื่ออนุมัติ Mapping อย่างชัดเจน</p>
        </div>
        {loading ? <p className="p-6 text-sm text-slate-500" role="status">กำลังโหลด Mapping…</p> : !hasRows ? <div className="p-6 text-sm text-slate-600"><p>ยังไม่มีชื่อให้จัดการ</p><p className="mt-1 text-slate-500">เมื่อมีรายงานที่ใช้ชื่อโรคหรือหัตถการ ชื่อจะแสดงที่นี่</p></div> : filteredRows.length === 0 ? <p className="p-6 text-sm text-slate-600">ไม่พบรายการตามตัวกรองนี้</p> : <div className="divide-y divide-slate-200">
          {filteredRows.map((row) => {
            const suggestion = !row.mapping ? row.candidate?.suggestion : null;
            const dates = row.candidate?.dates ?? [];
            const selected = selectedKey === row.key;
            return <article key={row.key} className={selected ? "bg-teal-50/50" : ""}>
              <div className="grid gap-4 px-4 py-5 sm:px-5 lg:grid-cols-[minmax(0,1fr)_minmax(12rem,0.7fr)_auto] lg:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{kindLabel[row.kind]}</span>
                    {row.mapping ? <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800">อนุมัติแล้ว</span> : <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">ยังไม่อนุมัติ</span>}
                  </div>
                  <h3 className="mt-3 break-words text-base font-semibold text-slate-950">{row.rawName}</h3>
                  <p className="mt-1 text-sm text-slate-600"><span className="font-mono tabular-nums font-semibold text-slate-900">{row.candidate?.count ?? 0}</span> ครั้งในรายงาน · {dates.length ? `พบ ${dates.length} วันที่` : "ไม่พบในรายงานปัจจุบัน"}</p>
                  {dates.length > 0 && <p className="mt-1 text-xs text-slate-500">วันที่ล่าสุด: {dateLabel(dates[dates.length - 1])}</p>}
                </div>
                <div className="min-w-0 text-sm">
                  {row.mapping ? <><p className="font-semibold text-slate-900">{row.mapping.normalizedName}</p><p className="mt-1 text-slate-600">กลุ่ม: {row.mapping.groupName}</p></> : suggestion ? <><p className="font-semibold text-slate-800">คำแนะนำ: {suggestion.normalizedName}</p><p className="mt-1 text-slate-600">กลุ่มที่แนะนำ: {suggestion.groupName}</p><p className="mt-2 text-xs font-semibold text-amber-800">คำแนะนำยังไม่มีผลกับข้อมูล</p></> : <p className="text-slate-500">ยังไม่มีคำแนะนำ</p>}
                </div>
                <button type="button" onClick={() => selectRow(row)} disabled={busy !== null || refreshing} className="control-button w-full justify-center lg:w-auto"><Pencil className="h-4 w-4" />{row.mapping ? "แก้ไข" : "ตรวจสอบและอนุมัติ"}</button>
              </div>
              {selected && draft && selectedRow && <div className="border-t border-teal-100 bg-white px-4 py-5 sm:px-5">
                <div className="flex items-start justify-between gap-4">
                  <div><h4 className="font-display text-base font-bold text-slate-950">{row.mapping ? "แก้ไข Mapping" : "อนุมัติ Mapping"}</h4><p className="mt-1 text-sm text-slate-600">ชื่อดิบจะคงอยู่ในรายงานเดิม การบันทึกนี้ใช้สำหรับการรวมสถิติและการส่งออก</p></div>
                  <button type="button" onClick={closeEditor} disabled={busy !== null || refreshing} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="ปิดแบบฟอร์ม"><X className="h-5 w-5" /></button>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="field-label">ชื่อดิบ<input value={draft.rawName} readOnly disabled={busy !== null || refreshing} className="control-input mt-1 w-full bg-slate-50 text-slate-600" /></label>
                  <label className="field-label">ประเภท<select value={draft.kind} disabled className="control-select mt-1 w-full"><option value="disease">โรค</option><option value="procedure">หัตถการ</option></select></label>
                  <label className="field-label">ชื่อมาตรฐาน<input list="mapping-normalized-names" maxLength={240} value={draft.normalizedName} onChange={(event) => setDraft({ ...draft, normalizedName: event.target.value })} disabled={busy !== null || refreshing} className="control-input mt-1 w-full" required /></label>
                  <label className="field-label">กลุ่ม<input list="mapping-groups" maxLength={240} value={draft.groupName} onChange={(event) => setDraft({ ...draft, groupName: event.target.value })} disabled={busy !== null || refreshing} className="control-input mt-1 w-full" required /></label>
                </div>
                {suggestion && !row.mapping && <p className="mt-3 text-sm text-amber-800">ค่าตั้งต้นมาจากคำแนะนำ คุณยังแก้ไขได้ก่อนกดอนุมัติ</p>}
                <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                  {row.mapping ? <button type="button" onClick={() => void remove()} disabled={busy !== null || refreshing} className="inline-flex min-h-11 items-center justify-center gap-2 font-semibold text-rose-700 underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-60"><Trash2 className="h-4 w-4" />{busy === "delete" ? "กำลังลบ…" : "ลบ Mapping"}</button> : <span className="text-xs text-slate-500">การอนุมัติต้องกดบันทึกด้วยตนเอง</span>}
                  <div className="flex flex-col gap-3 sm:flex-row"><button type="button" onClick={closeEditor} disabled={busy !== null || refreshing} className="control-button w-full sm:w-auto">ยกเลิก</button><button type="button" onClick={() => void save()} disabled={busy !== null || refreshing} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"><Check className="h-4 w-4" />{busy === "save" ? "กำลังบันทึก…" : row.mapping ? "บันทึกการแก้ไข" : "อนุมัติ Mapping"}</button></div>
                </div>
              </div>}
            </article>;
          })}
        </div>}
      </div>
      <datalist id="mapping-normalized-names">{approvedNames.map((name) => <option key={name} value={name} />)}</datalist>
      <datalist id="mapping-groups">{approvedGroups.map((group) => <option key={group} value={group} />)}</datalist>
    </section>
  );
}
