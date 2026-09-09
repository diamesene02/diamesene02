import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClubApiContext } from "@/lib/guard";
import { idsValides } from "@/lib/ids";

export const dynamic = "force-dynamic";

/// Changer le rôle d'un membre.
///
/// Le rôle est validé À L'EXÉCUTION, pas seulement par le type : la même
/// négligence côté server action laissait passer « owner », et un admin s'y
/// serait promu owner — un rôle que rien ne permet ensuite de retirer.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ clubId: string; memberId: string }> },
) {
  const { clubId, memberId } = await params;
  if (!idsValides(memberId)) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  }
  const ctx = await getClubApiContext(clubId);
  if (!ctx) return NextResponse.json({ error: "introuvable" }, { status: 404 });
  if (!ctx.canManage) {
    return NextResponse.json({ error: "Réservé aux admins." }, { status: 403 });
  }

  const corps = (await req.json().catch(() => null)) as { role?: unknown } | null;
  if (corps?.role !== "admin" && corps?.role !== "member") {
    return NextResponse.json({ error: "Rôle inconnu." }, { status: 400 });
  }

  const membre = await prisma.member.findFirst({
    where: { id: memberId, organizationId: clubId },
    select: { id: true, role: true },
  });
  if (!membre) return NextResponse.json({ error: "Membre introuvable." }, { status: 404 });
  if (membre.role === "owner") {
    return NextResponse.json({ error: "Impossible de modifier l'owner." }, { status: 400 });
  }

  await prisma.member.update({ where: { id: memberId }, data: { role: corps.role } });
  return NextResponse.json({ ok: true, role: corps.role });
}

/// Retirer un membre du club.
///
/// Le profil JOUEUR survit, simplement délié du compte : ses matchs, ses buts
/// et ses votes sont à lui, et le classement de la saison ne doit pas se
/// réécrire parce que quelqu'un a quitté le groupe WhatsApp.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ clubId: string; memberId: string }> },
) {
  const { clubId, memberId } = await params;
  if (!idsValides(memberId)) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  }
  const ctx = await getClubApiContext(clubId);
  if (!ctx) return NextResponse.json({ error: "introuvable" }, { status: 404 });
  if (!ctx.canManage) {
    return NextResponse.json({ error: "Réservé aux admins." }, { status: 403 });
  }

  const membre = await prisma.member.findFirst({
    where: { id: memberId, organizationId: clubId },
    select: { id: true, role: true, userId: true },
  });
  if (!membre) return NextResponse.json({ error: "Membre introuvable." }, { status: 404 });
  if (membre.role === "owner") {
    return NextResponse.json({ error: "Impossible de retirer l'owner." }, { status: 400 });
  }
  // Se retirer soi-même par mégarde depuis un téléphone coûterait l'accès au
  // club sans autre recours qu'un nouveau lien d'invitation. Le site ne s'en
  // protège pas ; ici, si.
  if (membre.userId === ctx.user.id) {
    return NextResponse.json(
      { error: "Tu ne peux pas te retirer toi-même." },
      { status: 400 },
    );
  }

  await prisma.$transaction([
    prisma.player.updateMany({
      where: { clubId, userId: membre.userId },
      data: { userId: null },
    }),
    prisma.member.delete({ where: { id: membre.id } }),
  ]);
  return NextResponse.json({ ok: true });
}
