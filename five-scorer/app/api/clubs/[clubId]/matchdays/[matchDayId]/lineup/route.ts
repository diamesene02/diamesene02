import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClubApiContext } from "@/lib/guard";
import { estId } from "@/lib/ids";

type Ctx = { params: Promise<{ clubId: string; matchDayId: string }> };

/// La composition PRÉPARÉE d'une soirée.
///
/// Le club décide ses équipes trois ou quatre jours avant, sur WhatsApp. La
/// table `MatchDayLineup` a été créée pour que cette décision soit écrite
/// quelque part au lieu d'être refaite debout au bord du terrain — et sans cet
/// endpoint, l'app native repart d'une page blanche au coup d'envoi, ce qui est
/// exactement le problème que la table supprimait.
///
/// La soirée voyage avec la compo : l'écran affiche « lun. 14 sept. · Blanc /
/// Noir » sans second aller-retour, et les noms d'équipes de la soirée
/// remplacent ceux du club quand ils existent (`teamAName` nul = on retombe
/// sur les noms par défaut, comme sur le site).
export async function GET(_req: Request, { params }: Ctx) {
  const { clubId, matchDayId } = await params;
  // Identifiant venu du client → `estId` avant tout `where` Prisma.
  if (!estId(matchDayId)) {
    return NextResponse.json({ error: "introuvable" }, { status: 404 });
  }
  const ctx = await getClubApiContext(clubId);
  if (!ctx) return NextResponse.json({ error: "introuvable" }, { status: 404 });

  const soiree = await prisma.matchDay.findFirst({
    // Le `clubId` est dans le filtre, pas vérifié après coup : une soirée d'un
    // autre club doit être introuvable, pas lue puis rejetée.
    where: { id: matchDayId, clubId },
    select: {
      id: true,
      date: true,
      title: true,
      location: true,
      canceledAt: true,
      teamAName: true,
      teamBName: true,
      lineup: {
        select: { playerId: true, team: true, isGk: true },
      },
    },
  });
  if (!soiree) {
    return NextResponse.json({ error: "introuvable" }, { status: 404 });
  }

  return NextResponse.json({
    matchDay: {
      id: soiree.id,
      date: soiree.date.toISOString(),
      title: soiree.title,
      location: soiree.location,
      canceled: soiree.canceledAt != null,
      teamAName: soiree.teamAName,
      teamBName: soiree.teamBName,
    },
    // Une compo vide n'est pas une erreur : c'est « pas encore faite ». C'est
    // ce que l'accueil affiche en ambre, et ce que l'écran de compo propose de
    // remplir.
    lineup: soiree.lineup.map((l) => ({
      playerId: l.playerId,
      team: l.team,
      isGk: l.isGk,
    })),
  });
}
