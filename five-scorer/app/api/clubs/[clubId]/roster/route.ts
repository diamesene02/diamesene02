import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClubApiContext } from "@/lib/guard";

/// L'effectif du club — le cache local de l'app, web comme mobile.
///
/// `?archives=1` ajoute les joueurs archivés. Ils restent hors de la réponse
/// par défaut : ce sont ceux qui ne jouent plus, et les faire apparaître dans
/// une composition d'équipe serait le contraire du service rendu. Mais
/// l'écran d'effectif doit pouvoir les montrer pour les réactiver — d'où le
/// paramètre, et d'où `isArchived` désormais dans chaque ligne.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const { clubId } = await params;
  const ctx = await getClubApiContext(clubId);
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const avecArchives = new URL(req.url).searchParams.get("archives") === "1";
  const players = await prisma.player.findMany({
    where: { clubId, ...(avecArchives ? {} : { isArchived: false }) },
    // Les archivés en dernier : la liste garde son ordre habituel, et la
    // partie inactive se lit comme une annexe.
    orderBy: [{ isArchived: "asc" }, { isGuest: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      nickname: true,
      photo: true,
      skill: true,
      isGk: true,
      isGuest: true,
      // « Je viens tous les lundis » : sans lui, l'app mobile ne peut pas
      // calculer les présences par défaut comme le fait `lib/presences.ts`.
      abonne: true,
      isArchived: true,
      userId: true,
    },
  });

  // Le plan (MOBILE.md, étape 9) demandait `userId` brut. L'app n'en a
  // besoin que pour deux questions — « lequel est moi ? » et « ce profil
  // est-il déjà revendiqué ? » — et rendre l'identifiant de compte de chaque
  // joueur à tous les membres du club répondrait à bien plus que ça pour
  // rien. On rend les deux réponses, pas la donnée.
  return NextResponse.json({
    players: players.map(({ userId, ...p }) => ({
      ...p,
      estMoi: userId === ctx.user.id,
      compteLie: userId !== null,
    })),
  });
}
