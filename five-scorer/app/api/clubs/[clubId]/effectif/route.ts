import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClubApiContext } from "@/lib/guard";
import { getLeaderboard } from "@/lib/stats";
import { ini } from "@/lib/ini";

export const dynamic = "force-dynamic";

/// Le vestiaire du club, en un aller-retour.
///
/// Aucun paramètre : les archivés sont dans la réponse, et l'app les sépare en
/// local. Ils sont peu nombreux, et l'écran doit pouvoir les montrer pour les
/// réactiver sans redemander au serveur.
///
/// Les chiffres viennent de `getLeaderboard` sans saison — toutes saisons
/// confondues, comme la page du site : le vestiaire raconte une carrière, pas
/// un exercice.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  const { clubId } = await params;
  const ctx = await getClubApiContext(clubId);
  if (!ctx) return NextResponse.json({ error: "introuvable" }, { status: 404 });

  const [joueurs, classement] = await Promise.all([
    prisma.player.findMany({
      where: { clubId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        nickname: true,
        photo: true,
        skill: true,
        isGk: true,
        isGuest: true,
        isArchived: true,
        abonne: true,
        userId: true,
      },
    }),
    getLeaderboard({ clubId }),
  ]);

  const chiffres = new Map(classement.map((r) => [r.playerId, r]));
  const actifs = joueurs.filter((j) => !j.isArchived).length;
  const monJoueur = joueurs.find((j) => j.userId === ctx.user.id) ?? null;

  return NextResponse.json({
    peutGerer: ctx.canManage,
    aDejaUnProfil: monJoueur != null,
    monJoueurId: monJoueur?.id ?? null,
    actifs,
    sousTitre: `${actifs} joueur${actifs > 1 ? "s" : ""} au vestiaire`,
    joueurs: joueurs.map((j) => {
      const c = chiffres.get(j.id);
      return {
        id: j.id,
        nom: j.name,
        surnom: j.nickname,
        // Les initiales viennent d'ici : le composant Avatar du mobile
        // n'applique pas la même règle que `lib/ini.ts`, et « Sofiane » doit
        // donner « SO » des deux côtés.
        initiales: ini(j.name),
        photo: j.photo,
        niveau: j.skill,
        gardien: j.isGk,
        invite: j.isGuest,
        archive: j.isArchived,
        abonne: j.abonne,
        compteLie: j.userId !== null,
        estMoi: j.id === monJoueur?.id,
        matchs: c?.matchesPlayed ?? 0,
        buts: c?.goals ?? 0,
      };
    }),
  });
}
