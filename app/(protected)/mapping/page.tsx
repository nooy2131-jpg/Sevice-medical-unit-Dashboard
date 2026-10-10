import { AuthError, requireAdmin } from "@/src/lib/authorization";
import { MappingClient } from "@/src/components/MappingClient";
import { redirect } from "next/navigation";

export default async function MappingPage() {
  try {
    await requireAdmin();
  } catch (reason) {
    if (reason instanceof AuthError && reason.status === 403) redirect("/dashboard");
    throw reason;
  }
  return <MappingClient />;
}
