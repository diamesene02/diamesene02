"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function PinGate() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/pin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error || "PIN invalide");
      setPin("");
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <form
      onSubmit={submit}
      className="w-full max-w-sm space-y-6 rounded-2xl bg-white/5 p-8"
    >
      <div>
        <h1 className="text-2xl font-bold">Code d'accès</h1>
        <p className="mt-1 text-sm text-gray-400">
          Saisis le PIN pour accéder à la saisie des matchs.
        </p>
      </div>
      <input
        autoFocus
        inputMode="numeric"
        pattern="[0-9]*"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        className="w-full rounded-xl bg-black/40 px-4 py-4 text-center text-3xl tracking-[0.5em] outline-none ring-2 ring-transparent focus:ring-pitch-500"
        placeholder="••••"
        maxLength={8}
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        disabled={loading || pin.length === 0}
        className="big-touch w-full rounded-xl bg-pitch-600 py-4 text-lg font-semibold disabled:opacity-50"
      >
        {loading ? "…" : "Déverrouiller"}
      </button>
    </form>
  );
}
