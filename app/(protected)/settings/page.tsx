'use client';

import { FormEvent, useEffect, useState } from 'react';

type Role = 'admin' | 'member';
type User = { id: string; name: string; email: string; role: Role; active: boolean; createdAt: string; updatedAt: string };
type Invitation = { id: string; email: string; role: Role; expiresAt: string; consumedAt: string | null; revokedAt: string | null; createdAt: string };
type BusyAction = 'invite' | `user:${string}` | `revoke:${string}` | `resend:${string}`;

export default function SettingsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('member');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<BusyAction | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [usersResponse, invitationsResponse] = await Promise.all([fetch('/api/users'), fetch('/api/invitations')]);
      let loadError: string | null = null;
      if (usersResponse.ok) {
        const data = (await usersResponse.json()) as { users: User[] };
        setUsers(data.users);
      } else {
        loadError = 'คุณไม่มีสิทธิ์เข้าถึงการตั้งค่าผู้ใช้';
      }
      if (invitationsResponse.ok) {
        const data = (await invitationsResponse.json()) as { invitations: Invitation[] };
        setInvitations(data.invitations);
      } else {
        loadError ??= 'ไม่สามารถโหลดรายการคำเชิญได้';
      }
      if (loadError) setError(loadError);
    } catch {
      setError('ไม่สามารถโหลดข้อมูลการตั้งค่าได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyAction('invite');
    setStatus(null);
    setError(null);
    try {
      const response = await fetch('/api/invitations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, role }) });
      const data = (await response.json()) as { error?: { message?: string }; delivery?: 'sent' | 'skipped' };
      if (!response.ok) setError(data.error?.message ?? 'สร้างคำเชิญไม่สำเร็จ');
      else {
        setEmail('');
        setStatus(data.delivery === 'sent' ? 'ส่งคำเชิญแล้ว' : 'บันทึกคำเชิญแล้ว แต่ยังไม่ได้ส่งอีเมล (ตรวจสอบ Resend)');
        await load();
      }
    } catch {
      setError('สร้างคำเชิญไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่');
    } finally {
      setBusyAction(null);
    }
  }

  async function updateUser(user: User, patch: { role?: Role; active?: boolean }) {
    const action: BusyAction = `user:${user.id}`;
    setBusyAction(action);
    setError(null);
    try {
      const response = await fetch(`/api/users/${user.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) });
      const data = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) setError(data.error?.message ?? 'แก้ไขสิทธิ์ไม่สำเร็จ');
      else {
        setStatus('บันทึกสิทธิ์ผู้ใช้แล้ว');
        await load();
      }
    } catch {
      setError('แก้ไขสิทธิ์ไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่');
    } finally {
      setBusyAction(null);
    }
  }

  async function revoke(id: string) {
    const action: BusyAction = `revoke:${id}`;
    setBusyAction(action);
    setError(null);
    try {
      const response = await fetch(`/api/invitations/${id}`, { method: 'DELETE' });
      if (!response.ok) setError('ยกเลิกคำเชิญไม่สำเร็จ');
      else {
        setStatus('ยกเลิกคำเชิญแล้ว');
        await load();
      }
    } catch {
      setError('ยกเลิกคำเชิญไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่');
    } finally {
      setBusyAction(null);
    }
  }

  async function resend(id: string) {
    const action: BusyAction = `resend:${id}`;
    setBusyAction(action);
    setError(null);
    try {
      const response = await fetch(`/api/invitations/${id}`, { method: 'POST' });
      const data = (await response.json()) as { error?: { message?: string }; delivery?: 'sent' | 'skipped' };
      if (!response.ok) setError(data.error?.message ?? 'ส่งคำเชิญอีกครั้งไม่สำเร็จ');
      else {
        setStatus(data.delivery === 'sent' ? 'ส่งคำเชิญอีกครั้งแล้ว' : 'สร้างคำเชิญใหม่แล้ว แต่ยังไม่ได้ส่งอีเมล');
        await load();
      }
    } catch {
      setError('ส่งคำเชิญอีกครั้งไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่');
    } finally {
      setBusyAction(null);
    }
  }

  return <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6"><div className="mb-8"><h1 className="text-3xl font-bold tracking-tight text-slate-900">ตั้งค่าการใช้งาน</h1><p className="mt-2 text-slate-600">จัดการคำเชิญ สิทธิ์ และสถานะบัญชี</p></div>{status && <p role="status" className="mb-4 rounded-lg bg-teal-50 px-4 py-3 text-sm text-teal-800">{status}</p>}{error && <p role="alert" className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}<section className="mb-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold text-slate-900">เชิญผู้ใช้งาน</h2><form onSubmit={invite} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]"><label className="block text-sm font-medium text-slate-700" htmlFor="invite-email">อีเมลผู้รับคำเชิญ<input id="invite-email" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label><label className="block text-sm font-medium text-slate-700" htmlFor="invite-role">สิทธิ์<select id="invite-role" value={role} onChange={(event) => setRole(event.target.value as Role)} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5"><option value="member">Member</option><option value="admin">Admin</option></select></label><button disabled={busyAction !== null} className="self-end rounded-lg bg-teal-700 px-4 py-2.5 font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60">{busyAction === 'invite' ? 'กำลังส่ง…' : 'ส่งคำเชิญ'}</button></form></section><section className="mb-8 rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-5 py-4"><h2 className="text-lg font-semibold text-slate-900">บัญชีผู้ใช้งาน</h2></div>{loading ? <p className="p-5 text-sm text-slate-500">กำลังโหลด…</p> : <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="px-5 py-3 font-semibold">ผู้ใช้</th><th className="px-5 py-3 font-semibold">สิทธิ์</th><th className="px-5 py-3 font-semibold">สถานะ</th><th className="px-5 py-3 font-semibold">จัดการ</th></tr></thead><tbody className="divide-y divide-slate-200">{users.map((user) => { const action: BusyAction = `user:${user.id}`; return <tr key={user.id}><td className="px-5 py-4"><p className="font-medium text-slate-900">{user.name}</p><p className="text-slate-500">{user.email}</p></td><td className="px-5 py-4"><select aria-label={`สิทธิ์ของ ${user.email}`} disabled={busyAction !== null} value={user.role} onChange={(event) => void updateUser(user, { role: event.target.value as Role })} className="rounded-md border border-slate-300 px-2 py-1"><option value="member">Member</option><option value="admin">Admin</option></select></td><td className="px-5 py-4"><span className={user.active ? 'text-teal-700' : 'text-slate-500'}>{user.active ? 'ใช้งานอยู่' : 'ปิดการใช้งาน'}</span></td><td className="px-5 py-4"><button type="button" disabled={busyAction !== null} onClick={() => void updateUser(user, { active: !user.active })} className="font-semibold text-teal-700 underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-60">{busyAction === action ? 'กำลังบันทึก…' : user.active ? 'ปิดการใช้งาน' : 'เปิดการใช้งาน'}</button></td></tr>; })}</tbody></table></div>}</section><section className="rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-5 py-4"><h2 className="text-lg font-semibold text-slate-900">คำเชิญล่าสุด</h2></div><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="px-5 py-3 font-semibold">อีเมล</th><th className="px-5 py-3 font-semibold">สิทธิ์</th><th className="px-5 py-3 font-semibold">หมดอายุ</th><th className="px-5 py-3 font-semibold">สถานะ</th><th className="px-5 py-3 font-semibold">จัดการ</th></tr></thead><tbody className="divide-y divide-slate-200">{invitations.map((invitation) => { const resendAction: BusyAction = `resend:${invitation.id}`; const revokeAction: BusyAction = `revoke:${invitation.id}`; return <tr key={invitation.id}><td className="px-5 py-4 text-slate-900">{invitation.email}</td><td className="px-5 py-4">{invitation.role}</td><td className="px-5 py-4 text-slate-600">{new Date(invitation.expiresAt).toLocaleDateString('th-TH')}</td><td className="px-5 py-4">{invitation.consumedAt ? 'ใช้แล้ว' : invitation.revokedAt ? 'ยกเลิกแล้ว' : 'รอดำเนินการ'}</td><td className="px-5 py-4"><div className="flex gap-3">{!invitation.consumedAt && !invitation.revokedAt && <><button type="button" disabled={busyAction !== null} onClick={() => void resend(invitation.id)} className="font-semibold text-teal-700 underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-60">{busyAction === resendAction ? 'กำลังส่ง…' : 'ส่งอีกครั้ง'}</button><button type="button" disabled={busyAction !== null} onClick={() => void revoke(invitation.id)} className="font-semibold text-rose-700 underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-60">{busyAction === revokeAction ? 'กำลังยกเลิก…' : 'ยกเลิก'}</button></>}</div></td></tr>; })}</tbody></table></div></section></main>;
}
