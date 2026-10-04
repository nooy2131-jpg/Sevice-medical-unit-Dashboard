import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/src/lib/authorization';
import { ProtectedNav } from '@/src/components/ProtectedNav';

export default async function ProtectedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  try {
    const user = await requireUser();
    return <div className="min-h-screen bg-slate-50 text-slate-900"><header className="sticky top-0 z-30 border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6"><Link href="/dashboard" className="font-display text-base font-bold tracking-tight text-slate-950">รพ.องครักษ์ · หน่วยบริการชั่วคราว</Link><ProtectedNav user={user} /></div></header><main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main></div>;
  } catch (reason) {
    if (reason instanceof Error && 'status' in reason && (reason as Error & { status?: number }).status === 401) redirect('/login');
    throw reason;
  }
}
