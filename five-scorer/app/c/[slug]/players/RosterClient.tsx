"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/cn";
import PlayerAvatar from "@/components/PlayerAvatar";
import Icon from "@/components/Icon";
import {
  addPlayer,
  updatePlayer,
  setPlayerArchived,
  linkPlayerToUser,
} from "@/app/actions/roster";

type RosterPlayer = {
  id: string;
  name: string;
  nickname: string | null;
  skill: number;
  isGk: boolean;
  isGuest: boolean;
  isArchived: boolean;
  isLinked: boolean;
  matchesPlayed: number;
  goals: number;
};

type PlayerFormValues = {
  name: string;
  nickname: string;
  skill: number;
  isGk: boolean;
};

// Niveau : cinq étoiles du jeu d'icônes. Le glyphe ★ n'existe pas dans
// Archivo — il partait en police de repli et cassait le dessin.
function Stars({ skill }: { skill: number }) {
  return (
    <span
      className="inline-flex items-center gap-0.5"
      role="img"
      aria-label={`Niveau ${skill} sur 5`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon
          key={n}
          name="star"
          filled={n <= skill}
          size={14}
          className={
            n <= skill
              ? "text-[color:var(--ink-1)]"
              : "text-[color:var(--stroke-hi)]"
          }
        />
      ))}
    </span>
  );
}

function PlayerForm({
  initial,
  submitLabel,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  initial: PlayerFormValues;
  submitLabel: string;
  pending: boolean;
  error: string | null;
  onSubmit: (values: PlayerFormValues) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [nickname, setNickname] = useState(initial.nickname);
  const [skill, setSkill] = useState(initial.skill);
  const [isGk, setIsGk] = useState(initial.isGk);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ name, nickname, skill, isGk });
      }}
      className="space-y-3"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="kicker">Nom</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Kylian"
            required
            className="mt-1 w-full rounded-lg border border-[color:var(--stroke)] bg-[color:var(--bg-2)] px-3 py-2 outline-none focus:border-[color:var(--lime)]"
          />
        </label>
        <label className="block">
          <span className="kicker">Surnom</span>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="La Flèche"
            className="mt-1 w-full rounded-lg border border-[color:var(--stroke)] bg-[color:var(--bg-2)] px-3 py-2 outline-none focus:border-[color:var(--lime)]"
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2">
          <span className="kicker">Niveau</span>
          <select
            value={skill}
            onChange={(e) => setSkill(Number(e.target.value))}
            className="rounded-lg border border-[color:var(--stroke)] bg-[color:var(--bg-2)] px-3 py-2 outline-none focus:border-[color:var(--lime)]"
          >
            {[1, 2, 3, 4, 5].map((s) => (
              <option key={s} value={s}>
                {s} / 5
              </option>
            ))}
          </select>
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            checked={isGk}
            onChange={(e) => setIsGk(e.target.checked)}
            className="h-4 w-4 accent-[color:var(--lime)]"
          />
          Gardien
        </label>
      </div>
      {error && (
        <p className="text-sm text-[color:var(--loss)]">{error}</p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-[color:var(--lime)] px-5 py-2 text-sm font-black text-[color:var(--bg-0)] disabled:opacity-50"
        >
          {pending ? "…" : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-[color:var(--stroke)] bg-[color:var(--bg-2)] px-5 py-2 text-sm font-bold text-[color:var(--ink-1)] hover:text-white"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}

export default function RosterClient({
  slug,
  canManage,
  userId,
  hasLinkedPlayer,
  players,
}: {
  slug: string;
  canManage: boolean;
  userId: string;
  hasLinkedPlayer: boolean;
  players: RosterPlayer[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const active = players.filter((p) => !p.isArchived);
  const archived = players.filter((p) => p.isArchived);

  function runForm(action: () => Promise<{ ok: boolean; error?: string }>) {
    setFormError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        setFormError(res.error ?? "Erreur");
      } else {
        setShowAdd(false);
        setEditingId(null);
        router.refresh();
      }
    });
  }

  function runList(action: () => Promise<{ ok: boolean; error?: string }>) {
    setListError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) setListError(res.error ?? "Erreur");
      else router.refresh();
    });
  }

  return (
    <div className="mt-6">
      {canManage && !showAdd && (
        <button
          onClick={() => {
            setShowAdd(true);
            setEditingId(null);
            setFormError(null);
          }}
          className="rounded-full bg-[color:var(--lime)] px-5 py-2.5 text-sm font-black text-[color:var(--bg-0)] transition-transform hover:scale-[1.02]"
        >
          Ajouter un joueur
        </button>
      )}

      {canManage && showAdd && (
        <div className="rounded-2xl border border-[color:var(--stroke-hi)] bg-[color:var(--bg-1)] p-4">
          <h2 className="kicker mb-3">Nouveau joueur</h2>
          <PlayerForm
            initial={{ name: "", nickname: "", skill: 3, isGk: false }}
            submitLabel="Ajouter"
            pending={isPending}
            error={formError}
            onSubmit={(v) =>
              runForm(() =>
                addPlayer(slug, {
                  name: v.name,
                  nickname: v.nickname || null,
                  skill: v.skill,
                  isGk: v.isGk,
                })
              )
            }
            onCancel={() => {
              setShowAdd(false);
              setFormError(null);
            }}
          />
        </div>
      )}

      {listError && (
        <p className="mt-4 text-sm text-[color:var(--loss)]">{listError}</p>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {active.map((p) => (
          <div
            key={p.id}
            className="rounded-2xl border border-[color:var(--stroke)] bg-[color:var(--bg-1)] p-4 transition-colors hover:border-[color:var(--stroke-hi)]"
          >
            {editingId === p.id ? (
              <PlayerForm
                initial={{
                  name: p.name,
                  nickname: p.nickname ?? "",
                  skill: p.skill,
                  isGk: p.isGk,
                }}
                submitLabel="Enregistrer"
                pending={isPending}
                error={formError}
                onSubmit={(v) =>
                  runForm(() =>
                    updatePlayer(slug, p.id, {
                      name: v.name,
                      nickname: v.nickname || null,
                      skill: v.skill,
                      isGk: v.isGk,
                    })
                  )
                }
                onCancel={() => {
                  setEditingId(null);
                  setFormError(null);
                }}
              />
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/c/${slug}/players/${p.id}`}
                    className="group flex min-w-0 flex-1 items-center gap-3"
                  >
                    <PlayerAvatar name={p.name} id={p.id} size="md" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-base font-black transition-colors group-hover:text-[color:var(--lime)]">
                          {p.name}
                        </span>
                        {p.isGk && (
                          <Icon
                            name="glove"
                            size={14}
                            label="Gardien"
                            className="shrink-0 text-[color:var(--ink-3)]"
                          />
                        )}
                      </div>
                      {p.nickname && (
                        <div className="mt-0.5 truncate text-xs italic text-[color:var(--ink-2)]">
                          « {p.nickname} »
                        </div>
                      )}
                    </div>
                  </Link>
                  {canManage && (
                    <button
                      onClick={() => {
                        setEditingId(p.id);
                        setShowAdd(false);
                        setFormError(null);
                      }}
                      className="shrink-0 rounded-full border border-[color:var(--stroke)] bg-[color:var(--bg-2)] px-3 py-1 text-xs font-bold text-[color:var(--ink-2)] transition-colors hover:text-[color:var(--ink-1)]"
                    >
                      Modifier
                    </button>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Stars skill={p.skill} />
                  {p.isGuest && (
                    <span className="rounded-full border border-[color:var(--stroke)] bg-[color:var(--bg-2)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[color:var(--ink-1)]">
                      invité
                    </span>
                  )}
                  {p.isLinked && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--stroke)] bg-[color:var(--bg-2)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[color:var(--a-400)]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--a-500)]" />
                      compte lié
                    </span>
                  )}
                </div>

                <div className="mt-2 text-xs tabular-nums text-[color:var(--ink-2)]">
                  {p.matchesPlayed} match{p.matchesPlayed > 1 ? "s" : ""} ·{" "}
                  {p.goals} but{p.goals > 1 ? "s" : ""}
                </div>

                {(canManage ||
                  (!hasLinkedPlayer && !p.isLinked && !p.isGuest)) && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-[color:var(--stroke)] pt-3">
                    {!hasLinkedPlayer && !p.isLinked && !p.isGuest && (
                      <button
                        onClick={() =>
                          runList(() => linkPlayerToUser(slug, p.id, userId))
                        }
                        disabled={isPending}
                        className="rounded-full border border-[color:var(--stroke-hi)] bg-[color:var(--bg-2)] px-3 py-1 text-xs font-black text-[color:var(--ink-1)] disabled:opacity-50"
                      >
                        C&apos;est moi
                      </button>
                    )}
                    {canManage && (
                      <button
                        onClick={() =>
                          runList(() => setPlayerArchived(slug, p.id, true))
                        }
                        disabled={isPending}
                        className="rounded-full border border-[color:var(--stroke)] bg-[color:var(--bg-2)] px-3 py-1 text-xs font-bold text-[color:var(--ink-1)] hover:text-white disabled:opacity-50"
                      >
                        Archiver
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {active.length === 0 && (
        <p className="mt-6 text-sm text-[color:var(--ink-2)]">
          Personne dans le vestiaire pour l&apos;instant.
          {canManage && " Ajoute tes premiers joueurs."}
        </p>
      )}

      {archived.length > 0 && (
        <details className="mt-8">
          <summary className="kicker cursor-pointer select-none">
            Archivés ({archived.length})
          </summary>
          <ul className="mt-3 divide-y divide-[color:var(--stroke)] overflow-hidden rounded-2xl border border-[color:var(--stroke)] bg-[color:var(--bg-1)]">
            {archived.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <Link
                  href={`/c/${slug}/players/${p.id}`}
                  className="flex min-w-0 flex-1 items-center gap-2 text-sm font-bold text-[color:var(--ink-2)] transition-colors hover:text-[color:var(--ink-1)]"
                >
                  <PlayerAvatar name={p.name} id={p.id} size="sm" />
                  <span className="truncate">{p.name}</span>
                  {p.isGk && (
                    <Icon
                      name="glove"
                      size={14}
                      label="Gardien"
                      className="shrink-0 text-[color:var(--ink-3)]"
                    />
                  )}
                </Link>
                <span className="text-xs tabular-nums text-[color:var(--ink-3)]">
                  {p.matchesPlayed} m · {p.goals} b
                </span>
                {canManage && (
                  <button
                    onClick={() =>
                      runList(() => setPlayerArchived(slug, p.id, false))
                    }
                    disabled={isPending}
                    className="rounded-full border border-[color:var(--stroke)] bg-[color:var(--bg-2)] px-3 py-1 text-xs font-bold text-[color:var(--ink-1)] hover:text-white disabled:opacity-50"
                  >
                    Réactiver
                  </button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
