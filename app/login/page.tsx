'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { authClient } from '@/src/lib/auth-client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await authClient.signIn.email({ email, password, callbackURL: '/' });
    if (result.error) setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง หรือบัญชียังไม่ได้รับอนุญาต');
    else window.location.assign('/');
    setBusy(false);
  }

  async function signInGoogle() {
    setBusy(true);
    setError(null);
    const result = await authClient.signIn.social({ provider: 'google', callbackURL: '/' });
    if (result.error) {
      setError('ไม่สามารถเข้าสู่ระบบด้วย Google ได้ กรุณาตรวจสอบคำเชิญของคุณ');
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="mb-3 text-sm font-semibold text-teal-700">รพ.องครักษ์ · หน่วยบริการชั่วคราว</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">เข้าสู่ระบบ</h1>
        <p className="mt-2 text-sm text-slate-600">ใช้บัญชีที่ได้รับคำเชิญจาก Admin</p>
        <form className="mt-7 space-y-5" onSubmit={submit}>
          <label className="block text-sm font-medium text-slate-700">
            อีเมล
            <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            รหัสผ่าน
            <input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900" />
          </label>
          {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
          <button disabled={busy} className="w-full rounded-lg bg-teal-700 px-4 py-2.5 font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60">{busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}</button>
        </form>
        <div className="my-6 flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" />หรือ<span className="h-px flex-1 bg-slate-200" /></div>
        <button type="button" disabled={busy} onClick={signInGoogle} className="w-full rounded-lg border border-slate-300 px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">เข้าสู่ระบบด้วย Google</button>
        <p className="mt-6 text-center text-sm text-slate-600"><Link href="/reset-password" className="font-semibold text-teal-700 underline underline-offset-4">ลืมรหัสผ่าน?</Link></p>
      </section>
    </main>
  );
}
