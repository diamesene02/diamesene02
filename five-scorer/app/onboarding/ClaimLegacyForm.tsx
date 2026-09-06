"use client";

import { useState } from "react";
import { claimLegacy } from "@/app/actions/club";

export default function ClaimLegacyForm() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!pin.trim()) return;
    setLoading(true);
    // Succès → l'action serveur redirige vers le club ; sinon elle renvoie l'erreur.
    const res = await claimLegacy(pin);
    if (res && res.ok === false) {
      setError(res.error);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <input
        type="password"
        name="legacyPin"
        required
        placeholder="Ancien PIN admin"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        inputMode="numeric"
        autoComplete="off"
        className="w-full flex-1 rounded-lg border border-[color:var(--stroke)] bg-[color:var(--bg-2)] px-3 py-2.5 font-mono outline-none focus:border-[color:var(--lime)]"
      />
      <button
        type="submit"
        disabled={loading}
        className="btn primary shrink-0 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Vérification…" : "Revendiquer"}
      </button>
      {error && (
        <p className="rounded-lg border border-[color:var(--loss)] bg-[color:var(--bg-2)] px-3 py-2 text-sm font-bold text-[color:var(--loss)] sm:basis-full">
          {error}
        </p>
      )}
    </form>
  );
}
