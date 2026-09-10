import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClubApiContext } from "@/lib/guard";
import { getGardiens, getPlayerDetail, getTropheesJoueur } from "@/lib/stats";
import { trierParPoints } from "@/lib/classement";
import { nomsChasubles } from "@/lib/color";
import { ini } from "@/lib/ini";
import { idsValides } from "@/lib/ids";
import { jourCourt } from "@/lib/dates";
import { entreeDepuisCorps, nettoyerJoueur } from "@/lib/joueur";

export const dynamic = "force-dynamic";

/// La carte d'identité d'un joueur.
///
/// Tout arrive fait : le sous-titre assemblé, les libellés, les chiffres. Un
/// 404 aussi bien pour un club qu'on ne connaît pas que pour un joueur qui
/// n'y appartient pas — répondre « interdit » confirmerait une devinette.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ clubId: string; playerId: string }> },
) {
  const { clubId, playerId } = await params;
  const ctx = await getClubApiContext(clubId);
  if (!ctx) return NextResponse.json({ error: "introuvable" }, { status: 404 });

  const detail = await getPlayerDetail(clubId, playerId);
  if (!detail) return NextResponse.json({ error: "introuvable" }, { status: 404 });

  const saison = await prisma.season.findFirst({
    where: { clubId, isActive: true },
    select: { id: true },
  });

  const [participations, gardiens, trophees, classement] = await Promise.all([
    // La chasuble habituelle : la majorité de ses apparitions cette saison.
    prisma.matchParticipant.findMany({
      where: {
        playerId,
        match: { clubId, status: "FINISHED", seasonId: saison?.id ?? undefined },
      },
      select: { initialTeam: true },
    }),
    // Toutes saisons, comme le reste de la fiche : le bilan, les paliers et
    // les trophées sont des carrières. Le limiter à la saison en cours faisait
    // disparaître la carte « Dans les buts » d'un gardien qui n'a pas encore
    // gardé depuis septembre.
    getGardiens({ clubId }),
    getTropheesJoueur(clubId, playerId),
    // Le rang au tableau, dans l'ordre du tableau — pas celui des buteurs.
    (async () => {
      const { getLeaderboard } = await import("@/lib/stats");
      return getLeaderboard({ clubId, seasonId: saison?.id ?? null });
    })(),
  ]);

  const a = participations.filter((p) => p.initialTeam === "A").length;
  const b = participations.filter((p) => p.initialTeam === "B").length;
  // Égalité → « A », comme le web : il faut bien trancher, et l'écusson doit
  // avoir une couleur.
  const camp = participations.length === 0 ? null : b > a ? "B" : "A";

  const noms = nomsChasubles(ctx.club.colorA, ctx.club.colorB);
  // « 2e du tableau » veut dire deuxième AU TABLEAU — celui que l'app affiche,
  // trié aux points. `getLeaderboard` rend l'ordre des buteurs ; s'en servir
  // ici donnait un rang que la page du classement contredisait deux écrans
  // plus loin. Et on ne compte que ceux qui ont joué : un inscrit qui n'est
  // jamais venu ne fait reculer personne.
  const rang =
    trierParPoints(
      classement.filter((r) => r.matchesPlayed > 0),
      ctx.club.pointsWin,
      ctx.club.pointsDraw,
    ).findIndex((r) => r.playerId === playerId) + 1;

  const p = detail.player;
  const sousTitre = [
    camp ? (camp === "A" ? noms.a : noms.b) : null,
    `Niveau ${p.skill}`,
    p.isGk ? "gardien" : null,
    p.isGuest ? "invité" : null,
    rang > 0 ? `${rang}${rang === 1 ? "er" : "e"} du tableau` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const gk = gardiens.find((g) => g.playerId === playerId) ?? null;

  return NextResponse.json({
    joueur: {
      id: p.id,
      nom: p.name,
      surnom: p.nickname,
      photo: p.photo,
      initiales: ini(p.name),
      niveau: p.skill,
      estGardien: p.isGk,
      estInvite: p.isGuest,
      abonne: p.abonne,
      estMoi: p.userId === ctx.user.id,
      camp,
      badge: p.isGk ? "G" : String(p.skill),
      sousTitre,
      couleur: camp === "B" ? ctx.club.colorB : ctx.club.colorA,
    },
    chasubles: { a: ctx.club.colorA, b: ctx.club.colorB },
    passesSuivies: ctx.club.trackAssists,
    droits: {
      peutModifier: ctx.canManage,
      peutReglerAbonnement: ctx.canManage || p.userId === ctx.user.id,
    },
    bilan:
      detail.allTime && detail.allTime.matchesPlayed > 0
        ? {
            matchs: detail.allTime.matchesPlayed,
            buts: detail.allTime.goals,
            passes: detail.allTime.assists,
            hommeDuMatch: detail.allTime.mvpCount,
            pctVictoires: detail.allTime.winPct,
            victoires: detail.allTime.wins,
            nuls: detail.allTime.draws,
            defaites: detail.allTime.losses,
            butsParMatch: detail.allTime.goalsPerMatch,
            // `getLeaderboard` rend la forme la plus RÉCENTE en premier ; on
            // la retourne pour la lire de gauche à droite, la dernière à
            // droite — c'est de là que part la série, et c'est ce que fait la
            // page des stats. La fiche du site, elle, l'affichait à l'envers.
            forme: [...detail.allTime.form].reverse(),
            serie: detail.allTime.streak,
            elo: detail.allTime.elo,
            eloTendance: detail.allTime.eloTrend,
          }
        : null,
    gardien: gk
      ? {
          matchs: gk.matchs,
          butsEncaisses: gk.encaisses,
          moyenne: gk.moyenne,
          cleanSheets: gk.cleanSheets,
          pctVictoires: gk.pctVictoires,
        }
      : null,
    paliers: trophees.paliers.map((p) => ({
      cle: p.cle,
      titre: p.titre,
      actuel: p.actuel,
      objectif: p.objectif,
      // Le texte est assemblé ici pour que « encore 3 buts » et « encore 1
      // but » sortent pareil des deux côtés : le pluriel est une règle du
      // club, pas une affaire d'écran.
      reste: p.objectif - p.actuel,
      libelle: `encore ${p.objectif - p.actuel} ${
        p.objectif - p.actuel > 1 ? p.nom : p.nomSingulier
      } pour ${p.objectif}`,
      part: Math.min(1, p.actuel / p.objectif),
    })),
    trophees: trophees.obtenus.map((t) => ({
      cle: t.cle,
      nom: t.nom,
      detail: t.detail,
      quand: t.date ? jourCourt(t.date) : null,
    })),
    parSaison: detail.bySeason.map((s) => ({
      saisonId: s.seasonId,
      saison: s.seasonName,
      matchs: s.row.matchesPlayed,
      buts: s.row.goals,
      victoires: s.row.wins,
      pctVictoires: s.row.winPct,
    })),
    // La ligne d'un dernier match arrive prête à peindre : la date courte, les
    // deux moitiés du libellé et les deux scores séparés. L'app n'a pas à
    // découper « Blanc vs Noir » ni « 3-2 » — c'est le genre de calcul qui
    // finit par diverger d'un écran à l'autre.
    derniersMatchs: detail.recentMatches.map((m) => {
      const [sa, sb] = m.score.split("-").map((n) => Number(n) || 0);
      const [gauche, droite] = m.label.includes(" vs ")
        ? m.label.split(" vs ")
        : [m.label, ""];
      return {
        id: m.id,
        date: jourCourt(new Date(m.playedAt)),
        gauche,
        droite,
        scoreA: sa,
        scoreB: sb,
        resultat: m.result,
        buts: m.goals,
        homme: m.wasMvp,
      };
    }),
  });
}

/// Modifier une fiche, ou la ranger au fond du vestiaire.
///
/// Le jumeau HTTP de `updatePlayer` et de `setPlayerArchived`, réunis : côté
/// site ce sont deux gestes d'interface distincts, côté app c'est le même
/// formulaire, et deux endpoints obligeraient l'écran à envoyer deux requêtes
/// pour un seul « Enregistrer » — avec la moitié qui passe et l'autre qui
/// échoue comme récompense.
///
/// **Modification partielle** : un champ absent du corps ne bouge pas. C'est
/// ce qui permet à l'écran de n'envoyer que ce qui a changé, et ce qui évite
/// qu'un formulaire ouvert avant une photo prise sur un autre téléphone
/// l'efface en enregistrant un surnom.
///
/// L'abonnement n'est PAS ici : il a son endpoint, ouvert à chacun pour
/// lui-même (`joueurs/[playerId]/abonnement`), là où ce PATCH est réservé aux
/// gérants. Les mélanger rendrait « je viens tous les lundis » réservé aux
/// admins, ce que le club a justement voulu éviter.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ clubId: string; playerId: string }> },
) {
  const { clubId, playerId } = await params;
  const ctx = await getClubApiContext(clubId);
  if (!ctx) return NextResponse.json({ error: "introuvable" }, { status: 404 });
  if (!idsValides(playerId)) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  }
  if (!ctx.canManage) {
    return NextResponse.json({ error: "Réservé aux admins." }, { status: 403 });
  }

  const corps = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const data = nettoyerJoueur(entreeDepuisCorps(corps));
  // `abonne` a son endpoint et ses propres droits : reçu ici, il est ignoré
  // plutôt qu'écrit en douce sous le contrôle « admin ».
  delete (data as { abonne?: boolean }).abonne;

  // Le nom ne peut pas devenir vide. `nettoyerJoueur` laisse tomber une chaîne
  // blanche, ce qui, sans ce contrôle, ferait passer un champ effacé par
  // mégarde pour « je n'ai pas touché au nom ».
  if (corps && "nom" in corps && !data.name) {
    return NextResponse.json({ error: "Nom requis." }, { status: 400 });
  }

  // Une photo d'un format ou d'un poids refusés ressort à `null` de
  // `nettoyerJoueur`, sans bruit. On le DIT : annoncer « enregistré » sur une
  // fiche qui reviendra sans visage, c'est faire chercher la panne du côté du
  // réseau alors qu'elle est dans le fichier.
  const photoRefusee = typeof corps?.photo === "string" && data.photo == null;

  const archive = corps?.archive;
  if (archive !== undefined && typeof archive !== "boolean") {
    return NextResponse.json({ error: "Valeur invalide." }, { status: 400 });
  }

  // Rien de reconnu dans le corps : on le DIT. `updateMany` avec un `data`
  // vide ne touche aucune ligne et renvoie `count: 0`, indiscernable d'un
  // joueur qui n'existe pas — l'app aurait affiché « ce joueur n'est plus au
  // vestiaire » à quelqu'un qui a simplement envoyé un champ que ce PATCH ne
  // règle pas (`abonne`, par exemple, qui a le sien).
  if (Object.keys(data).length === 0 && archive === undefined) {
    return NextResponse.json({ error: "Rien à modifier." }, { status: 400 });
  }

  // updateMany plutôt qu'update : le filtre `clubId` reste appliqué au moment
  // de l'écriture, et le compte retourné dit si la fiche appartenait bien à ce
  // club — 404 comme le GET, plutôt qu'un 403 qui confirmerait son existence.
  const res = await prisma.player.updateMany({
    where: { id: playerId, clubId },
    data: {
      ...data,
      ...(typeof archive === "boolean" ? { isArchived: archive } : {}),
    },
  });
  if (res.count === 0) {
    return NextResponse.json({ error: "introuvable" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    ...(photoRefusee
      ? { avertissement: "La photo n'a pas pu être enregistrée : format ou taille refusés." }
      : null),
  });
}
