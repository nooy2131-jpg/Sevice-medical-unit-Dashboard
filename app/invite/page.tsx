'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

type InviteInfo = { email: string; role: 'admin' | 'member'; expiresAt: string };

export default function InvitePage() {
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
    const response = await fetch('/api/invitations/accept', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, name, password }) });
    const data = (await response.json()) as { error?: { message?: string } };
    if (!response.ok) setError(data.error?.message ?? 'ไม่สามารถสร้างบัญชีได้');
    else setDone(true);
    setBusy(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="mb-3 text-sm font-semibold text-teal-700">รพ.องครักษ์ · หน่วยบริการชั่วคราว</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">เข้าร่วมระบบรายงาน</h1>
        {!token && <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">ไม่พบ token ของคำเชิญ</p>}
        {error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
        {done ? <div className="mt-6 space-y-4"><p className="text-slate-700">สร้างบัญชีเรียบร้อยแล้ว คุณสามารถเข้าสู่ระบบได้ทันที</p><Link href="/login" className="inline-flex rounded-lg bg-teal-700 px-4 py-2.5 font-semibold text-white">ไปหน้าเข้าสู่ระบบ</Link></div> : invite && <form onSubmit={submit} className="mt-6 space-y-5">
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700"><p>{invite.email}</p><p className="mt-1 text-xs text-slate-500">สิทธิ์ {invite.role === 'admin' ? 'Admin' : 'Member'} · หมดอายุ {new Date(invite.expiresAt).toLocaleString('th-TH')}</p></div>
          <label className="block text-sm font-medium text-slate-700">ชื่อที่แสดง<input required value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5" autoComplete="name" /></label>
          <label className="block text-sm font-medium text-slate-700">รหัสผ่าน<input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5" autoComplete="new-password" /><span className="mt-1 block text-xs font-normal text-slate-500">อย่างน้อย 8 ตัวอักษร</span></label>
          <button disabled={busy} className="w-full rounded-lg bg-teal-700 px-4 py-2.5 font-semibold text-white hover:bg-teal-800 disabled:opacity-60">{busy ? 'กำลังสร้างบัญชี…' : 'สร้างบัญชี'}</button>
        </form>}
      </section>
    </main>
  );
}
