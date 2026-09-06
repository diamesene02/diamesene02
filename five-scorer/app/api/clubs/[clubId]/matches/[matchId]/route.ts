import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClubApiContext } from "@/lib/guard";

type Ctx = { params: Promise<{ clubId: string; matchId: string }> };

type PatchBody = {
  status?: "FINISHED";
  mvpId?: string | null;
  durationMin?: number | null;
  teamAName?: string;
  teamBName?: string;
  notes?: string | null;
};

export async function PATCH(req: Request, { params }: Ctx) {
  const { clubId, matchId } = await params;
  const ctx = await getClubApiContext(clubId);
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!ctx.canScore) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const match = await prisma.match.findFirst({
    where: { id: matchId, clubId },
  });
  if (!match) {
    return NextResponse.json({ error: "Match introuvable" }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as PatchBody | null;
  if (!body) {
    return NextResponse.json({ error: "Payload invalide" }, { status: 400 });
  }

  // Terminer un match LIVE : ouvert à qui peut scorer (idempotent).
  // Toute retouche d'un match déjà FINISHED : admin.
  const isFinishing = body.status === "FINISHED" && match.status === "LIVE";
  const isIdempotentFinish =
    body.status === "FINISHED" && match.status === "FINISHED";
  if (!isFinishing && !isIdempotentFinish && !ctx.canManage) {
    return NextResponse.json(
      { error: "Admin requis pour modifier un match terminé" },
      { status: 403 },
    );
  }

  if (body.mvpId) {
    const mvpOk = await prisma.player.count({
      where: { id: body.mvpId, clubId },
    });
    if (!mvpOk) {
      return NextResponse.json({ error: "MVP hors du club" }, { status: 400 });
    }
  }

  // « Terminer un match déjà terminé » est toléré pour que la file d'attente
  // hors-ligne puisse rejouer sans erreur — mais ce rejeu doit être INERTE.
  // Il ne l'était pas : mvpId et durationMin s'écrivaient sans condition de
  // rôle, si bien qu'un simple membre réécrivait l'homme du match et la durée
  // d'une rencontre close. Et le cas n'était pas théorique : c'est exactement
  // ce que produisait le scénario des deux téléphones, le finishMatch en file
  // arrivant après le createMatch refusé.
  // Le rejeu inerte est une propriété du REJEU, pas du rôle de l'émetteur.
  //
  // La condition portait aussi sur `!ctx.canManage` : pour un admin, un
  // finishMatch resté en file hors ligne réécrivait donc mvpId et durationMin
  // d'un match déjà terminé. Or ce corps n'est pas composé par un humain —
  // lib/sync.ts envoie toujours le mvpId qu'il avait au moment du tap, c'est-à-
  // dire null en mode vote. Un admin qui retrouve du réseau le lendemain
  // effaçait ainsi le MVP élu par le club. La retouche délibérée passe par
  // l'écran d'édition, qui vérifie déjà les droits.
  const rejeuInerte = isIdempotentFinish;

  const updated = await prisma.match.update({
    where: { id: matchId },
    data: {
      ...(body.status === "FINISHED" ? { status: "FINISHED" } : {}),
      ...(body.mvpId !== undefined && !rejeuInerte
        ? { mvpId: body.mvpId }
        : {}),
      ...(body.durationMin !== undefined && !rejeuInerte
        ? { durationMin: body.durationMin }
        : {}),
      ...(ctx.canManage && body.teamAName?.trim()
        ? { teamAName: body.teamAName.trim() }
        : {}),
      ...(ctx.canManage && body.teamBName?.trim()
        ? { teamBName: body.teamBName.trim() }
        : {}),
      ...(ctx.canManage && body.notes !== undefined
        ? { notes: body.notes }
        : {}),
    },
  });
  return NextResponse.json({ match: updated });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { clubId, matchId } = await params;
  const ctx = await getClubApiContext(clubId);
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!ctx.canManage) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  await prisma.match
    .delete({ where: { id: matchId, clubId } })
    .catch(() => null);
  return NextResponse.json({ ok: true });
}
