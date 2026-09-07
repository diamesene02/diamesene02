"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setMemberRole, removeMember } from "@/app/actions/club";

type MemberRow = {
  id: string;
  userId: string;
  name: string;
  email: string;
  playerName: string | null;
  role: string;
};

export default function MembersTable({
  slug,
  currentUserId,
  members,
}: {
  slug: string;
  currentUserId: string;
  members: MemberRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        setError(res.error ?? "Erreur");
      } else {
        setConfirmId(null);
        router.refresh();
      }
    });
  }

  return (
    <section className="bande">
      <h2 className="kicker">Membres</h2>
      <p className="mt-2 text-sm tabular-nums text-[color:var(--ink-1)]">
        {members.length} membre{members.length > 1 ? "s" : ""} dans le club.
      </p>

      {error && (
        <p className="mt-3 text-sm text-[color:var(--loss)]">{error}</p>
      )}

      {/* Un tableau de quatre colonnes large de 560 px qu'il fallait faire
          glisser en travers d'un écran de 375 : le nom d'un membre et le
          bouton qui le retire ne se voyaient jamais ensemble. Chaque membre
          tient maintenant dans un bloc, et l'action est sous les yeux. */}
      <ul className="mt-4">
        {members.map((m) => {
          const isOwner = m.role === "owner";
          return (
            <li
              key={m.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[color:var(--rule)] py-3 first:border-t-0"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-[color:var(--ink-1)]">
                  {m.name}
                  {m.userId === currentUserId && (
                    <span className="ml-1.5 font-normal text-[color:var(--ink-3)]">
                      (toi)
                    </span>
                  )}
                </div>
                <div className="synthese mt-0.5">
                  <span className="truncate">{m.email}</span>
                  {m.playerName && (
                    <>
                      <span className="synthese-sep">·</span>
                      <span>joueur {m.playerName}</span>
                    </>
                  )}
                </div>
              </div>

              {isOwner ? (
                <span
                  className="text-[13px] font-semibold"
                  style={{ color: "var(--gold)" }}
                >
                  Capitaine
                </span>
              ) : (
                <select
                  value={m.role === "admin" ? "admin" : "member"}
                  disabled={isPending}
                  aria-label={`Rôle de ${m.name}`}
                  onChange={(e) =>
                    run(() =>
                      setMemberRole(
                        slug,
                        m.id,
                        e.target.value as "admin" | "member"
                      )
                    )
                  }
                  className="min-h-[44px] rounded-[2px] border border-[color:var(--rule)] bg-[color:var(--pitch-2)] px-2 text-[13px] font-semibold outline-none focus:border-[color:var(--ink-1)]"
                >
                  <option value="admin">Admin</option>
                  <option value="member">Membre</option>
                </select>
              )}

              {!isOwner &&
                (confirmId === m.id ? (
                  <span className="inline-flex items-center gap-2">
                    <button
                      onClick={() => run(() => removeMember(slug, m.id))}
                      disabled={isPending}
                      className="inline-flex min-h-[44px] items-center rounded-[2px] bg-[color:var(--loss)]/20 px-3 text-[13px] font-semibold text-[color:var(--loss)] disabled:opacity-50"
                    >
                      {isPending ? "…" : "Confirmer"}
                    </button>
                    <button
                      onClick={() => setConfirmId(null)}
                      className="inline-flex min-h-[44px] items-center text-[13px] font-semibold text-[color:var(--ink-2)]"
                    >
                      Non
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setConfirmId(m.id)}
                    className="inline-flex min-h-[44px] items-center text-[13px] font-semibold text-[color:var(--ink-2)] hover:text-[color:var(--loss)]"
                  >
                    Retirer
                  </button>
                ))}
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-xs text-[color:var(--ink-2)]">
        Retirer un membre ne supprime pas son historique : son profil joueur
        reste, simplement délié du compte.
      </p>
    </section>
  );
}
