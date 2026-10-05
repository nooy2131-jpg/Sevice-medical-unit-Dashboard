'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

type InviteInfo = { email: string; role: 'admin' | 'member'; expiresAt: string };

function InviteForm() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    void fetch(`/api/invitations/accept?token=${encodeURIComponent(token)}`)
      .then(async (response) => {
        const data = (await response.json()) as { invitation?: InviteInfo; error?: { message?: string } };
        if (!response.ok || !data.invitation) throw new Error(data.error?.message ?? 'ลิงก์คำเชิญใช้ไม่ได้');
        setInvite(data.invitation);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'ลิงก์คำเชิญใช้ไม่ได้'));
  }, [token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/invitations/accept', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, name, password }) });
      const data = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) setError(data.error?.message ?? 'ไม่สามารถสร้างบัญชีได้');
      else setDone(true);
    } catch {
      setError('ไม่สามารถสร้างบัญชีได้ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8" aria-labelledby="invite-title">
        <p className="mb-3 text-sm font-semibold text-teal-700">รพ.องครักษ์ · หน่วยบริการชั่วคราว</p>
        <h1 id="invite-title" className="text-2xl font-bold tracking-tight text-slate-900">เข้าร่วมระบบรายงาน</h1>
        {!token && <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">ไม่พบ token ของคำเชิญ</p>}
        {error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
        {!done && !invite && token && !error && <p className="mt-6 text-sm text-slate-500" role="status">กำลังตรวจสอบคำเชิญ…</p>}
        {done ? <div className="mt-6 space-y-4"><p className="text-slate-700">สร้างบัญชีเรียบร้อยแล้ว คุณสามารถเข้าสู่ระบบได้ทันที</p><Link href="/login" className="control-button inline-flex min-h-11 bg-teal-700 text-white hover:bg-teal-800">ไปหน้าเข้าสู่ระบบ</Link></div> : invite && <form onSubmit={submit} className="mt-6 space-y-5" aria-busy={busy}>
          <div className="rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-700"><p>{invite.email}</p><p className="mt-1 text-xs text-slate-500">สิทธิ์ {invite.role === 'admin' ? 'Admin' : 'Member'} · หมดอายุ {new Date(invite.expiresAt).toLocaleString('th-TH')}</p></div>
          <label className="field-label" htmlFor="invite-name">ชื่อที่แสดง<input id="invite-name" required value={name} onChange={(event) => setName(event.target.value)} className="control-input mt-1 w-full" autoComplete="name" /></label>
          <label className="field-label" htmlFor="invite-password">รหัสผ่าน<input id="invite-password" required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="control-input mt-1 w-full" autoComplete="new-password" /><span className="mt-1 block text-xs font-normal text-slate-500">อย่างน้อย 8 ตัวอักษร</span></label>
          <button type="submit" disabled={busy} className="control-button min-h-11 w-full bg-teal-700 text-white hover:bg-teal-800">{busy ? 'กำลังสร้างบัญชี…' : 'สร้างบัญชี'}</button>
        </form>}
      </section>
    </main>
  );
}

export default function InvitePage() {
  return <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-slate-50 px-4"><p className="text-slate-600">กำลังตรวจสอบคำเชิญ…</p></main>}><InviteForm /></Suspense>;
}
