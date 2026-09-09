import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClubApiContext } from "@/lib/guard";
import { serialiserClub } from "@/lib/clubApi";

export const dynamic = "force-dynamic";

/// Un seul club, dans la forme exacte que rend `/api/me`.
///
/// `/api/me` sert l'amorce : à la connexion, tous mes clubs d'un coup. Cet
/// endpoint-ci sert le rafraîchissement : quand un réglage change — le mode
/// homme du match, la durée d'un match, une couleur de chasuble — l'app n'a
/// aucune raison de retélécharger tous ses clubs, ni de reprendre le chemin
/// de la connexion.
///
/// La forme vient de `serialiserClub`, partagée avec `/api/me` : l'app écrit
/// les deux réponses dans la même table locale, elles ne peuvent pas diverger.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  const { clubId } = await params;
  const ctx = await getClubApiContext(clubId);
  // 404 plutôt que 403 pour un club dont on n'est pas membre : répondre
  // « interdit » confirmerait son existence à qui devine un identifiant.
  if (!ctx) return NextResponse.json({ error: "introuvable" }, { status: 404 });

  const joueur = await prisma.player.findFirst({
    where: { clubId, userId: ctx.user.id },
    select: { id: true, name: true, photo: true },
  });

  return NextResponse.json({
    club: serialiserClub(ctx.org, ctx.club, ctx.role, joueur),
  });
}
