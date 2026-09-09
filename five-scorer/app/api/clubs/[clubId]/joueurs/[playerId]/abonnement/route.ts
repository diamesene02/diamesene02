import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClubApiContext } from "@/lib/guard";
import { idsValides } from "@/lib/ids";

export const dynamic = "force-dynamic";

/// « Je viens tous les lundis ».
///
/// L'abonnement est ce qui fait qu'un habitué compte présent sans avoir rien
/// dit — c'est le modèle réel du club, et c'est ce qui évite les soirées à
/// « 1 réponse ». Chacun règle le sien ; un gérant règle celui des habitués
/// qui n'ont pas de compte.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ clubId: string; playerId: string }> },
) {
  const { clubId, playerId } = await params;
  const ctx = await getClubApiContext(clubId);
  if (!ctx) return NextResponse.json({ error: "introuvable" }, { status: 404 });
  if (!idsValides(playerId)) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  }

  const corps = (await req.json().catch(() => null)) as { abonne?: unknown } | null;
  if (typeof corps?.abonne !== "boolean") {
    return NextResponse.json({ error: "Valeur invalide." }, { status: 400 });
  }

  const joueur = await prisma.player.findFirst({
    where: { id: playerId, clubId },
    select: { id: true, userId: true },
  });
  if (!joueur) return NextResponse.json({ error: "Introuvable." }, { status: 404 });

  if (joueur.userId !== ctx.user.id && !ctx.canManage) {
    return NextResponse.json({ error: "Ce n'est pas ton profil." }, { status: 403 });
  }

  await prisma.player.update({ where: { id: playerId }, data: { abonne: corps.abonne } });
  return NextResponse.json({ ok: true, abonne: corps.abonne });
}
