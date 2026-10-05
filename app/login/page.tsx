'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authClient } from '@/src/lib/auth-client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await authClient.signIn.email({ email, password, callbackURL: '/' });
      if (result.error) setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง หรือบัญชียังไม่ได้รับอนุญาต');
      else router.push('/');
    } catch {
      setError('ไม่สามารถเข้าสู่ระบบได้ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่');
    } finally {
      setBusy(false);
    }
  }

  async function signInGoogle() {
    setBusy(true);
    setError(null);
    try {
      const result = await authClient.signIn.social({ provider: 'google', callbackURL: '/' });
      if (result.error) setError('ไม่สามารถเข้าสู่ระบบด้วย Google ได้ กรุณาตรวจสอบคำเชิญของคุณ');
    } catch {
      setError('ไม่สามารถเข้าสู่ระบบด้วย Google ได้ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8" aria-labelledby="login-title">
        <p className="mb-3 text-sm font-semibold text-teal-700">รพ.องครักษ์ · หน่วยบริการชั่วคราว</p>
        <h1 id="login-title" className="text-2xl font-bold tracking-tight text-slate-900">เข้าสู่ระบบ</h1>
        <p className="mt-2 text-sm text-slate-600">ใช้บัญชีที่ได้รับคำเชิญจาก Admin</p>
        <form className="mt-7 space-y-5" onSubmit={submit} aria-busy={busy}>
          <label className="field-label" htmlFor="login-email">
            อีเมล
            <input id="login-email" required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="control-input mt-1 w-full" />
          </label>
          <label className="field-label" htmlFor="login-password">
            รหัสผ่าน
            <input id="login-password" required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="control-input mt-1 w-full" />
          </label>
          {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
          <button type="submit" disabled={busy} className="control-button min-h-11 w-full bg-teal-700 text-white hover:bg-teal-800">{busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}</button>
        </form>
        <div className="my-6 flex items-center gap-3 text-xs text-slate-500"><span className="h-px flex-1 bg-slate-200" />หรือ<span className="h-px flex-1 bg-slate-200" /></div>
        <button type="button" disabled={busy} onClick={signInGoogle} className="control-button min-h-11 w-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-50">เข้าสู่ระบบด้วย Google</button>
        <p className="mt-6 text-center text-sm text-slate-600"><Link href="/reset-password" className="font-semibold text-teal-700 underline underline-offset-4">ลืมรหัสผ่าน?</Link></p>
      </section>
    </main>
  );
}
