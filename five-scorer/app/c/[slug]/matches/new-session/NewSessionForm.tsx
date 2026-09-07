"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createMatchDay } from "@/app/actions/matchday";

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export default function NewSessionForm({ slug }: { slug: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Défaut : demain 19h00 — calculé côté client (fuseau du navigateur).
  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(19, 0, 0, 0);
    setDate(toLocalInput(d));
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = date ? new Date(date) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) {
      setError("Date invalide.");
      return;
    }
    startTransition(async () => {
      const res = await createMatchDay(slug, {
        date: parsed.toISOString(),
        title: title.trim() || undefined,
        location: location.trim() || undefined,
      });
      if (!res.ok) {
        setError(res.error ?? "Erreur");
      } else {
        router.push(`/c/${slug}`);
        router.refresh();
      }
    });
  }

  const inputCls =
 "mt-1 w-full rounded-[2px] border border-[color:var(--rule)] bg-[color:var(--pitch-2)] px-3 py-2 outline-none focus:border-[color:var(--ink-1)]";

  return (
    <form
      onSubmit={submit}
      className="space-y-5 bande"
    >
      <label className="block">
        <span className="kicker">Date & heure</span>
        <input
          type="datetime-local"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          className={inputCls}
        />
      </label>

      <label className="block">
        <span className="kicker">Titre</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Five du jeudi"
          className={inputCls}
        />
      </label>

      <label className="block">
        <span className="kicker">Lieu</span>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Urban Soccer …"
          className={inputCls}
        />
      </label>

      {error && <p className="text-sm text-[color:var(--loss)]">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="big-touch w-full rounded-none bg-[color:var(--ink-1)] py-4 text-lg font-black text-[color:var(--pitch-0)] disabled:opacity-50"
      >
        {isPending ? "Création…" : "Programmer la soirée"}
      </button>

      <p className="text-xs text-[color:var(--ink-2)]">
        Les membres répondront présent depuis l&apos;accueil ; au lancement du
        match, le générateur reprend les présents.
      </p>
    </form>
  );
}
