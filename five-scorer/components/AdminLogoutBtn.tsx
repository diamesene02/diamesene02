"use client";

import { useRouter } from "next/navigation";

export default function AdminLogoutBtn({ className }: { className: string }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/admin", { method: "DELETE" });
    router.replace("/");
    router.refresh();
  }

  return (
    <button type="button" onClick={logout} className={className}>
      Verrouiller
    </button>
  );
}
