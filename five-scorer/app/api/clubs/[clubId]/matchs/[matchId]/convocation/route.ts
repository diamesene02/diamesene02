import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getClubApiContext } from "@/lib/guard";
import { estId } from "@/lib/ids";
import type { RsvpStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const STATUTS: RsvpStatus[] = ["IN", "OUT", "MAYBE"];

/// Répondre à la convocation d'un match programmé.
///
/// Mêmes règles que l'action serveur du site (`setMatchRsvp`,
/// app/actions/schedule.ts), sur le modèle de la route voisine qui répond à
/// une soirée : un membre répond pour son propre profil, un gérant pour
/// n'importe qui, et les convocations se ferment quand le match n'est plus
/// programmé — un refus dit, pas un silence.
///
/// Corps : `{ playerId: string, statut: "IN" | "MAYBE" | "OUT" }`.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ clubId: string; matchId: string }> },
) {
  const { clubId, matchId } = await params;
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
  if (!estId(matchId) || !estId(playerId)) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  }
  if (typeof statut !== "string" || !STATUTS.includes(statut as RsvpStatus)) {
    return NextResponse.json({ error: "Statut invalide." }, { status: 400 });
  }

  const [match, joueur] = await Promise.all([
    prisma.match.findFirst({
      where: { id: matchId, clubId },
      select: { id: true, status: true },
    }),
    prisma.player.findFirst({
      where: { id: playerId, clubId },
      select: { id: true, userId: true },
    }),
  ]);
  if (!match || !joueur) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  if (match.status !== "SCHEDULED") {
    return NextResponse.json({ error: "Les convocations sont closes." }, { status: 409 });
  }
  if (joueur.userId !== ctx.user.id && !ctx.canManage) {
    return NextResponse.json({ error: "Tu ne peux répondre que pour toi." }, { status: 403 });
  }

  await prisma.rsvp.upsert({
    where: { matchId_playerId: { matchId, playerId } },
    create: { matchId, playerId, status: statut as RsvpStatus },
    update: { status: statut as RsvpStatus },
  });

  revalidatePath(`/c/${ctx.org.slug}`);
  revalidatePath(`/c/${ctx.org.slug}/matches/${matchId}`);
  return NextResponse.json({ ok: true });
}
