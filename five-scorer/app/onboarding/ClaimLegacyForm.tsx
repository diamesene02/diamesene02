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
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <input
        type="password"
        name="legacyPin"
        required
        placeholder="Ancien PIN admin"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        inputMode="numeric"
        autoComplete="off"
        className="w-full"
      />
      <button
        type="submit"
        disabled={loading}
        className="plein"
      >
        {loading ? "Vérification…" : "Revendiquer"}
      </button>
      {error && (
        <p className="bv-erreur">
          {error}
        </p>
      )}
    </form>
  );
}
