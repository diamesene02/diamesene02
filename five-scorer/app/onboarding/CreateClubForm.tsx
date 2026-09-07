"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { slugify, withSuffix } from "@/lib/slugify";

export default function CreateClubForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const cleanName = name.trim();
    const base = slugify(cleanName);
    if (cleanName.length < 2 || !base) {
      setError("Donne un vrai nom à ton club.");
      return;
    }

    setLoading(true);
    // Le slug peut être pris : on retente avec un suffixe (-2 … -5).
    for (let n = 1; n <= 5; n++) {
      const slug = n === 1 ? base : withSuffix(base, n);
      const res = await authClient.organization.create({
        name: cleanName,
        slug,
      });
      if (!res.error) {
        router.push(`/c/${slug}`);
        return;
      }
      const msg =
        `${res.error.code ?? ""} ${res.error.message ?? ""}`.toLowerCase();
      if (!msg.includes("slug")) {
        setError("Impossible de créer le club. Réessaie dans un instant.");
        setLoading(false);
        return;
      }
    }
    setError("Ce nom de club est déjà très demandé — essaie une variante.");
    setLoading(false);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <input
        type="text"
        name="clubName"
        required
        placeholder="FC Les Potos du Jeudi"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full flex-1 rounded-[2px] border border-[color:var(--rule)] bg-[color:var(--pitch-2)] px-3 py-2.5 outline-none focus:border-[color:var(--ink-1)]"
      />
      <button
        type="submit"
        disabled={loading}
        className="btn primary tap shrink-0"
      >
        {loading ? "Création…" : "Créer le club"}
      </button>
      {error && (
        <p className="rounded-[2px] border border-[color:var(--loss)] bg-[color:var(--pitch-2)] px-3 py-2 text-sm font-bold text-[color:var(--loss)] sm:basis-full">
          {error}
        </p>
      )}
    </form>
  );
}
