import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/src/lib/authorization";
import { ProtectedNav } from "@/src/components/ProtectedNav";

export default async function ProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch (reason) {
    if (
      reason instanceof Error &&
      "status" in reason &&
      (reason as Error & { status?: number }).status === 401
    )
      redirect("/login");
    throw reason;
  }
  return (
    <div className="app-shell min-h-screen bg-slate-50 text-slate-900">
      <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4 sm:px-6">
          <Link
            href="/dashboard"
            className="font-display max-w-full text-sm font-bold leading-tight tracking-tight text-slate-950 sm:text-base"
          >
            รพ.องครักษ์ · หน่วยบริการชั่วคราว
          </Link>
          <ProtectedNav user={user} />
        </div>
      </header>
      <main className="app-main mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
