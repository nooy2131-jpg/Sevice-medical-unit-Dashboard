"use client";

export default function ProtectedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      className="mx-auto max-w-lg rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800"
      role="alert"
    >
      <h1 className="font-display text-lg font-bold">
        เกิดข้อผิดพลาดในการโหลดข้อมูล
      </h1>
      <p className="mt-2">{error.message || "กรุณาลองใหม่อีกครั้ง"}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-lg bg-rose-700 px-4 py-2 font-semibold text-white hover:bg-rose-800"
      >
        ลองใหม่
      </button>
    </div>
  );
}
