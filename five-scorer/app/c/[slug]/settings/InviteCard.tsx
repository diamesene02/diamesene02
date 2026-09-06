"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { regenerateInviteCode } from "@/app/actions/club";

export default function InviteCard({
  slug,
  inviteCode,
}: {
  slug: string;
  inviteCode: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const url = `${origin}/join/${inviteCode}`;
  const waText = encodeURIComponent(
    `⚽ Rejoins notre club sur Five Scorer — clique ici et t'es dans l'équipe : ${url}`
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Impossible de copier — sélectionne le lien à la main.");
    }
  }

  function regenerate() {
    setError(null);
    startTransition(async () => {
      const res = await regenerateInviteCode(slug);
      if (!res.ok) {
        setError(res.error ?? "Erreur");
      } else {
        setConfirming(false);
        router.refresh();
      }
    });
  }

  return (
    <section className="rounded-3xl border border-[color:var(--stroke)] bg-[color:var(--bg-1)] p-5 sm:p-6">
      <h2 className="kicker">Inviter</h2>
      <p className="mt-2 text-sm text-[color:var(--ink-1)]">
        Partage ce lien : celui qui clique rejoint le club direct.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <code className="flex min-h-[44px] min-w-0 flex-1 items-center truncate rounded-lg border border-[color:var(--stroke)] bg-[color:var(--bg-2)] px-3 text-sm text-[color:var(--lime)]">
          {origin ? url : `…/join/${inviteCode}`}
        </code>
        <button
          onClick={copy}
          className="inline-flex min-h-[44px] items-center rounded-full border border-[color:var(--stroke-hi)] bg-[color:var(--bg-2)] px-4 text-sm font-bold hover:border-[color:var(--lime)]"
        >
          {copied ? "Copié" : "Copier"}
        </button>
        <a
          href={`https://wa.me/?text=${waText}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-[44px] items-center rounded-full border border-[color:var(--a-500)]/40 bg-[color:var(--a-wash)] px-4 text-sm font-bold text-[color:var(--a-400)] hover:border-[color:var(--a-500)]"
        >
          WhatsApp
        </a>
      </div>

      <div className="mt-4 border-t border-[color:var(--stroke)] pt-4">
        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="inline-flex min-h-[44px] items-center text-xs font-bold uppercase tracking-wider text-[color:var(--ink-2)] hover:text-white"
          >
            Régénérer le code
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-[color:var(--ink-1)]">
              L&apos;ancien lien ne marchera plus. Sûr ?
            </span>
            <button
              onClick={regenerate}
              disabled={isPending}
              className="inline-flex min-h-[44px] items-center rounded-full bg-[color:var(--loss)]/20 px-4 text-xs font-black uppercase tracking-wider text-[color:var(--loss)] disabled:opacity-50"
            >
              {isPending ? "…" : "Oui, régénérer"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="inline-flex min-h-[44px] items-center text-xs font-bold text-[color:var(--ink-2)] hover:text-white"
            >
              Annuler
            </button>
          </div>
        )}
        {error && (
          <p className="mt-2 text-sm text-[color:var(--loss)]">{error}</p>
        )}
      </div>
    </section>
  );
}
