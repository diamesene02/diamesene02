import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClubApiContext } from "@/lib/guard";
import { idsValides } from "@/lib/ids";

export const dynamic = "force-dynamic";

/// Clôturer ou réactiver une saison.
///
/// Clôturer : `isActive: false` et une date de fin posée à maintenant. Après
/// ça le club n'a plus de saison active, et les nouveaux matchs ne
/// s'attachent plus à rien — c'est ce que l'app doit dire avant de le faire.
///
/// Réactiver : clôture d'abord celle en cours (l'invariant « une seule
/// active ») puis rouvre celle-ci, sa date de fin effacée.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ clubId: string; saisonId: string }> },
) {
  const { clubId, saisonId } = await params;
  if (!idsValides(saisonId)) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  }
  const ctx = await getClubApiContext(clubId);
  if (!ctx) return NextResponse.json({ error: "introuvable" }, { status: 404 });
  if (!ctx.canManage) {
    return NextResponse.json({ error: "Réservé aux admins." }, { status: 403 });
  }

  const corps = (await req.json().catch(() => null)) as { active?: unknown } | null;
  if (typeof corps?.active !== "boolean") {
    return NextResponse.json({ error: "Valeur invalide." }, { status: 400 });
  }

  // Contrôle d'existence dans les DEUX sens. Le site ne le fait qu'à la
  // clôture : réactiver une saison inexistante y renvoyait « ok », donc un
  // succès affiché pour un non-événement.
  const saison = await prisma.season.findFirst({
    where: { id: saisonId, clubId },
    select: { id: true },
  });
  if (!saison) return NextResponse.json({ error: "Saison introuvable." }, { status: 404 });

  if (corps.active) {
    await prisma.$transaction([
      prisma.season.updateMany({
        where: { clubId, isActive: true },
        data: { isActive: false, endsAt: new Date() },
      }),
      prisma.season.updateMany({
        where: { id: saisonId, clubId },
        data: { isActive: true, endsAt: null },
      }),
    ]);
  } else {
    await prisma.season.updateMany({
      where: { id: saisonId, clubId },
      data: { isActive: false, endsAt: new Date() },
    });
  }

  return NextResponse.json({ ok: true, active: corps.active });
}
