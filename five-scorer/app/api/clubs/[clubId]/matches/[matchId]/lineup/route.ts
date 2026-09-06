import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClubApiContext } from "@/lib/guard";
import { idsValides } from "@/lib/ids";

type Ctx = { params: Promise<{ clubId: string; matchId: string }> };

type PatchBody = { playerId: string; team: "A" | "B" };

/// PATCH : fait changer un joueur de camp dans un match en cours.
///
/// L'erreur de composition ne se voit qu'au coup d'envoi. Avant, la seule
/// issue était de terminer le match et de tout ressaisir. L'écriture est
/// absolue (« ce joueur est dans l'équipe X »), pas incrémentale : la file
/// hors-ligne peut la rejouer sans jamais faire osciller la compo.
export async function PATCH(req: Request, { params }: Ctx) {
  const { clubId, matchId } = await params;
  const ctx = await getClubApiContext(clubId);
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!ctx.canScore) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as PatchBody | null;
  // Identifiants venus du client : refuser tout ce qui n'est pas une chaîne,
  // sinon un objet passe pour un filtre Prisma (cf. lib/ids.ts).
  if (!body || !idsValides(body.playerId)) {
    return NextResponse.json({ error: "playerId requis" }, { status: 400 });
  }
  if (body.team !== "A" && body.team !== "B") {
    return NextResponse.json({ error: "Équipe invalide" }, { status: 400 });
  }

  const match = await prisma.match.findFirst({
    where: { id: matchId, clubId },
    select: { status: true },
  });
  if (!match) {
    return NextResponse.json({ error: "Match introuvable" }, { status: 404 });
  }
  // Recomposer un match terminé, c'est réécrire l'histoire : réservé aux
  // admins, comme toute autre retouche rétroactive.
  if (match.status === "FINISHED" && !ctx.canManage) {
    return NextResponse.json(
      { error: "Admin requis pour modifier un match terminé" },
      { status: 403 },
    );
  }

  // Le joueur doit être inscrit à CE match : sans ce contrôle, la route
  // servirait à sonder l'existence de joueurs d'autres clubs.
  const updated = await prisma.matchParticipant.updateMany({
    where: { matchId, playerId: body.playerId },
    data: { team: body.team },
  });
  if (updated.count === 0) {
    return NextResponse.json(
      { error: "Joueur non inscrit à ce match" },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true });
}
