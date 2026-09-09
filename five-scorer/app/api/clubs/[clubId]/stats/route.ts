import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClubApiContext } from "@/lib/guard";
import { trierParPoints, points } from "@/lib/classement";
import { ini, lettre } from "@/lib/ini";
import * as D from "@/lib/dates";
import {
  getClubRecords,
  getDerby,
  getExternalRecord,
  getGardiens,
  getLeaderboard,
  getSeasonHonours,
  type SeasonHonours,
} from "@/lib/stats";

export const dynamic = "force-dynamic";

/// « Saison 2026-2027 » devient « Saison 26–27 » — copie de la règle de
/// `app/c/[slug]/stats/page.tsx` : la pilule du sélecteur ne tient pas le
/// millésime complet. Un nom libre (« Été ») garde son mot.
function libelleSaison(nom: string): string {
  const m = nom.match(/(\d{2})(\d{2})\s*[-–—/]\s*(\d{2})?(\d{2})/);
  if (m) return `Saison ${m[2]}–${m[4]}`;
  return /^saison/i.test(nom.trim()) ? nom : `Saison ${nom}`;
}

/// Toute la page « Stats » en un aller-retour.
///
/// La page du site fait une quinzaine de requêtes — c'est le bon choix sur un
/// serveur. Sur un téléphone au bord d'un terrain, chacune se paie en secondes
/// et en batterie ; et surtout, l'app doit pouvoir montrer l'écran entier ou
/// rien, pas six cartes qui apparaissent l'une après l'autre.
///
/// Tout arrive assemblé : les points de chaque ligne, l'ordre du tableau, les
/// dates en français, les phrases des records. L'app dessine.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  const { clubId } = await params;
  const ctx = await getClubApiContext(clubId);
  if (!ctx) return NextResponse.json({ error: "introuvable" }, { status: 404 });
  const { club } = ctx;

  const saisons = await prisma.season.findMany({
    where: { clubId },
    orderBy: { startsAt: "desc" },
  });
  const active = saisons.find((s) => s.isActive) ?? null;

  // Même règle que le site : un identifiant qu'on ne connaît pas retombe sur
  // la saison en cours plutôt que de rendre une erreur. Le sélecteur ne peut
  // proposer que des saisons existantes ; un identifiant inventé vient d'un
  // lien périmé, et l'écran doit s'ouvrir quand même.
  const demande = new URL(req.url).searchParams.get("saison") ?? undefined;
  const choisie =
    demande === "all"
      ? "all"
      : demande && saisons.some((s) => s.id === demande)
        ? demande
        : (active?.id ?? "all");

  const portee = { clubId, seasonId: choisie === "all" ? null : choisie };

  const [lignes, externe, records, derby, gardiens, participations] =
    await Promise.all([
      getLeaderboard(portee),
      getExternalRecord(portee, { win: club.pointsWin, draw: club.pointsDraw }),
      getClubRecords(portee),
      getDerby(portee),
      getGardiens(portee),
      // La chasuble de chacun, pour l'anneau de son avatar : celle de son
      // dernier match terminé dans la période.
      prisma.matchParticipant.findMany({
        where: {
          match: {
            clubId,
            status: "FINISHED",
            ...(portee.seasonId ? { seasonId: portee.seasonId } : {}),
          },
        },
        select: { playerId: true, initialTeam: true },
        orderBy: { match: { playedAt: "desc" } },
      }),
    ]);

  const camps: Record<string, "A" | "B"> = {};
  for (const p of participations) if (!camps[p.playerId]) camps[p.playerId] = p.initialTeam;
  // On rend le CAMP, pas la couleur : l'app porte déjà les jetons du thème,
  // et l'anneau se peint avec `taR`/`tbR` — les variantes redressées, sans
  // quoi une chasuble noire disparaît sur une carte sombre. La règle vit dans
  // `lib/theme.ts` ; la recopier ici en couleur brute la contredirait.
  const camp = (id: string) => camps[id] ?? null;

  // Le palmarès : complet pour une saison clôturée, sinon le podium de la
  // période. C'est la même carte, avec plus ou moins de titres.
  const cloturees = saisons.filter((s) => !s.isActive);
  const honneurs: SeasonHonours | null = cloturees.some((s) => s.id === choisie)
    ? await getSeasonHonours(clubId, choisie)
    : null;
  const passees: SeasonHonours[] =
    choisie === "all" && cloturees.length > 0
      ? (await Promise.all(cloturees.map((s) => getSeasonHonours(clubId, s.id)))).filter(
          (h): h is SeasonHonours => h !== null,
        )
      : [];

  const parButs = [...lignes].sort((a, b) => b.goals - a.goals)[0];
  const parMvp = [...lignes].sort((a, b) => b.mvpCount - a.mvpCount)[0];
  const parPasses = [...lignes].sort((a, b) => b.assists - a.assists)[0];

  type Titre = {
    cle: string;
    libelle: string;
    icone: "trophee" | "ballon" | "passe" | null;
    or?: boolean;
    playerId: string;
    nom: string;
    valeur: string;
  };

  const palmares: Titre[] = honneurs
    ? (
        [
          { cle: "mvp", libelle: "Homme du match", icone: "trophee" as const, or: true, e: honneurs.topMvp, u: (v: number) => (v > 1 ? "titres" : "titre") },
          { cle: "buteur", libelle: "Meilleur buteur", icone: "ballon" as const, e: honneurs.topScorer, u: (v: number) => (v > 1 ? "buts" : "but") },
          ...(club.trackAssists
            ? [{ cle: "passeur", libelle: "Meilleur passeur", icone: "passe" as const, e: honneurs.topAssister, u: (v: number) => (v > 1 ? "passes" : "passe") }]
            : []),
          { cle: "pctv", libelle: "Meilleur %V", icone: null, e: honneurs.topWinPct, u: () => "%" },
          { cle: "elo", libelle: "Élo le plus haut", icone: null, e: honneurs.topElo, u: () => "pts" },
          { cle: "inox", libelle: "L'inoxydable", icone: null, e: honneurs.ironMan, u: (v: number) => (v > 1 ? "matchs" : "match") },
        ] as {
          cle: string;
          libelle: string;
          icone: Titre["icone"];
          or?: boolean;
          e: SeasonHonours["topScorer"];
          u: (v: number) => string;
        }[]
      )
        .filter((c) => c.e !== null)
        .map((c) => ({
          cle: c.cle,
          libelle: c.libelle,
          icone: c.icone,
          or: c.or,
          playerId: c.e!.playerId,
          nom: c.e!.name,
          valeur: `${c.e!.value} ${c.u(c.e!.value)}`,
        }))
    : ([
        parMvp && parMvp.mvpCount > 0
          ? { cle: "mvp", libelle: "Homme du match", icone: "trophee" as const, or: true, playerId: parMvp.playerId, nom: parMvp.name, valeur: String(parMvp.mvpCount) }
          : null,
        parButs && parButs.goals > 0
          ? { cle: "buteur", libelle: "Meilleur buteur", icone: "ballon" as const, playerId: parButs.playerId, nom: parButs.name, valeur: String(parButs.goals) }
          : null,
        club.trackAssists && parPasses && parPasses.assists > 0
          ? { cle: "passeur", libelle: "Meilleur passeur", icone: "passe" as const, playerId: parPasses.playerId, nom: parPasses.name, valeur: String(parPasses.assists) }
          : null,
      ] as (Titre | null)[]).filter((t): t is Titre => t !== null);

  const ordre = trierParPoints(lignes, club.pointsWin, club.pointsDraw);
  const buteurs = [...lignes].sort(
    (a, b) => b.goals - a.goals || a.name.localeCompare(b.name),
  );
  const maxButs = buteurs[0]?.goals ?? 0;

  const carte = (r: (typeof lignes)[number]) => ({
    playerId: r.playerId,
    nom: r.name,
    initiales: ini(r.name),
    photo: r.photo ?? null,
    camp: camp(r.playerId),
  });

  // Les records : chacun arrive avec sa phrase et sa cible. Le site les
  // assemble dans son composant ; ici, c'est le serveur, sinon la règle
  // vivrait en deux exemplaires — et divergerait au premier record ajouté.
  type LigneRecord = {
    cle: string;
    titre: string;
    valeur: string;
    contexte: string;
    cible: { quoi: "match" | "soiree" | "joueur"; id: string } | null;
    avatar: { nom: string; initiales: string; photo: string | null } | null;
  };
  const r = records;
  const av = (c: { name: string; photo: string | null }) => ({
    nom: c.name,
    initiales: ini(c.name),
    photo: c.photo,
  });
  const lignesRecords: LigneRecord[] = [];
  if (r.plusLargeVictoire) {
    const m = r.plusLargeVictoire;
    lignesRecords.push({
      cle: "ecart",
      titre: "La plus large victoire",
      valeur: `${m.scoreA} – ${m.scoreB}`,
      contexte: `${m.nomA} contre ${m.nomB} · ${D.jourCourt(m.date)}`,
      cible: { quoi: "match", id: m.matchId },
      avatar: null,
    });
  }
  if (r.matchLePlusFou) {
    const m = r.matchLePlusFou;
    lignesRecords.push({
      cle: "fou",
      titre: "Le match le plus fou",
      valeur: `${m.total} buts`,
      contexte: `${m.nomA} ${m.scoreA} – ${m.scoreB} ${m.nomB} · ${D.jourCourt(m.date)}`,
      cible: { quoi: "match", id: m.matchId },
      avatar: null,
    });
  }
  if (r.soireeLaPlusFolle) {
    const s = r.soireeLaPlusFolle;
    lignesRecords.push({
      cle: "soiree",
      titre: "La soirée la plus prolifique",
      valeur: `${s.buts} buts`,
      contexte: `${s.matchs} matchs · ${D.jourLong(s.date)}`,
      cible: { quoi: "soiree", id: s.matchDayId },
      avatar: null,
    });
  }
  if (r.leCarton) {
    const c = r.leCarton;
    lignesRecords.push({
      cle: "carton",
      titre: "Le carton d'un soir",
      valeur: `${c.valeur} buts`,
      contexte: `${c.name} · en un match${c.date ? ` · ${D.jourCourt(c.date)}` : ""}`,
      cible: c.matchId
        ? { quoi: "match", id: c.matchId }
        : { quoi: "joueur", id: c.playerId },
      avatar: av(c),
    });
  }
  if (r.laSoireeDUnHomme) {
    const c = r.laSoireeDUnHomme;
    lignesRecords.push({
      cle: "homme-soiree",
      titre: "La soirée d'un homme",
      valeur: `${c.valeur} buts`,
      contexte: `${c.name} · sur la soirée${c.date ? ` · ${D.jourCourt(c.date)}` : ""}`,
      cible: { quoi: "soiree", id: c.matchDayId },
      avatar: av(c),
    });
  }
  if (r.laPlusLongueSerie) {
    const c = r.laPlusLongueSerie;
    lignesRecords.push({
      cle: "serie",
      titre: "La plus longue série",
      valeur: `${c.valeur} victoires`,
      contexte: `${c.name} · d'affilée`,
      cible: { quoi: "joueur", id: c.playerId },
      avatar: av(c),
    });
  }
  if (r.laPaire) {
    const p = r.laPaire;
    lignesRecords.push({
      cle: "paire",
      titre: "La paire",
      valeur: `${p.pct} %`,
      contexte: `${p.a.name} et ${p.b.name} · ${p.victoires} V en ${p.ensemble} matchs ensemble`,
      cible: { quoi: "joueur", id: p.a.playerId },
      avatar: av(p.a),
    });
  }
  if (r.linoxydable) {
    const c = r.linoxydable;
    lignesRecords.push({
      cle: "inox",
      titre: "L'inoxydable",
      valeur: `${c.valeur} matchs`,
      contexte: `${c.name} · toujours là`,
      cible: { quoi: "joueur", id: c.playerId },
      avatar: av(c),
    });
  }

  return NextResponse.json({
    saisons: {
      choisie,
      choix: [
        ...saisons.map((s) => ({ id: s.id, libelle: libelleSaison(s.name) })),
        { id: "all", libelle: "Toutes saisons" },
      ],
    },
    chasubles: { a: club.colorA, b: club.colorB },
    droits: { peutScorer: ctx.canScore },
    tableau: ordre.map((l, i) => ({
      ...carte(l),
      rang: i + 1,
      invite: l.isGuest,
      matchs: l.matchesPlayed,
      victoires: l.wins,
      nuls: l.draws,
      defaites: l.losses,
      buts: l.goals,
      points: points(l, club.pointsWin, club.pointsDraw),
    })),
    buteurs: buteurs.map((l, i) => ({
      ...carte(l),
      rang: i + 1,
      buts: l.goals,
      // La part de la barre est calculée ici : elle se lit par rapport au
      // MEILLEUR buteur, pas par rapport à un maximum absolu.
      part: maxButs > 0 ? l.goals / maxButs : 0,
    })),
    // La forme se lit dans l'ordre du tableau, pour retrouver chacun à la
    // même place d'un onglet à l'autre. Et la plus récente à DROITE, là où
    // l'œil finit — c'est de là que part la série.
    forme: ordre.map((l) => ({
      ...carte(l),
      forme: [...l.form].reverse(),
      serie: l.streak,
    })),
    palmares: {
      titre: honneurs
        ? `Palmarès ${honneurs.seasonName}`
        : choisie === "all"
          ? "Palmarès · toutes saisons"
          : "Palmarès de la saison",
      titres: palmares,
    },
    saisonsPassees: passees.map((h) => ({
      saison: h.seasonName,
      lignes: [
        h.topScorer
          ? `Meilleur buteur ${h.topScorer.name} · ${h.topScorer.value} but${h.topScorer.value > 1 ? "s" : ""}`
          : null,
        h.topMvp
          ? `Homme du match ${h.topMvp.name} · ${h.topMvp.value} titre${h.topMvp.value > 1 ? "s" : ""}`
          : null,
      ].filter((x): x is string => x !== null),
      vide: !h.topScorer && !h.topMvp,
    })),
    derby:
      derby && derby.matchs > 0
        ? {
            titre: `${derby.nomA} contre ${derby.nomB}`,
            nomA: derby.nomA,
            nomB: derby.nomB,
            lettreA: lettre(derby.nomA),
            lettreB: lettre(derby.nomB),
            victoiresA: derby.victoiresA,
            victoiresB: derby.victoiresB,
            nuls: derby.nuls,
            total: derby.victoiresA + derby.victoiresB + derby.nuls,
            mene:
              derby.victoiresA > derby.victoiresB
                ? "A"
                : derby.victoiresB > derby.victoiresA
                  ? "B"
                  : null,
            butsA: derby.butsA,
            butsB: derby.butsB,
            soireesA: derby.soireesA,
            soireesB: derby.soireesB,
            soireesPartagees: derby.soireesPartagees,
            serie:
              derby.serie === 0
                ? null
                : `${Math.abs(derby.serie)} victoire${Math.abs(derby.serie) > 1 ? "s" : ""} d'affilée pour ${derby.serie > 0 ? derby.nomA : derby.nomB}`,
          }
        : null,
    gardiens: gardiens.map((g) => ({
      playerId: g.playerId,
      nom: g.name,
      initiales: ini(g.name),
      photo: g.photo ?? null,
      camp: camp(g.playerId),
      matchs: g.matchs,
      encaisses: g.encaisses,
      moyenne: g.moyenne,
      cleanSheets: g.cleanSheets,
      pctVictoires: g.pctVictoires,
    })),
    records: {
      lignes: lignesRecords,
      // « Sur 4 matchs joués — ça va bouger vite. » : la carte doit dire la
      // jeunesse du club plutôt que de laisser croire à des records établis.
      jeunesse:
        r.matchsPrisEnCompte < 10
          ? `Sur ${r.matchsPrisEnCompte} match${r.matchsPrisEnCompte > 1 ? "s" : ""} joué${r.matchsPrisEnCompte > 1 ? "s" : ""} — ça va bouger vite.`
          : null,
    },
    adversaires:
      externe.played > 0
        ? {
            matchs: externe.played,
            victoires: externe.wins,
            nuls: externe.draws,
            defaites: externe.losses,
            butsPour: externe.goalsFor,
            butsContre: externe.goalsAgainst,
            points: externe.points,
            forme: [...externe.form].reverse(),
            duels: externe.byOpponent.map((o) => ({
              id: o.opponentId,
              nom: o.name,
              victoires: o.wins,
              nuls: o.draws,
              defaites: o.losses,
              butsPour: o.goalsFor,
              butsContre: o.goalsAgainst,
              diff: o.goalsFor - o.goalsAgainst,
            })),
          }
        : null,
  });
}
