import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClubApiContext } from "@/lib/guard";

export const dynamic = "force-dynamic";

/// Ouvrir une saison.
///
/// EFFET DE BORD À ANNONCER : créer une saison CLÔTURE celle en cours, dans la
/// même transaction. C'est l'invariant du club — une seule saison active, sans
/// quoi le classement compte deux fois — mais le site ne le dit nulle part.
/// L'app, elle, le dit dans le bouton.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  const { clubId } = await params;
  const ctx = await getClubApiContext(clubId);
  if (!ctx) return NextResponse.json({ error: "introuvable" }, { status: 404 });
  if (!ctx.canManage) {
    return NextResponse.json({ error: "Réservé aux admins." }, { status: 403 });
  }

  const corps = (await req.json().catch(() => null)) as { nom?: unknown } | null;
  const nom = typeof corps?.nom === "string" ? corps.nom.trim().slice(0, 60) : "";
  if (nom.length < 2) {
    return NextResponse.json({ error: "Nom trop court." }, { status: 400 });
  }

  const saison = await prisma.$transaction(async (tx) => {
    await tx.season.updateMany({
      where: { clubId, isActive: true },
      data: { isActive: false, endsAt: new Date() },
    });
    return tx.season.create({ data: { clubId, name: nom }, select: { id: true } });
  });

  return NextResponse.json({ ok: true, saisonId: saison.id });
}
