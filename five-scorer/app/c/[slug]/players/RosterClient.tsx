"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/cn";
import AvatarAnneau from "@/components/ios/AvatarAnneau";
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
              : "text-[color:var(--rule-hi)]"
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
            className="mt-1 w-full rounded-[2px] border border-[color:var(--rule)] bg-[color:var(--pitch-2)] px-3 py-2 outline-none focus:border-[color:var(--ink-1)]"
          />
        </label>
        <label className="block">
          <span className="kicker">Surnom</span>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="La Flèche"
            className="mt-1 w-full rounded-[2px] border border-[color:var(--rule)] bg-[color:var(--pitch-2)] px-3 py-2 outline-none focus:border-[color:var(--ink-1)]"
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2">
          <span className="kicker">Niveau</span>
          <select
            value={skill}
            onChange={(e) => setSkill(Number(e.target.value))}
            className="rounded-[2px] border border-[color:var(--rule)] bg-[color:var(--pitch-2)] px-3 py-2 outline-none focus:border-[color:var(--ink-1)]"
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
            className="h-4 w-4 accent-[color:var(--ink-1)]"
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
          className="plein"
        >
          {pending ? "…" : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="verre grand"
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
          className="plein w-full"
        >
          Ajouter un joueur
        </button>
      )}

      {canManage && showAdd && (
        <div className="carte" style={{ padding: "16px 18px 18px" }}>
          <h2 className="carte-titre" style={{ padding: "0 0 12px" }}>Nouveau joueur</h2>
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

      <div className="carte mt-4" style={{ padding: "0 18px" }}>
        {active.map((p) => (
          <div
            key={p.id}
            className="border-t py-3 first:border-t-0"
            style={{ borderColor: "var(--sep)" }}
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
                    <AvatarAnneau nom={p.name} taille={44} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-base font-black transition-colors group-hover:text-[color:var(--ink-1)]">
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
                      className="verre shrink-0"
                      style={{ height: 36, fontSize: 15, padding: "0 14px" }}
                    >
                      Modifier
                    </button>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Stars skill={p.skill} />
                  {p.isGuest && (
                    <span className="text-[13px]" style={{ color: "var(--i2)" }}>· invité</span>
                  )}
                  {p.isLinked && (
                    <span className="text-[13px]" style={{ color: "var(--ok)" }}>· compte lié</span>
                  )}
                </div>

                <div className="mt-2 text-xs tabular-nums text-[color:var(--ink-2)]">
                  {p.matchesPlayed} match{p.matchesPlayed > 1 ? "s" : ""} ·{" "}
                  {p.goals} but{p.goals > 1 ? "s" : ""}
                </div>

                {(canManage ||
                  (!hasLinkedPlayer && !p.isLinked && !p.isGuest)) && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {!hasLinkedPlayer && !p.isLinked && !p.isGuest && (
                      <button
                        onClick={() =>
                          runList(() => linkPlayerToUser(slug, p.id, userId))
                        }
                        disabled={isPending}
                        className="plein"
                        style={{ height: 36, fontSize: 15, padding: "0 14px" }}
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
                        className="verre"
                        style={{ height: 36, fontSize: 15, padding: "0 14px" }}
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
          <ul className="carte mt-3" style={{ padding: "0 18px" }}>
            {archived.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 border-t py-3 first:border-t-0" style={{ borderColor: "var(--sep)" }}
              >
                <Link
                  href={`/c/${slug}/players/${p.id}`}
                  className="flex min-w-0 flex-1 items-center gap-2 text-sm font-bold text-[color:var(--ink-2)] transition-colors hover:text-[color:var(--ink-1)]"
                >
                  <AvatarAnneau nom={p.name} taille={30} />
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
                    className="verre"
                    style={{ height: 36, fontSize: 15, padding: "0 14px" }}
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
