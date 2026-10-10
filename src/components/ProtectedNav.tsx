"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/src/lib/auth-client";
import { todayBangkok } from "@/src/lib/dates";

type User = {
  name?: string | null;
  email?: string | null;
  role: "admin" | "member";
};

export function ProtectedNav({ user }: { user: User }) {
  const pathname = usePathname();
  const router = useRouter();
  const links = [
    { href: "/dashboard", label: "ภาพรวมสถิติ" },
    { href: "/records", label: "รายงานย้อนหลัง" },
    { href: `/reports/${todayBangkok()}`, label: "บันทึกวันนี้" },
  ];
  if (user.role === "admin") {
    links.push({ href: "/mapping", label: "จัดการ Mapping" });
    links.push({ href: "/settings", label: "ตั้งค่า" });
  }
  const isLinkActive = (href: string) =>
    href.startsWith("/reports/")
      ? pathname.startsWith("/reports/")
      : pathname.startsWith(href);
  const isLinkCurrent = (href: string) => pathname === href;
  return (
    <div className="flex w-full min-w-0 flex-col gap-3 lg:w-auto lg:flex-row lg:items-center lg:gap-3">
      <nav
        className="hidden items-center gap-5 text-sm font-semibold text-slate-600 lg:flex"
        aria-label="เมนูหลัก"
      >
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={
              isLinkActive(link.href)
                ? "text-teal-700 underline decoration-2 underline-offset-8"
                : "hover:text-slate-950"
            }
            aria-current={isLinkCurrent(link.href) ? "page" : undefined}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <nav
        className="flex w-full min-w-0 items-center gap-4 overflow-x-auto border-y border-slate-100 py-1 whitespace-nowrap text-sm font-semibold text-slate-600 lg:hidden"
        aria-label="เมนูหลักบนมือถือ"
      >
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={
              isLinkActive(link.href)
                ? "inline-flex min-h-11 shrink-0 items-center text-teal-700"
                : "inline-flex min-h-11 shrink-0 items-center hover:text-slate-950"
            }
            aria-current={isLinkCurrent(link.href) ? "page" : undefined}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="hidden text-right sm:block">
        <p className="text-xs font-semibold text-slate-900">
          {user.name ?? user.email ?? "ผู้ใช้งาน"}
        </p>
        <p className="text-[11px] text-slate-500">
          {user.role === "admin" ? "Admin" : "Member"}
        </p>
      </div>
      <button
        type="button"
        onClick={async () => {
          await authClient.signOut();
          router.replace("/login");
          router.refresh();
        }}
        className="control-button w-full shrink-0 px-3 lg:w-auto"
      >
        ออกจากระบบ
      </button>
    </div>
  );
}
