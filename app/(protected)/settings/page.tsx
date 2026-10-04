import { requireUser } from "@/src/lib/authorization";

export default async function SettingsPage() {
  const user = await requireUser();
  if (user.role !== "admin")
    return (
      <div
        className="mx-auto max-w-xl rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900"
        role="alert"
      >
        <h1 className="font-display text-lg font-bold">ไม่มีสิทธิ์เข้าถึง</h1>
        <p className="mt-2">เฉพาะ Admin เท่านั้นที่จัดการสมาชิกและคำเชิญได้</p>
      </div>
    );
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="border-b border-slate-200 pb-5">
        <p className="text-sm text-slate-500">จัดการการเข้าถึงระบบ</p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-950">
          ตั้งค่าและสมาชิก
        </h1>
      </div>
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-display text-base font-bold text-slate-900">
          ผู้ดูแลระบบ
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          การจัดการคำเชิญ บทบาท และสถานะบัญชีจะอยู่ในส่วนนี้
        </p>
        <p className="mt-4 text-sm text-slate-700">
          บัญชีปัจจุบัน: <strong>{user.name ?? user.email}</strong>
        </p>
      </section>
    </div>
  );
}
