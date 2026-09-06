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
    <section className="rounded-3xl border border-[color:var(--stroke)] bg-[color:var(--bg-1)] p-5 sm:p-6">
      <h2 className="kicker">Membres</h2>
      <p className="mt-2 text-sm tabular-nums text-[color:var(--ink-1)]">
        {members.length} membre{members.length > 1 ? "s" : ""} dans le club.
      </p>

      {error && (
        <p className="mt-3 text-sm text-[color:var(--loss)]">{error}</p>
      )}

      <div className="scroll-x mt-4">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-[color:var(--stroke)] text-left text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--ink-2)]">
              <th className="py-3 pr-3">Membre</th>
              <th className="px-3 py-3">Joueur lié</th>
              <th className="px-3 py-3">Rôle</th>
              <th className="py-3 pl-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--stroke)]">
            {members.map((m) => {
              const isOwner = m.role === "owner";
              return (
                <tr key={m.id}>
                  <td className="py-3 pr-3">
                    <div className="font-bold">
                      {m.name}
                      {m.userId === currentUserId && (
                        <span className="ml-1.5 text-xs font-normal text-[color:var(--ink-2)]">
                          (toi)
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[color:var(--ink-2)]">
                      {m.email}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-[color:var(--ink-1)]">
                    {m.playerName ?? "—"}
                  </td>
                  <td className="px-3 py-3">
                    {isOwner ? (
                      <span className="rounded-full bg-[color:var(--gold)]/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[color:var(--gold)]">
                        Capitaine
                      </span>
                    ) : (
                      <select
                        value={m.role === "admin" ? "admin" : "member"}
                        disabled={isPending}
                        onChange={(e) =>
                          run(() =>
                            setMemberRole(
                              slug,
                              m.id,
                              e.target.value as "admin" | "member"
                            )
                          )
                        }
                        className="min-h-[44px] rounded-lg border border-[color:var(--stroke)] bg-[color:var(--bg-2)] px-2 text-xs font-bold outline-none focus:border-[color:var(--lime)]"
                      >
                        <option value="admin">Admin</option>
                        <option value="member">Membre</option>
                      </select>
                    )}
                  </td>
                  <td className="py-3 pl-3 text-right">
                    {!isOwner &&
                      (confirmId === m.id ? (
                        <span className="inline-flex items-center gap-2">
                          <button
                            onClick={() => run(() => removeMember(slug, m.id))}
                            disabled={isPending}
                            className="inline-flex min-h-[44px] items-center rounded-full bg-[color:var(--loss)]/20 px-3 text-xs font-black uppercase tracking-wider text-[color:var(--loss)] disabled:opacity-50"
                          >
                            {isPending ? "…" : "Confirmer"}
                          </button>
                          <button
                            onClick={() => setConfirmId(null)}
                            className="inline-flex min-h-[44px] items-center text-xs font-bold text-[color:var(--ink-2)] hover:text-white"
                          >
                            Non
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setConfirmId(m.id)}
                          className="inline-flex min-h-[44px] items-center text-xs font-bold uppercase tracking-wider text-[color:var(--ink-2)] hover:text-[color:var(--loss)]"
                        >
                          Retirer
                        </button>
                      ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-[color:var(--ink-2)]">
        Retirer un membre ne supprime pas son historique : son profil joueur
        reste, simplement délié du compte.
      </p>
    </section>
  );
}
