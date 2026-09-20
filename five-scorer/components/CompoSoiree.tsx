"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { balanceTeams } from "@/lib/balance";
import { estGardienDuSoir } from "@/lib/gardien";
import { enregistrerCompo, reprendreCompoPrecedente } from "@/app/actions/compo";
import AvatarAnneau from "@/components/ios/AvatarAnneau";
import EnvoyerSurLeGroupe from "@/app/c/[slug]/sessions/[id]/EnvoyerSurLeGroupe";

export type JoueurClub = {
  id: string;
  name: string;
  photo?: string | null;
  skill: number;
  isGk: boolean;
  /// Ce qu'il a répondu pour CETTE soirée, abonnement compris (cf.
  /// lib/presences). Le capitaine compose trois jours avant : sans ça, il
  /// voyait des noms et devait croiser à la main avec la carte du dessus.
  presence?: "IN" | "OUT" | "MAYBE" | null;
  /// Présent, mais au-delà de la capacité du terrain.
  enAttente?: boolean;
};

type Camp = "A" | "B" | null;

/// L'ordre du « hors compo » : ceux qui viennent d'abord, les absents à la
/// fin — c'est dans cet ordre qu'on les fait entrer.
const RANG_PRESENCE = (j: JoueurClub) =>
  j.presence === "IN" ? (j.enAttente ? 1 : 0) : j.presence === "MAYBE" ? 2 : j.presence === "OUT" ? 4 : 3;

const LIBELLE_PRESENCE = (j: JoueurClub) =>
  j.presence === "IN"
    ? j.enAttente
      ? "en attente"
      : "présent"
    : j.presence === "MAYBE"
      ? "peut-être"
      : j.presence === "OUT"
        ? "absent"
        : "sans réponse";

const ET = new Intl.ListFormat("fr", { type: "conjunction" });

/// Délai de l'enregistrement automatique après la dernière retouche.
const ENREGISTRER_APRES_MS = 800;

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
  jourJ = true,
  partage = null,
}: {
  slug: string;
  matchDayId: string;
  joueurs: JoueurClub[];
  /// `isGk` est le gardien DÉSIGNÉ pour cette soirée-là, tel qu'il est en
  /// base : il ne se déduit pas du gardien attitré du club.
  compoInitiale: { playerId: string; team: "A" | "B"; isGk: boolean }[];
  nomAInitial: string | null;
  nomBInitial: string | null;
  peutModifier: boolean;
  /// La soirée est aujourd'hui : le bouton plein donne le coup d'envoi.
  /// Les autres jours, il envoie la compo sur le groupe — un « Coup
  /// d'envoi » trois jours avant ne mène nulle part.
  jourJ?: boolean;
  /// De quoi composer la convocation : en-tête de la soirée, état, chemin.
  partage?: { entete: string; etat: string | null; chemin: string } | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Tant que la compo à l'écran diffère de celle en base, le bouton plein
  // dit « Enregistrer la compo » ; sinon il donne le coup d'envoi (ou envoie
  // la compo sur le groupe, avant le jour J).
  const [modifie, setModifie] = useState(false);
  const [renomme, setRenomme] = useState(false);
  const [cible, setCible] = useState<"A" | "B">("A");
  const [tire, setTire] = useState(false);
  // « Enregistrée » s'affiche un instant après chaque enregistrement
  // automatique : sans ce retour, on ne sait pas si on peut partir.
  const [sauvegarde, setSauvegarde] = useState<"encours" | "ok" | null>(null);

  const [camps, setCamps] = useState<Record<string, Camp>>(() =>
    Object.fromEntries(compoInitiale.map((c) => [c.playerId, c.team])),
  );
  // Les replis viennent des chasubles du club (cf. nomsChasubles) : le nom
  // d'une équipe ne doit jamais contredire la couleur affichée à côté.
  const [nomA, setNomA] = useState(nomAInitial ?? "Équipe A");
  const [nomB, setNomB] = useState(nomBInitial ?? "Équipe B");
  const [graine, setGraine] = useState(() => Math.floor(Math.random() * 1e6) + 1);

  // Chaque retouche porte un numéro : un enregistrement ne rend la compo
  // « propre » que si rien n'a bougé pendant son aller-retour.
  const version = useRef(0);
  const modifieRef = useRef(modifie);
  modifieRef.current = modifie;
  function retoucher() {
    version.current += 1;
    setModifie(true);
    setSauvegarde(null);
  }

  // La compo en base a changé (« Compo précédente », un autre capitaine, notre
  // propre enregistrement) : on la reprend — sauf si des retouches sont en
  // cours, qu'on n'écrase jamais. Le composant n'est plus remonté à chaque
  // enregistrement : le panneau « Renommer » ouvert, l'équipe visée, tout ça
  // restait perdu à chaque tap.
  const signature =
    compoInitiale.map((c) => `${c.playerId}:${c.team}:${c.isGk ? "G" : ""}`).sort().join("|") +
    `|${nomAInitial ?? ""}|${nomBInitial ?? ""}`;
  useEffect(() => {
    if (modifieRef.current) return;
    setCamps(Object.fromEntries(compoInitiale.map((c) => [c.playerId, c.team])));
    // Le serveur rend le nom sans espaces de bord : « Les » ne doit pas
    // effacer l'espace qu'on vient de taper avant « Bleus ».
    setNomA((n) => (n.trim() === (nomAInitial ?? "").trim() ? n : (nomAInitial ?? "Équipe A")));
    setNomB((n) => (n.trim() === (nomBInitial ?? "").trim() ? n : (nomBInitial ?? "Équipe B")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  // Le gardien du soir (lib/gardien) : celui que la compo enregistrée désigne,
  // pas le gardien attitré du club. Le lundi où l'attitré ne vient pas, le
  // capitaine en désigne un autre depuis l'app — l'écran du site doit le
  // montrer devant la cage, et surtout le RÉÉCRIRE tel quel (cf. `charge`).
  const estGk = estGardienDuSoir(compoInitiale);

  // Le gardien en tête : c'est lui qui va devant la cage.
  const parCamp = (camp: "A" | "B") => {
    const eq = joueurs.filter((j) => camps[j.id] === camp);
    const gk = eq.find((j) => estGk(j));
    return gk ? [gk, ...eq.filter((j) => j !== gk)] : eq;
  };
  const equipeA = parCamp("A");
  const equipeB = parCamp("B");
  const dehors = joueurs
    .filter((j) => !camps[j.id])
    .sort((a, b) => RANG_PRESENCE(a) - RANG_PRESENCE(b));
  const retenus = equipeA.length + equipeB.length;
  const niveauA = equipeA.reduce((s, j) => s + j.skill, 0);
  const niveauB = equipeB.reduce((s, j) => s + j.skill, 0);

  const posA = placer(equipeA.length, equipeA[0] != null && estGk(equipeA[0]));
  const posB = placer(equipeB.length, equipeB[0] != null && estGk(equipeB[0]));

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
    const gkA = equipeA.some((j) => estGk(j));
    const gkB = equipeB.some((j) => estGk(j));
    if (retenus > 0 && (!gkA || !gkB)) {
      const sans = [!gkA && nomA, !gkB && nomB].filter(Boolean).join(" et ");
      a.push(`Pas de gardien chez ${sans}.`);
    }
    // Placé, mais il a dit qu'il ne venait pas : l'équipe jouera à un de moins.
    const absents = [...equipeA, ...equipeB].filter((j) => j.presence === "OUT");
    if (absents.length > 0) {
      a.push(
        `${ET.format(absents.map((j) => j.name))} ${absents.length > 1 ? "ont" : "a"} dit absent.`,
      );
    }
    return a;
  }, [equipeA, equipeB, retenus, nomA, nomB, estGk]);

  // Ceux qui viennent et ne sont pas encore sur le terrain.
  const presentsDehors = joueurs.filter(
    (j) => !camps[j.id] && j.presence === "IN" && !j.enAttente,
  );

  /// Le tour existant : hors compo → A → B → hors compo. Un joueur hors compo
  /// entre dans l'équipe choisie en tête de carte.
  function basculer(id: string) {
    if (!peutModifier) return;
    retoucher();
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
      .map((j) => ({ id: j.id, name: j.name, skill: j.skill, isGk: estGk(j) }));
    if (pool.length < 2) {
      setError("Retiens d'abord les joueurs de la soirée.");
      return;
    }
    setError(null);
    retoucher();
    const { teamA, teamB } = balanceTeams(pool, { seed: graine });
    setGraine((g) => g + 1);
    setTire(true);
    setCamps((c) => {
      const n = { ...c };
      teamA.forEach((p) => (n[p.id] = "A"));
      teamB.forEach((p) => (n[p.id] = "B"));
      return n;
    });
  }

  /// Fait entrer d'un coup tous ceux qui ont dit présent. Sur un terrain vide,
  /// ils sont aussitôt répartis — le premier jet de la compo en un tap. Sur
  /// une compo commencée, chacun rejoint l'équipe la moins fournie, sans
  /// défaire ce que le capitaine a déjà placé à la main.
  function placerLesPresents() {
    if (!peutModifier || presentsDehors.length === 0) return;
    setError(null);
    retoucher();
    if (retenus === 0 && presentsDehors.length >= 2) {
      const { teamA, teamB } = balanceTeams(
        presentsDehors.map((j) => ({ id: j.id, name: j.name, skill: j.skill, isGk: estGk(j) })),
        { seed: graine },
      );
      setGraine((g) => g + 1);
      setTire(true);
      setCamps((c) => {
        const n = { ...c };
        teamA.forEach((p) => (n[p.id] = "A"));
        teamB.forEach((p) => (n[p.id] = "B"));
        return n;
      });
      return;
    }
    let a = equipeA.length;
    let b = equipeB.length;
    const ajouts: Record<string, Camp> = {};
    for (const j of presentsDehors) {
      const camp = a < b ? "A" : b < a ? "B" : cible;
      ajouts[j.id] = camp;
      if (camp === "A") a += 1;
      else b += 1;
    }
    setCamps((c) => ({ ...c, ...ajouts }));
  }

  function reprendre() {
    setError(null);
    startTransition(async () => {
      const res = await reprendreCompoPrecedente(slug, matchDayId);
      if (!res.ok) {
        setError(res.error ?? "Erreur");
        return;
      }
      // Le geste remplace la compo à l'écran : les retouches en cours
      // cèdent, sinon la compo reprise n'apparaîtrait jamais.
      version.current += 1;
      modifieRef.current = false;
      setModifie(false);
      router.refresh();
    });
  }

  const charge = () => ({
    teamAName: nomA,
    teamBName: nomB,
    joueurs: joueurs
      .filter((j) => camps[j.id])
      .map((j) => ({
        playerId: j.id,
        team: camps[j.id] as "A" | "B",
        // Le gardien du soir, pas le gardien attitré : l'enregistrement
        // REMPLACE la compo entière, il doit donc reconduire la désignation
        // qu'il vient de lire. Sinon le moindre tap depuis le site rendait
        // les gants à l'attitré, trois jours avant un lundi où il ne vient
        // pas.
        isGk: estGk(j),
      })),
  });

  async function sauver() {
    const v = version.current;
    setError(null);
    setSauvegarde("encours");
    try {
      const res = await enregistrerCompo(slug, matchDayId, charge());
      if (!res.ok) {
        setSauvegarde(null);
        setError(res.error ?? "Erreur");
        return;
      }
      if (version.current === v) {
        setModifie(false);
        setSauvegarde("ok");
      }
    } catch {
      setSauvegarde(null);
      setError("Compo pas enregistrée — pas de réseau ? Touche « Enregistrer la compo » pour réessayer.");
    }
  }

  function enregistrer() {
    startTransition(sauver);
  }

  // Dix taps pour placer les joueurs, un « ‹ » par réflexe, et tout était à
  // refaire : la compo ne s'enregistrait qu'au bouton. Elle part maintenant
  // d'elle-même, un instant après la dernière retouche. Un nom d'équipe vidé
  // n'est pas envoyé : le serveur le remplacerait par la couleur pendant
  // qu'on tape le nouveau.
  useEffect(() => {
    if (!modifie || !peutModifier || !nomA.trim() || !nomB.trim()) return;
    const t = setTimeout(() => void sauver(), ENREGISTRER_APRES_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camps, nomA, nomB, modifie, peutModifier]);

  // Fermer l'onglet dans la fenêtre de l'enregistrement : le navigateur
  // demande confirmation. Quitter l'écran par un lien du site : on envoie ce
  // qu'on a, sans attendre.
  const envoyerEnPartant = useRef<() => void>(() => {});
  envoyerEnPartant.current = () => {
    if (modifieRef.current && peutModifier && nomA.trim() && nomB.trim()) {
      void enregistrerCompo(slug, matchDayId, charge()).catch(() => {});
    }
  };
  useEffect(() => () => envoyerEnPartant.current(), []);
  useEffect(() => {
    if (!modifie) return;
    const retenir = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", retenir);
    return () => window.removeEventListener("beforeunload", retenir);
  }, [modifie]);

  useEffect(() => {
    if (sauvegarde !== "ok") return;
    const t = setTimeout(() => setSauvegarde(null), 2500);
    return () => clearTimeout(t);
  }, [sauvegarde]);

  const joueurPelouse = (
    j: JoueurClub,
    camp: "A" | "B",
    pos: { x: number; y: number },
  ) => (
    <button
      key={j.id}
      type="button"
      className={cn("pelouse-joueur", j.presence === "OUT" && "absent")}
      style={{ left: `${pos.x}%`, top: `${camp === "A" ? pos.y : 100 - pos.y}%` }}
      onClick={() => basculer(j.id)}
      disabled={!peutModifier}
      aria-label={`${j.name} — ${camp === "A" ? nomA : nomB}${j.presence ? `, ${LIBELLE_PRESENCE(j)}` : ""}`}
    >
      <span className="pelouse-avatar">
        <AvatarAnneau nom={j.name} photo={j.photo} camp={camp} taille={54} />
        {/* « Note » : « Niveau » est réservé au niveau d'expérience. */}
        <span className="niveau" title={`Note ${j.skill}`}>{estGk(j) ? "G" : j.skill}</span>
      </span>
      <span className="nom">{j.name}</span>
    </button>
  );

  return (
    <div className="soiree-compo">
      <div className="soiree-compo-titre">
        Composition
        {sauvegarde && (
          <span className="soiree-sauvegarde" role="status">
            {sauvegarde === "encours" ? "Enregistrement…" : "Enregistrée"}
          </span>
        )}
      </div>

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
            Note totale · {nomA} <b>{niveauA}</b>
          </span>
          <span>
            {nomB} <b>{niveauB}</b>
          </span>
        </div>
      )}

      {peutModifier && (
        <div className="soiree-actions">
          {/* « Retirer au sort » se lisait « retirer » : on craignait de voir
              sortir des joueurs. Même geste, même mot que sur « Nouveau
              match ». */}
          <button type="button" className="verre grand" onClick={equilibrer}>
            {tire ? "Autre tirage" : "Équilibrer"}
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
          ) : !jourJ && partage ? (
            <EnvoyerSurLeGroupe
              entete={partage.entete}
              etat={partage.etat}
              chemin={partage.chemin}
              equipes={[
                { nom: nomA, joueurs: equipeA.map((j) => j.name) },
                { nom: nomB, joueurs: equipeB.map((j) => j.name) },
              ]}
              className="plein"
            />
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
            <span>Hors compo · {dehors.length}</span>
            {presentsDehors.length > 0 && (
              <button type="button" className="soiree-placer" onClick={placerLesPresents}>
                Placer les présents · {presentsDehors.length}
              </button>
            )}
          </div>
          <div className="soiree-jetons">
            {dehors.map((j) => (
              <button
                key={j.id}
                type="button"
                className={cn("soiree-jeton", j.presence === "OUT" && "absent")}
                onClick={() => basculer(j.id)}
                aria-label={`${j.name}, ${LIBELLE_PRESENCE(j)} — hors compo, ajouter à ${cible === "A" ? nomA : nomB}`}
              >
                <AvatarAnneau nom={j.name} photo={j.photo} taille={28} />
                <span className="nom">{j.name}</span>
                {j.presence !== undefined && (
                  <span
                    className={cn(
                      "soiree-pastille",
                      j.presence === "IN" && (j.enAttente ? "maybe" : "in"),
                      j.presence === "MAYBE" && "maybe",
                      j.presence === "OUT" && "out",
                    )}
                    aria-hidden
                  />
                )}
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
                  retoucher();
                }}
                aria-label="Nom de la première équipe"
                maxLength={40}
              />
              <input
                value={nomB}
                onChange={(e) => {
                  setNomB(e.target.value);
                  retoucher();
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
