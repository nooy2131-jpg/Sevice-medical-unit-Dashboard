'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { authClient } from '@/src/lib/auth-client';

type User = { name?: string | null; email?: string | null; role: 'admin' | 'member' };

export function ProtectedNav({ user }: { user: User }) {
  const pathname = usePathname();
  const router = useRouter();
  const links = [{ href: '/dashboard', label: 'ภาพรวมสถิติ' }, { href: '/records', label: 'รายงานย้อนหลัง' }];
  if (user.role === 'admin') links.push({ href: '/settings', label: 'ตั้งค่า' });
  return <div className="flex items-center gap-3"><nav className="hidden items-center gap-5 text-sm font-semibold text-slate-600 sm:flex" aria-label="เมนูหลัก">{links.map((link) => <Link key={link.href} href={link.href} className={pathname.startsWith(link.href) ? 'text-teal-700 underline decoration-2 underline-offset-8' : 'hover:text-slate-950'}>{link.label}</Link>)}</nav><div className="hidden text-right sm:block"><p className="text-xs font-semibold text-slate-900">{user.name ?? user.email ?? 'ผู้ใช้งาน'}</p><p className="text-[11px] text-slate-500">{user.role === 'admin' ? 'Admin' : 'Member'}</p></div><button type="button" onClick={async () => { await authClient.signOut(); router.replace('/login'); router.refresh(); }} className="control-button px-3">ออกจากระบบ</button></div>;
}
