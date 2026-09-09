import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserSession, getUserClubs } from "@/lib/guard";
import { themeTokens } from "@/lib/theme";
import { nomsChasubles } from "@/lib/color";

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
    clubs: clubs.map(({ role, org, club }) => {
      const canManage = role === "owner" || role === "admin";
      const noms = nomsChasubles(club.colorA, club.colorB);
      const joueur = moiParClub.get(club.id) ?? null;
      return {
        id: club.id,
        slug: org.slug,
        nom: org.name,
        role,
        // Les mêmes droits que ceux calculés par lib/guard.ts pour le web :
        // l'app mobile ne doit pas les recalculer, elle divergerait.
        peutGerer: canManage,
        peutScorer: canManage || club.membersCanScore,
        couleurA: club.colorA,
        couleurB: club.colorB,
        nomChasubleA: noms.a,
        nomChasubleB: noms.b,
        theme: {
          sombre: themeTokens(club.colorA, club.colorB, "dark"),
          clair: themeTokens(club.colorA, club.colorB, "light"),
        },
        // Les réglages dont la feuille de match a besoin au bord du terrain,
        // donc à garder en local : elle doit fonctionner sans réseau.
        reglages: {
          format: club.format,
          dureeMatchMin: club.matchDurationMin,
          pointsVictoire: club.pointsWin,
          pointsNul: club.pointsDraw,
          suitPasses: club.trackAssists,
          suitCartons: club.trackCards,
          modeHommeDuMatch: club.motmMode,
          minJoueurs: club.minJoueurs,
          capaciteSoiree: club.capaciteSoiree,
        },
        monJoueur: joueur
          ? { id: joueur.id, nom: joueur.name, photo: joueur.photo }
          : null,
      };
    }),
  });
}
