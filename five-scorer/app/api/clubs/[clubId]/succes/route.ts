import { NextResponse } from "next/server";
import { getClubApiContext } from "@/lib/guard";
import { estId } from "@/lib/ids";
import { succesDuClub } from "@/lib/succes-serveur";

export const dynamic = "force-dynamic";

/// Les succès d'un joueur : niveau, séries, badges, déblocages, rang.
///
/// Sans paramètre, ceux du joueur lié au compte — `{ joueur: null }` quand
/// le compte n'a pas de profil dans ce club, ce qui n'est pas une erreur :
/// un dirigeant qui ne joue pas ouvre l'accueil comme les autres.
/// `?joueur=<playerId>` : ceux d'un joueur du club, comme sa fiche.
///
/// Le calcul est celui des pages du site (`succesDuClub`) : la fiche web et
/// l'app ne peuvent pas annoncer deux niveaux différents.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  const { clubId } = await params;
  const ctx = await getClubApiContext(clubId);
  // 404 plutôt que 403 : répondre « interdit » confirmerait l'existence du
  // club à qui devine un identifiant.
  if (!ctx) return NextResponse.json({ error: "introuvable" }, { status: 404 });

  const demande = new URL(req.url).searchParams.get("joueur");
  // Pas le mot « introuvable » seul : l'app le lit comme « ce club n'est plus
  // accessible » (lib/appel.ts). Un joueur retiré du club n'est pas un club
  // perdu — et le propriétaire du club se verrait dire de se faire réinviter.
  if (demande !== null && !estId(demande)) {
    return NextResponse.json({ error: "Joueur introuvable." }, { status: 404 });
  }

  const succes = await succesDuClub(clubId);
  const playerId = demande ?? succes.joueurDuCompte(ctx.user.id);
  if (!playerId) return NextResponse.json({ joueur: null });

  // `parJoueur` ne contient que les joueurs de CE club : un identifiant
  // d'ailleurs tombe ici, sans requête de plus.
  const s = succes.parJoueur.get(playerId);
  if (!s) return NextResponse.json({ error: "Joueur introuvable." }, { status: 404 });
  return NextResponse.json(s);
}
