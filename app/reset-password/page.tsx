'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { authClient } from '@/src/lib/auth-client';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await authClient.requestPasswordReset({ email, redirectTo: `${window.location.origin}/reset-password/new` });
      if (result.error) setError('ไม่สามารถส่งลิงก์รีเซ็ตได้ กรุณาลองใหม่อีกครั้ง');
      else setSent(true);
    } catch {
      setError('ไม่สามารถส่งลิงก์รีเซ็ตได้ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่');
    } finally {
      setBusy(false);
    }
  }

  return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12"><section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm"><p className="mb-3 text-sm font-semibold text-teal-700">รพ.องครักษ์ · หน่วยบริการชั่วคราว</p><h1 className="text-2xl font-bold tracking-tight text-slate-900">รีเซ็ตรหัสผ่าน</h1>{sent ? <div className="mt-6 space-y-4"><p className="text-slate-700">หากอีเมลนี้เป็นบัญชีที่ได้รับอนุญาต ระบบจะส่งลิงก์รีเซ็ตไปให้</p><Link href="/login" className="inline-flex font-semibold text-teal-700 underline underline-offset-4">กลับเข้าสู่ระบบ</Link></div> : <form onSubmit={submit} className="mt-6 space-y-5"><label className="block text-sm font-medium text-slate-700">อีเมล<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5" autoComplete="email" /></label>{error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}<button disabled={busy} className="w-full rounded-lg bg-teal-700 px-4 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">{busy ? 'กำลังส่งลิงก์…' : 'ส่งลิงก์รีเซ็ต'}</button></form>}</section></main>;
}
