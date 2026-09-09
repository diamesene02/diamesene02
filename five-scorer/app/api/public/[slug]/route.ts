import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLeaderboard } from "@/lib/stats";
import { themeTokens } from "@/lib/theme";
import * as D from "@/lib/dates";

export const dynamic = "force-dynamic";

/// La vitrine du club, en JSON.
///
/// L'app mobile ne peut pas lire Prisma : il lui faut du HTTP. Voici le
/// premier endpoint, et il est délibérément PUBLIC — comme la page /p/[slug]
/// dont il reprend exactement le périmètre et la même garde `isPublic`.
///
/// Pourquoi commencer par du public : une app qu'on ouvre dans Expo Go doit
/// montrer quelque chose de vrai AVANT qu'on ait porté l'authentification.
/// Sans lui, le premier écran serait un formulaire de connexion, et on ne
/// saurait pas si le reste marche.
///
/// Il ne rend rien qu'un visiteur ne voie déjà sur la page publique : pas
/// d'e-mail, pas de présences, pas de compte lié, pas de prix du terrain.
/// La vitrine est publique : elle peut donc être lue depuis n'importe quelle
/// origine. Sans ces en-têtes, l'app Expo rendue dans un navigateur (la cible
/// « web », qui sert à travailler sans téléphone) se heurte au contrôle
/// d'origine et échoue sur un « Failed to fetch » qui ne dit rien. Sur un
/// vrai appareil la question ne se pose pas — le contrôle d'origine est une
/// règle de NAVIGATEUR, pas de réseau.
const ENTETES_CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "accept, content-type",
  "access-control-max-age": "86400",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: ENTETES_CORS });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const org = await prisma.organization.findUnique({
    where: { slug },
    include: { club: true },
  });
  if (!org?.club || !org.club.isPublic) {
    return NextResponse.json(
      { error: "introuvable" },
      { status: 404, headers: ENTETES_CORS },
    );
  }
  const club = org.club;

  const saison = await prisma.season.findFirst({
    where: { clubId: club.id, isActive: true },
    orderBy: { startsAt: "desc" },
    select: { id: true, name: true },
  });

  const [classement, derniers] = await Promise.all([
    getLeaderboard({ clubId: club.id, seasonId: saison?.id ?? null }),
    prisma.match.findMany({
      where: { clubId: club.id, status: "FINISHED" },
      orderBy: { playedAt: "desc" },
      take: 5,
      include: { mvp: { select: { name: true } }, opponent: { select: { name: true } } },
    }),
  ]);

  return NextResponse.json(
    {
    club: {
      slug,
      nom: org.name,
      couleurA: club.colorA,
      couleurB: club.colorB,
      // Les jetons du thème sont calculés ici plutôt que dans l'app : la
      // règle qui dérive les couleurs des chasubles vit dans lib/theme.ts et
      // ne doit exister qu'à un seul endroit, sinon le web et le mobile
      // divergeront au premier ajustement.
      theme: {
        sombre: themeTokens(club.colorA, club.colorB, "dark"),
        clair: themeTokens(club.colorA, club.colorB, "light"),
      },
    },
    saison: saison ? { id: saison.id, nom: saison.name } : null,
    classement: classement.slice(0, 20).map((r) => ({
      playerId: r.playerId,
      nom: r.name,
      photo: r.photo,
      matchs: r.matchesPlayed,
      buts: r.goals,
      victoires: r.wins,
      nuls: r.draws,
      defaites: r.losses,
      pctVictoires: r.winPct,
      elo: r.elo,
      forme: r.form,
      serie: r.streak,
      hommeDuMatch: r.mvpCount,
    })),
    derniersMatchs: derniers.map((m) => ({
      id: m.id,
      quand: m.playedAt.toISOString(),
      quandCourt: D.jourCourt(m.playedAt),
      nomA: m.teamAName,
      nomB: m.kind === "EXTERNAL" && m.opponent ? m.opponent.name : m.teamBName,
      scoreA: m.scoreA,
      scoreB: m.scoreB,
      hommeDuMatch: m.mvp?.name ?? null,
    })),
    },
    { headers: ENTETES_CORS },
  );
}
