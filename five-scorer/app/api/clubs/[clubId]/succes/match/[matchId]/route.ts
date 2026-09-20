import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClubApiContext } from "@/lib/guard";
import { estId } from "@/lib/ids";
import { succesDuClub } from "@/lib/succes-serveur";

export const dynamic = "force-dynamic";

/// Les paliers franchis pendant un match, tous joueurs confondus.
///
/// C'est la ligne du récap : « Karim : 10e but, premier coup du chapeau ».
/// Les invités y sont — ils étaient sur le terrain. Un match pas encore
/// terminé n'a rien débloqué : liste vide, pas d'erreur.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ clubId: string; matchId: string }> },
) {
  const { clubId, matchId } = await params;
  // `matchId` part dans un `where` Prisma : `estId` d'abord (lib/ids.ts).
  // Pas le mot « introuvable » seul : l'app le lit comme « ce club n'est plus
  // accessible » (lib/appel.ts). Un match effacé n'est pas un club perdu.
  if (!estId(matchId)) {
    return NextResponse.json({ error: "Match introuvable." }, { status: 404 });
  }
  const ctx = await getClubApiContext(clubId);
  // Celui-ci dit bien « ce club ne t'est pas accessible » : le mot est le bon.
  if (!ctx) return NextResponse.json({ error: "introuvable" }, { status: 404 });

  const [match, succes] = await Promise.all([
    prisma.match.findFirst({ where: { id: matchId, clubId }, select: { id: true } }),
    succesDuClub(clubId),
  ]);
  if (!match) return NextResponse.json({ error: "Match introuvable." }, { status: 404 });

  return NextResponse.json({ deblocages: succes.deblocagesDuMatch(matchId) });
}
