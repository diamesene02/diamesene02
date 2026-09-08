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
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
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
        className="w-full"
      />
      <button
        type="submit"
        disabled={loading}
        className="plein"
      >
        {loading ? "…" : "Rejoindre"}
      </button>
      {error && (
        <p className="bv-erreur">
          {error}
        </p>
      )}
    </form>
  );
}
