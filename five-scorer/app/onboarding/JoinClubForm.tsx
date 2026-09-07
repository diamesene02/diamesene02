"use client";

import { useState } from "react";
import { joinClubByCode } from "@/app/actions/club";

export default function JoinClubForm() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!code.trim()) return;
    setLoading(true);
    // Succès → l'action serveur redirige vers le club ; sinon elle renvoie l'erreur.
    const res = await joinClubByCode(code);
    if (res && res.ok === false) {
      setError(res.error);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <input
        type="text"
        name="inviteCode"
        required
        placeholder="Code d'invitation"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className="w-full flex-1 rounded-[2px] border border-[color:var(--rule)] bg-[color:var(--pitch-2)] px-3 py-2.5 font-mono outline-none focus:border-[color:var(--ink-1)]"
      />
      <button
        type="submit"
        disabled={loading}
        className="btn shrink-0 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "…" : "Rejoindre"}
      </button>
      {error && (
        <p className="rounded-[2px] border border-[color:var(--loss)] bg-[color:var(--pitch-2)] px-3 py-2 text-sm font-bold text-[color:var(--loss)] sm:basis-full">
          {error}
        </p>
      )}
    </form>
  );
}
