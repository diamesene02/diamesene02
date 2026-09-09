import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserSession, getUserClubs } from "@/lib/guard";
import { serialiserClub } from "@/lib/clubApi";

export const dynamic = "force-dynamic";

/// « Qui suis-je, et dans quels clubs ? »
///
/// Le premier endpoint authentifié, et celui dont dépend tout le reste de
/// l'app mobile : sans lui, une session valide ne mène nulle part.
///
/// `organization/list` de Better Auth ne suffit pas — il rend les
/// organisations, pas le profil sportif du club (couleurs, format, options)
/// ni le rôle, ni le joueur qu'on est dans ce club. Or l'app en a besoin dès
/// le premier écran, et hors ligne ensuite : c'est l'amorce à écrire en base
/// locale à la première ouverture connectée.
export async function GET() {
  const session = await getUserSession();
  if (!session) {
    return NextResponse.json({ error: "non connecté" }, { status: 401 });
  }

  const clubs = await getUserClubs(session.user.id);

  // Le profil joueur de l'utilisateur dans chacun de ses clubs : c'est lui qui
  // permet de dire « je viens » sans passer par un écran d'administration.
  const moi = await prisma.player.findMany({
    where: {
      userId: session.user.id,
      clubId: { in: clubs.map((c) => c.club.id) },
    },
    select: { id: true, clubId: true, name: true, photo: true },
  });
  const moiParClub = new Map(moi.map((p) => [p.clubId, p]));

  return NextResponse.json({
    utilisateur: {
      id: session.user.id,
      nom: session.user.name,
      email: session.user.email,
    },
    clubs: clubs.map(({ role, org, club }) =>
      serialiserClub(org, club, role, moiParClub.get(club.id) ?? null),
    ),
  });
}
