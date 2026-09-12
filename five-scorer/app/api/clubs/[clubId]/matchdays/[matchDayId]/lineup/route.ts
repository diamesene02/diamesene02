import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClubApiContext } from "@/lib/guard";
import { estId } from "@/lib/ids";
import { ecrireCompo, type JoueurCompo } from "@/lib/compo";

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

/// Poser la composition depuis le téléphone.
///
/// Elle n'existait que comme action serveur Next (`app/actions/compo.ts`),
/// donc hors de portée d'un client React Native : la décision se prend sur
/// WhatsApp, sur le téléphone, et il fallait changer d'appareil pour l'écrire
/// (spec 0005).
///
/// **Remplace l'ensemble.** Le corps porte la liste entière, pas un delta —
/// c'est ce qui rend le rejeu sûr et le dernier-arrivé-gagne honnête quand
/// deux téléphones composent hors ligne. Rejouer deux fois la même opération
/// donne le même résultat qu'une fois : la file d'attente compte là-dessus.
///
/// Les règles sont dans `lib/compo.ts`, partagées avec le site. Ici : la
/// garde, la lecture du corps, et la traduction en codes HTTP.
export async function PUT(req: Request, { params }: Ctx) {
  const { clubId, matchDayId } = await params;
  if (!estId(matchDayId)) {
    return NextResponse.json({ error: "introuvable" }, { status: 404 });
  }
  const ctx = await getClubApiContext(clubId);
  if (!ctx) return NextResponse.json({ error: "introuvable" }, { status: 404 });

  // `canScore`, pas `canManage` : qui peut marquer peut composer. C'est la
  // règle du site (app/actions/compo.ts), et être plus sévère ici créerait
  // deux droits pour un même geste selon l'appareil.
  if (!ctx.canScore) {
    return NextResponse.json({ error: "droits insuffisants" }, { status: 403 });
  }

  let corps: unknown;
  try {
    corps = await req.json();
  } catch {
    return NextResponse.json({ error: "corps illisible" }, { status: 400 });
  }
  if (typeof corps !== "object" || corps === null) {
    return NextResponse.json({ error: "corps illisible" }, { status: 400 });
  }
  const c = corps as Record<string, unknown>;
  if (!Array.isArray(c.joueurs)) {
    return NextResponse.json({ error: "joueurs manquant" }, { status: 400 });
  }

  const r = await ecrireCompo(ctx.club.id, matchDayId, {
    joueurs: c.joueurs as JoueurCompo[],
    teamAName: typeof c.teamAName === "string" ? c.teamAName : undefined,
    teamBName: typeof c.teamBName === "string" ? c.teamBName : undefined,
  });
  // 400 et pas 500 : ce sont des refus de données, et la file d'attente doit
  // pouvoir les distinguer d'une panne (un 5xx se retente, un 4xx se bloque).
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });

  return NextResponse.json({ ok: true });
}
