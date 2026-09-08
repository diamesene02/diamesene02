"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { balanceTeams } from "@/lib/balance";
import { enregistrerCompo, reprendreCompoPrecedente } from "@/app/actions/compo";
import AvatarAnneau from "@/components/ios/AvatarAnneau";

export type JoueurClub = {
  id: string;
  name: string;
  photo?: string | null;
  skill: number;
  isGk: boolean;
};

type Camp = "A" | "B" | null;

// La composition d'une soirée, préparée trois à quatre jours avant — sur la
// pelouse, comme une feuille de match.
//
// Les deux équipes se lisent d'un coup d'œil : la A dans la moitié haute,
// la B dans la moitié basse, le gardien devant sa cage. Un tap sur un joueur
// de la pelouse le fait changer de camp (A → B → hors compo) ; un tap sur un
// joueur hors compo le fait entrer dans l'équipe choisie en tête de carte.
// Pas de glissé, pas de menu : la liste se remplit au pouce.

/// Où poser n joueurs dans une moitié de terrain, en % de la hauteur totale
/// (0 = ligne de but, 50 = rond central). Le gardien devant sa cage, puis des
/// lignes régulières de deux (jusqu'à quatre joueurs de champ) ou de trois.
function placer(n: number, avecGk: boolean): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  if (n === 0) return out;
  if (avecGk) out.push({ x: 50, y: 10 });
  const reste = avecGk ? n - 1 : n;
  if (reste === 0) return out;
  // Un joueur avec son nom prend ~90 px : une moitié de terrain n'en loge
  // que deux rangées lisibles. Trois par rangée avant d'en ouvrir une autre ;
  // une troisième rangée seulement au-delà de six joueurs de champ.
  const lignes = reste <= 3 ? 1 : reste <= 6 ? 2 : 3;
  const YS: Record<string, number[]> = {
    gk1: [32],
    gk2: [24, 40],
    gk3: [21, 31, 41],
    nogk1: [26],
    nogk2: [15, 37],
    nogk3: [11, 26, 41],
  };
  const ys = YS[`${avecGk ? "gk" : "nogk"}${lignes}`];
  // Les rangées proches du rond central prennent le surplus : la défense
  // reste à deux quand l'attaque passe à trois.
  const base = Math.floor(reste / lignes);
  const extra = reste % lignes;
  for (let l = 0; l < lignes; l++) {
    const k = base + (l >= lignes - extra ? 1 : 0);
    const pas = k <= 1 ? 0 : k === 2 ? 40 : k === 3 ? 30 : 66 / (k - 1);
    for (let i = 0; i < k; i++) {
      out.push({ x: 50 + (i - (k - 1) / 2) * pas, y: ys[l] });
    }
  }
  return out;
}

export default function CompoSoiree({
  slug,
  matchDayId,
  joueurs,
  compoInitiale,
  nomAInitial,
  nomBInitial,
  peutModifier,
}: {
  slug: string;
  matchDayId: string;
  joueurs: JoueurClub[];
  compoInitiale: { playerId: string; team: "A" | "B" }[];
  nomAInitial: string | null;
  nomBInitial: string | null;
  peutModifier: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Tant que la compo à l'écran diffère de celle en base, le bouton plein
  // dit « Enregistrer la compo » ; sinon il donne le coup d'envoi.
  const [modifie, setModifie] = useState(false);
  const [renomme, setRenomme] = useState(false);
  const [cible, setCible] = useState<"A" | "B">("A");

  const [camps, setCamps] = useState<Record<string, Camp>>(() =>
    Object.fromEntries(compoInitiale.map((c) => [c.playerId, c.team])),
  );
  // Les replis viennent des chasubles du club (cf. nomsChasubles) : le nom
  // d'une équipe ne doit jamais contredire la couleur affichée à côté.
  const [nomA, setNomA] = useState(nomAInitial ?? "Équipe A");
  const [nomB, setNomB] = useState(nomBInitial ?? "Équipe B");
  const [graine, setGraine] = useState(() => Math.floor(Math.random() * 1e6) + 1);

  // Le gardien attitré en tête : c'est lui qui va devant la cage.
  const parCamp = (camp: "A" | "B") => {
    const eq = joueurs.filter((j) => camps[j.id] === camp);
    const gk = eq.find((j) => j.isGk);
    return gk ? [gk, ...eq.filter((j) => j !== gk)] : eq;
  };
  const equipeA = parCamp("A");
  const equipeB = parCamp("B");
  const dehors = joueurs.filter((j) => !camps[j.id]);
  const retenus = equipeA.length + equipeB.length;
  const niveauA = equipeA.reduce((s, j) => s + j.skill, 0);
  const niveauB = equipeB.reduce((s, j) => s + j.skill, 0);

  const posA = placer(equipeA.length, equipeA[0]?.isGk ?? false);
  const posB = placer(equipeB.length, equipeB[0]?.isGk ?? false);

  // Les mises en garde qui comptent au bord du terrain, dites avant d'y être.
  const alertes = useMemo(() => {
    const a: string[] = [];
    if (retenus > 0 && equipeA.length !== equipeB.length) {
      a.push(
        `Effectif déséquilibré : ${equipeA.length} contre ${equipeB.length}.`,
      );
    }
    if (retenus > 0 && (equipeA.length === 0 || equipeB.length === 0)) {
      a.push("Une équipe est vide.");
    }
    const gkA = equipeA.some((j) => j.isGk);
    const gkB = equipeB.some((j) => j.isGk);
    if (retenus > 0 && (!gkA || !gkB)) {
      const sans = [!gkA && nomA, !gkB && nomB].filter(Boolean).join(" et ");
      a.push(`Pas de gardien attitré chez ${sans}.`);
    }
    return a;
  }, [equipeA, equipeB, retenus, nomA, nomB]);

  /// Le tour existant : hors compo → A → B → hors compo. Un joueur hors compo
  /// entre dans l'équipe choisie en tête de carte.
  function basculer(id: string) {
    if (!peutModifier) return;
    setModifie(true);
    setCamps((c) => {
      const actuel = c[id];
      return {
        ...c,
        [id]: actuel === "A" ? "B" : actuel === "B" ? null : cible,
      };
    });
  }

  /// Répartit les joueurs déjà retenus. Ne convoque personne de lui-même : qui
  /// joue est une décision, pas un calcul.
  function equilibrer() {
    const pool = joueurs
      .filter((j) => camps[j.id])
      .map((j) => ({ id: j.id, name: j.name, skill: j.skill, isGk: j.isGk }));
    if (pool.length < 2) {
      setError("Retiens d'abord les joueurs de la soirée.");
      return;
    }
    setError(null);
    setModifie(true);
    const { teamA, teamB } = balanceTeams(pool, { seed: graine });
    setGraine((g) => g + 1);
    setCamps((c) => {
      const n = { ...c };
      teamA.forEach((p) => (n[p.id] = "A"));
      teamB.forEach((p) => (n[p.id] = "B"));
      return n;
    });
  }

  function reprendre() {
    setError(null);
    startTransition(async () => {
      const res = await reprendreCompoPrecedente(slug, matchDayId);
      if (!res.ok) {
        setError(res.error ?? "Erreur");
        return;
      }
      router.refresh();
    });
  }

  function enregistrer() {
    setError(null);
    startTransition(async () => {
      const res = await enregistrerCompo(slug, matchDayId, {
        teamAName: nomA,
        teamBName: nomB,
        joueurs: joueurs
          .filter((j) => camps[j.id])
          .map((j) => ({
            playerId: j.id,
            team: camps[j.id] as "A" | "B",
            isGk: j.isGk,
          })),
      });
      if (!res.ok) {
        setError(res.error ?? "Erreur");
        return;
      }
      setModifie(false);
      router.refresh();
    });
  }

  const joueurPelouse = (
    j: JoueurClub,
    camp: "A" | "B",
    pos: { x: number; y: number },
  ) => (
    <button
      key={j.id}
      type="button"
      className="pelouse-joueur"
      style={{ left: `${pos.x}%`, top: `${camp === "A" ? pos.y : 100 - pos.y}%` }}
      onClick={() => basculer(j.id)}
      disabled={!peutModifier}
      aria-label={`${j.name} — ${camp === "A" ? nomA : nomB}`}
    >
      <span className="pelouse-avatar">
        <AvatarAnneau nom={j.name} photo={j.photo} camp={camp} taille={54} />
        <span className="niveau" title={`Niveau ${j.skill}`}>{j.isGk ? "G" : j.skill}</span>
      </span>
      <span className="nom">{j.name}</span>
    </button>
  );

  return (
    <div className="soiree-compo">
      <div className="soiree-compo-titre">Composition</div>

      <div className="segment plein-large" role="radiogroup" aria-label="Équipe à compléter">
        <button
          type="button"
          role="radio"
          aria-checked={cible === "A"}
          className={cn(cible === "A" && "actif")}
          onClick={() => setCible("A")}
          disabled={!peutModifier}
        >
          <span className="soiree-chasuble A" />
          <span className="truncate">
            {nomA} · {equipeA.length}
          </span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={cible === "B"}
          className={cn(cible === "B" && "actif")}
          onClick={() => setCible("B")}
          disabled={!peutModifier}
        >
          <span className="soiree-chasuble B" />
          <span className="truncate">
            {nomB} · {equipeB.length}
          </span>
        </button>
      </div>

      <div className={cn("pelouse soiree-pelouse", retenus === 0 && "vide")}>
        <div className="pelouse-surface haut" />
        <div className="pelouse-surface bas" />
        {retenus === 0 && (
          <div className="soiree-pelouse-vide">
            {peutModifier
              ? "Touche un joueur ci-dessous pour le placer sur le terrain."
              : "Les équipes ne sont pas encore préparées."}
          </div>
        )}
        {equipeA.map((j, i) => joueurPelouse(j, "A", posA[i]))}
        {equipeB.map((j, i) => joueurPelouse(j, "B", posB[i]))}
      </div>

      {retenus > 0 && (
        <div className="soiree-niveau">
          <span>
            Niveau total · {nomA} <b>{niveauA}</b>
          </span>
          <span>
            {nomB} <b>{niveauB}</b>
          </span>
        </div>
      )}

      {peutModifier && (
        <div className="soiree-actions">
          <button type="button" className="verre grand" onClick={equilibrer}>
            Retirer au sort
          </button>
          {modifie ? (
            <button
              type="button"
              className="plein"
              onClick={enregistrer}
              disabled={pending}
            >
              {pending ? "Enregistrement…" : "Enregistrer la compo"}
            </button>
          ) : (
            <Link href={`/c/${slug}/matches/new?md=${matchDayId}`} className="plein">
              Coup d&apos;envoi
            </Link>
          )}
        </div>
      )}

      {alertes.length > 0 && (
        <ul className="soiree-alertes">
          {alertes.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}
      {error && <p className="soiree-alertes" style={{ color: "var(--bad)" }}>{error}</p>}

      {peutModifier && dehors.length > 0 && (
        <div className="soiree-hors">
          <div className="legende">
            Hors compo · {dehors.length}
          </div>
          <div className="soiree-jetons">
            {dehors.map((j) => (
              <button
                key={j.id}
                type="button"
                className="soiree-jeton"
                onClick={() => basculer(j.id)}
                aria-label={`${j.name} — hors compo, ajouter à ${cible === "A" ? nomA : nomB}`}
              >
                <AvatarAnneau nom={j.name} photo={j.photo} taille={28} />
                <span className="nom">{j.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {peutModifier && (
        <>
          <div className="soiree-liens">
            <button type="button" onClick={reprendre} disabled={pending}>
              Compo précédente
            </button>
            <button type="button" onClick={() => setRenomme((r) => !r)}>
              {renomme ? "Fermer" : "Renommer les équipes"}
            </button>
          </div>
          {renomme && (
            <div className="soiree-noms">
              <input
                value={nomA}
                onChange={(e) => {
                  setNomA(e.target.value);
                  setModifie(true);
                }}
                aria-label="Nom de la première équipe"
                maxLength={40}
              />
              <input
                value={nomB}
                onChange={(e) => {
                  setNomB(e.target.value);
                  setModifie(true);
                }}
                aria-label="Nom de la seconde équipe"
                maxLength={40}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
