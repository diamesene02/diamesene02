import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClubApiContext } from "@/lib/guard";
import { idsValides } from "@/lib/ids";
import type { RsvpStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const STATUTS: RsvpStatus[] = ["IN", "OUT", "MAYBE"];

/// Répondre à une soirée.
///
/// Mêmes règles que la server action du site (`app/actions/matchday.ts`) :
/// un membre répond pour son propre profil joueur, un gérant peut répondre
/// pour n'importe qui — c'est ainsi qu'on tient à jour les habitués qui n'ont
/// pas de compte.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ clubId: string; matchDayId: string }> },
) {
  const { clubId, matchDayId } = await params;
  const ctx = await getClubApiContext(clubId);
  if (!ctx) return NextResponse.json({ error: "introuvable" }, { status: 404 });

  const corps = (await req.json().catch(() => null)) as {
    playerId?: unknown;
    statut?: unknown;
  } | null;
  const playerId = corps?.playerId;
  const statut = corps?.statut;

  // Identifiants venus du client : refuser tout ce qui n'est pas une chaîne,
  // sinon un objet passe pour un filtre Prisma (cf. lib/ids.ts).
  if (typeof playerId !== "string" || !idsValides(matchDayId, playerId)) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  }
  if (typeof statut !== "string" || !STATUTS.includes(statut as RsvpStatus)) {
    return NextResponse.json({ error: "Statut invalide." }, { status: 400 });
  }

  const [md, joueur] = await Promise.all([
    prisma.matchDay.findFirst({ where: { id: matchDayId, clubId }, select: { id: true } }),
    prisma.player.findFirst({
      where: { id: playerId, clubId },
      select: { id: true, userId: true },
    }),
  ]);
  if (!md || !joueur) return NextResponse.json({ error: "Introuvable." }, { status: 404 });

  const cestMoi = joueur.userId === ctx.user.id;
  if (!cestMoi && !ctx.canManage) {
    return NextResponse.json({ error: "Tu ne peux répondre que pour toi." }, { status: 403 });
  }

  await prisma.rsvp.upsert({
    where: { matchDayId_playerId: { matchDayId, playerId } },
    create: { matchDayId, playerId, status: statut as RsvpStatus },
    update: { status: statut as RsvpStatus },
  });

  return NextResponse.json({ ok: true });
}
