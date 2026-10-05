'use client';

import { FormEvent, Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { authClient } from '@/src/lib/auth-client';

function NewPasswordForm() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const tokenError = token ? null : 'ไม่พบ token ของลิงก์รีเซ็ต กรุณาขอลิงก์ใหม่อีกครั้ง';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      setError('ไม่พบ token ของลิงก์รีเซ็ต กรุณาขอลิงก์ใหม่อีกครั้ง');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await authClient.resetPassword({ newPassword: password, token });
      if (result.error) setError('ลิงก์รีเซ็ตไม่ถูกต้องหรือหมดอายุ');
      else setDone(true);
    } catch {
      setError('ไม่สามารถตั้งรหัสผ่านใหม่ได้ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8" aria-labelledby="new-password-title">
        <p className="mb-3 text-sm font-semibold text-teal-700">รพ.องครักษ์ · หน่วยบริการชั่วคราว</p>
        <h1 id="new-password-title" className="text-2xl font-bold tracking-tight text-slate-900">ตั้งรหัสผ่านใหม่</h1>
        {done ? <div className="mt-6 space-y-4"><p className="text-sm leading-6 text-slate-700">ตั้งรหัสผ่านเรียบร้อยแล้ว</p><Link href="/login" className="font-semibold text-teal-700 underline underline-offset-4">เข้าสู่ระบบ</Link></div> : <form onSubmit={submit} className="mt-6 space-y-5" aria-busy={busy}>
          <label className="field-label" htmlFor="new-password">รหัสผ่านใหม่<input id="new-password" required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="control-input mt-1 w-full" autoComplete="new-password" /></label>
          <p className="text-xs leading-5 text-slate-500">ใช้รหัสผ่านที่มีอย่างน้อย 8 ตัวอักษร</p>
          {(tokenError ?? error) && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{tokenError ?? error}</p>}
          {tokenError && <Link href="/reset-password" className="control-button min-h-11 w-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-50">ขอลิงก์รีเซ็ตใหม่</Link>}
          <button type="submit" disabled={!token || busy} className="control-button min-h-11 w-full bg-teal-700 text-white hover:bg-teal-800">{busy ? 'กำลังบันทึก…' : 'บันทึกรหัสผ่าน'}</button>
        </form>}
      </section>
    </main>
  );
}

export default function NewPasswordPage() {
  return <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-slate-50 px-4"><p className="text-slate-600">กำลังโหลด…</p></main>}><NewPasswordForm /></Suspense>;
}
