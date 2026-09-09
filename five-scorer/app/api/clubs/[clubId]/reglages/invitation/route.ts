import { NextResponse } from "next/server";
import { createId } from "@paralleldrive/cuid2";
import { prisma } from "@/lib/prisma";
import { getClubApiContext } from "@/lib/guard";

export const dynamic = "force-dynamic";

/// Régénérer le code d'invitation.
///
/// IRRÉVERSIBLE : l'ancien code est écrasé, il n'est nulle part, et TOUS les
/// liens déjà partagés (WhatsApp, la plupart du temps) meurent d'un coup.
/// L'app doit donc le demander deux fois — ici on ne fait que l'écrire.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  const { clubId } = await params;
  const ctx = await getClubApiContext(clubId);
  if (!ctx) return NextResponse.json({ error: "introuvable" }, { status: 404 });
  if (!ctx.canManage) {
    return NextResponse.json({ error: "Réservé aux admins." }, { status: 403 });
  }

  const code = createId().slice(0, 12);
  await prisma.club.update({ where: { id: clubId }, data: { inviteCode: code } });
  return NextResponse.json({
    ok: true,
    code,
    affiche: code.slice(-8).toUpperCase(),
    lien: `/join/${code}`,
  });
}
