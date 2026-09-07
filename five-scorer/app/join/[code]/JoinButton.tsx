"use client";

import { useState } from "react";
import { joinClubByCode } from "@/app/actions/club";

export default function JoinButton({ code }: { code: string }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onJoin() {
    setError(null);
    setLoading(true);
    // Succès → l'action serveur redirige vers le club ; sinon elle renvoie l'erreur.
    const res = await joinClubByCode(code);
    if (res && res.ok === false) {
      setError(res.error);
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={onJoin}
        disabled={loading}
        className="btn primary big w-full disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "On te fait entrer…" : "Rejoindre le club"}
      </button>
      {error && (
        <p className="rounded-[2px] border border-[color:var(--loss)] bg-[color:var(--pitch-2)] px-3 py-2 text-sm font-bold text-[color:var(--loss)]">
          {error}
        </p>
      )}
    </div>
  );
}
