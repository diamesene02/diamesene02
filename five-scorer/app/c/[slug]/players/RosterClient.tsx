"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/cn";
import AvatarAnneau from "@/components/ios/AvatarAnneau";
import PhotoJoueur from "@/components/ios/PhotoJoueur";
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
  photo: string | null;
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
  photo: string | null;
};

// Niveau : cinq étoiles du jeu d'icônes. Le glyphe ★ n'existe pas dans
// Archivo — il partait en police de repli et cassait le dessin.
function Etoiles({ skill, taille = 13 }: { skill: number; taille?: number }) {
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
          size={taille}
          className={n <= skill ? "" : "opacity-30"}
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
  const [photo, setPhoto] = useState<string | null>(initial.photo);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ name, nickname, skill, isGk, photo });
      }}
      className="roster-form"
    >
      <PhotoJoueur nom={name || "ce joueur"} photo={photo} onChange={setPhoto} disabled={pending} />

      <label className="roster-champ">
        <span>Nom</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Kylian" required />
      </label>
      <label className="roster-champ">
        <span>Surnom</span>
        <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="La Flèche" />
      </label>

      <div className="roster-champ">
        <span>Niveau</span>
        <div className="segment plein-large" role="radiogroup" aria-label="Niveau">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={skill === n}
              onClick={() => setSkill(n)}
              className={cn(skill === n && "actif")}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        className="rangee-ios"
        onClick={() => setIsGk((g) => !g)}
        aria-pressed={isGk}
      >
        <span className="libelle">
          Gardien
          <span className="aide">Le générateur d&apos;équipes les sépare en premier.</span>
        </span>
        <span className="valeur">{isGk ? "Oui" : "Non"}</span>
      </button>

      {error && <p className="text-[15px]" style={{ color: "var(--bad)" }}>{error}</p>}

      <div className="roster-actions">
        <button type="submit" disabled={pending} className="plein">
          {pending ? "…" : submitLabel}
        </button>
        <button type="button" onClick={onCancel} className="verre grand">
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
  editInitial = null,
}: {
  slug: string;
  canManage: boolean;
  userId: string;
  hasLinkedPlayer: boolean;
  players: RosterPlayer[];
  /// `?edit=<id>` — le bouton « Modifier » de la fiche joueur renvoie ici.
  /// Le paramètre était posé dans le lien mais personne ne le lisait : le
  /// bouton ramenait à l'effectif et ne faisait rien.
  editInitial?: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(editInitial);
  const [formError, setFormError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const active = players.filter((p) => !p.isArchived);
  const archived = players.filter((p) => p.isArchived);

  function runForm(action: () => Promise<{ ok: boolean; error?: string }>) {
    setFormError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) setFormError(res.error ?? "Erreur");
      else {
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
    <div>
      {canManage && !showAdd && !editingId && (
        <button
          onClick={() => {
            setShowAdd(true);
            setFormError(null);
          }}
          className="verre grand w-full"
        >
          <Icon name="plus" size={15} />
          Ajouter un joueur
        </button>
      )}

      {canManage && showAdd && (
        <div className="carte" style={{ padding: "16px 18px 18px" }}>
          <div className="carte-titre" style={{ padding: "0 0 12px" }}>Nouveau joueur</div>
          <PlayerForm
            initial={{ name: "", nickname: "", skill: 3, isGk: false, photo: null }}
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
                  photo: v.photo,
                }),
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
        <p className="mt-4 text-[15px]" style={{ color: "var(--bad)" }}>{listError}</p>
      )}

      {/* UN JOUEUR, UNE RANGÉE.
          Chacun tenait sur cinq lignes — nom, étoiles, compteurs, puis les
          boutons « Modifier » et « Archiver » affichés en permanence. Quinze
          joueurs faisaient une page à faire défiler deux fois. La rangée mène
          à la fiche ; la gestion se déplie sur demande. */}
      <div className="carte mt-4" style={{ padding: "0 16px" }}>
        {active.map((p) =>
          editingId === p.id ? (
            <div key={p.id} className="roster-edition">
              <PlayerForm
                initial={{
                  name: p.name,
                  nickname: p.nickname ?? "",
                  skill: p.skill,
                  isGk: p.isGk,
                  photo: p.photo,
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
                      photo: v.photo,
                    }),
                  )
                }
                onCancel={() => {
                  setEditingId(null);
                  setFormError(null);
                }}
              />
              <div className="roster-secondaire">
                <button
                  onClick={() => runList(() => setPlayerArchived(slug, p.id, true))}
                  disabled={isPending}
                  className="verre"
                >
                  Archiver {p.name}
                </button>
              </div>
            </div>
          ) : (
            <div key={p.id} className="roster-rangee">
              <Link href={`/c/${slug}/players/${p.id}`} className="lien">
                <AvatarAnneau nom={p.name} photo={p.photo} taille={44} />
                <span className="corps">
                  <span className="nom">
                    {p.name}
                    {p.isGk && (
                      <Icon name="glove" size={13} label="Gardien" className="gant" />
                    )}
                    {p.isLinked && <span className="lie" title="Compte lié" />}
                  </span>
                  <span className="sous">
                    <Etoiles skill={p.skill} />
                    <span className="chiffres">
                      {p.matchesPlayed} match{p.matchesPlayed > 1 ? "s" : ""} · {p.goals} but
                      {p.goals > 1 ? "s" : ""}
                      {p.isGuest && " · invité"}
                    </span>
                  </span>
                </span>
                <Icon name="chevron" size={15} className="chev" />
              </Link>
              {/* « C'est moi » n'existe qu'au premier passage, tant que le
                  membre n'a pas revendiqué son profil. « Modifier » a
                  disparu d'ici : un bouton par rangée, c'était dix boutons
                  pour une action qu'on fait deux fois par saison. Il vit sur
                  la fiche du joueur, qui est au bout de la rangée. */}
              {!hasLinkedPlayer && !p.isLinked && !p.isGuest && (
                <div className="outils">
                  <button
                    onClick={() => runList(() => linkPlayerToUser(slug, p.id, userId))}
                    disabled={isPending}
                    className="verre"
                  >
                    C&apos;est moi
                  </button>
                </div>
              )}
            </div>
          ),
        )}
      </div>

      {active.length === 0 && (
        <p className="mt-6 text-[15px]" style={{ color: "var(--i2)" }}>
          Personne dans le vestiaire pour l&apos;instant.
          {canManage && " Ajoute tes premiers joueurs."}
        </p>
      )}

      {archived.length > 0 && (
        <details className="mt-8">
          <summary className="kicker cursor-pointer select-none">
            Archivés ({archived.length})
          </summary>
          <div className="carte mt-3" style={{ padding: "0 16px" }}>
            {archived.map((p) => (
              <div key={p.id} className="roster-rangee archive">
                <Link href={`/c/${slug}/players/${p.id}`} className="lien">
                  <AvatarAnneau nom={p.name} photo={p.photo} taille={34} />
                  <span className="corps">
                    <span className="nom">{p.name}</span>
                    <span className="sous">
                      <span className="chiffres">
                        {p.matchesPlayed} match{p.matchesPlayed > 1 ? "s" : ""} · {p.goals} but
                        {p.goals > 1 ? "s" : ""}
                      </span>
                    </span>
                  </span>
                </Link>
                {canManage && (
                  <div className="outils">
                    <button
                      onClick={() => runList(() => setPlayerArchived(slug, p.id, false))}
                      disabled={isPending}
                      className="verre"
                    >
                      Réactiver
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
