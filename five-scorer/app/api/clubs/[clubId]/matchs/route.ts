import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClubApiContext } from "@/lib/guard";
import { lettre } from "@/lib/ini";
import { heure, jourCourt2, jourLong2, minuit } from "@/lib/dates";

export const dynamic = "force-dynamic";

/// L'écran « Les matchs », en un aller-retour.
///
/// **Aucun paramètre de filtre.** La page web refait un tour de serveur à
/// chaque pilule tapée ; au bord d'un terrain, c'est une seconde et un peu de
/// batterie pour changer un mot. Chaque ligne porte donc sa saison et son
/// genre, et l'app filtre en local.
///
/// **Rien à formater sur le téléphone.** Les libellés français sont calculés
/// ici, en Europe/Paris, par `lib/dates.ts` — le même code que le site. Le
/// moteur JavaScript de React Native n'embarque pas les fuseaux, et une
/// soirée du lundi 20 h ne doit pas s'afficher à 18 h.
///
/// **Le regroupement par soirée n'est pas un arbre.** Chaque match joué porte
/// son groupe, et l'app regroupe après avoir filtré : un arbre pré-construit
/// redeviendrait faux dès la première pilule.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  const { clubId } = await params;
  const ctx = await getClubApiContext(clubId);
  if (!ctx) return NextResponse.json({ error: "introuvable" }, { status: 404 });

  const champs = {
    id: true,
    seasonId: true,
    kind: true,
    status: true,
    playedAt: true,
    scheduledAt: true,
    teamAName: true,
    teamBName: true,
    scoreA: true,
    scoreB: true,
    opponent: { select: { name: true } },
    mvp: { select: { name: true } },
    matchDay: { select: { id: true, date: true, title: true, location: true } },
  } as const;

  const [saisons, direct, programmes, joues] = await Promise.all([
    prisma.season.findMany({
      where: { clubId },
      orderBy: { startsAt: "desc" },
      select: { id: true, name: true, isActive: true },
    }),
    prisma.match.findMany({
      where: { clubId, status: "LIVE" },
      orderBy: { playedAt: "desc" },
      select: champs,
    }),
    prisma.match.findMany({
      where: { clubId, status: "SCHEDULED" },
      orderBy: [{ scheduledAt: "asc" }, { playedAt: "asc" }],
      select: champs,
    }),
    // Du plus récent au plus ancien : l'app regroupe par soirée dans cet
    // ordre, donc les soirées sortent naturellement de la plus récente à la
    // plus ancienne, et les matchs d'une soirée dans l'ordre où ils ont été
    // joués (on inverse à l'intérieur d'un groupe côté app).
    prisma.match.findMany({
      where: { clubId, status: "FINISHED" },
      orderBy: { playedAt: "desc" },
      take: 300,
      select: champs,
    }),
  ]);

  type Ligne = (typeof joues)[number];

  /// Le camp B est déjà résolu ici : l'adversaire quand il y en a un, la
  /// chasuble sinon. L'app n'a pas à rejouer cette règle.
  const camps = (m: Ligne) => {
    const nomA = m.teamAName;
    const nomB = m.kind === "EXTERNAL" && m.opponent ? m.opponent.name : m.teamBName;
    return {
      a: { nom: nomA, lettre: lettre(nomA) },
      b: { nom: nomB, lettre: lettre(nomB) },
    };
  };

  const commun = (m: Ligne) => ({
    id: m.id,
    saisonId: m.seasonId,
    genre: m.kind,
    ...camps(m),
  });

  return NextResponse.json({
    saisons: saisons.map((s) => ({ id: s.id, nom: s.name, active: s.isActive })),
    saisonParDefaut: saisons.find((s) => s.isActive)?.id ?? "toutes",

    direct: direct.map((m) => ({ ...commun(m), scoreA: m.scoreA, scoreB: m.scoreB })),

    programmes: programmes.map((m) => {
      const q = m.scheduledAt ?? m.playedAt;
      return {
        ...commun(m),
        quand: q.toISOString(),
        jour: jourCourt2(q),
        heure: heure(q),
        lieu: m.matchDay?.location ?? null,
        presents: 0,
      };
    }),

    joues: joues.map((m) => {
      const jour = m.matchDay?.date ?? m.playedAt;
      return {
        ...commun(m),
        joueLe: m.playedAt.toISOString(),
        heure: heure(m.playedAt),
        scoreA: m.scoreA,
        scoreB: m.scoreB,
        vainqueur: m.scoreA > m.scoreB ? "A" : m.scoreB > m.scoreA ? "B" : null,
        adversaire: m.kind === "EXTERNAL" ? (m.opponent?.name ?? m.teamBName) : null,
        hommeDuMatch: m.mvp?.name ?? null,
        groupe: {
          // La clé d'un match sans soirée est son quantième à Paris, et non
          // `getMonth()` : un match du 1er à 00 h 30 se rangerait au mois
          // précédent dans le fuseau du processus.
          cle: m.matchDay?.id ?? `jour-${new Date(minuit(jour)).toISOString().slice(0, 10)}`,
          titreJour: jourLong2(jour),
          sousTitre: m.matchDay?.title ?? null,
          date: jour.toISOString(),
        },
      };
    }),
  });
}
