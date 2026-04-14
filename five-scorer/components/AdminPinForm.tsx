"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminPinForm({ next }: { next?: string }) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/admin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Accès refusé");
      }
      router.replace(next || "/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-3">
      <input
        type="tel"
        inputMode="numeric"
        autoComplete="off"
        autoFocus
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
        maxLength={12}
        placeholder="····"
        className="w-full rounded-lg border border-[color:var(--stroke)] bg-[color:var(--bg-2)] px-4 py-3 text-center font-mono text-2xl tracking-[0.6em]"
      />
      {error && (
        <div className="rounded-lg bg-red-900/30 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={busy || !pin}
        className="btn primary big w-full"
      >
        {busy ? "…" : "Déverrouiller"}
      </button>
    </form>
  );
}
