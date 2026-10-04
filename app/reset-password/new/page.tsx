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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const result = await authClient.resetPassword({ newPassword: password, token });
    if (result.error) setError('ลิงก์รีเซ็ตไม่ถูกต้องหรือหมดอายุ');
    else setDone(true);
  }

  return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12"><section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm"><h1 className="text-2xl font-bold tracking-tight text-slate-900">ตั้งรหัสผ่านใหม่</h1>{done ? <div className="mt-6 space-y-4"><p className="text-slate-700">ตั้งรหัสผ่านเรียบร้อยแล้ว</p><Link href="/login" className="font-semibold text-teal-700 underline underline-offset-4">เข้าสู่ระบบ</Link></div> : <form onSubmit={submit} className="mt-6 space-y-5"><label className="block text-sm font-medium text-slate-700">รหัสผ่านใหม่<input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5" autoComplete="new-password" /></label>{error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}<button disabled={!token} className="w-full rounded-lg bg-teal-700 px-4 py-2.5 font-semibold text-white disabled:opacity-50">บันทึกรหัสผ่าน</button></form>}</section></main>;
}

export default function NewPasswordPage() {
  return <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-slate-50 px-4"><p className="text-slate-600">กำลังโหลด…</p></main>}><NewPasswordForm /></Suspense>;
}
