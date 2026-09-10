import { NextResponse } from "next/server";
import { getUserSession } from "@/lib/guard";
import { rejoindreParCode, STATUT_REJOINDRE } from "@/lib/rejoindre";

export const dynamic = "force-dynamic";

/// « On m'a filé un code. »
///
/// Le jumeau HTTP de `joinClubByCode`. Sans lui, quelqu'un qui installe l'app
/// et se crée un compte arrive sur une liste de clubs VIDE, sans aucun geste
/// pour en sortir : il fallait ressortir le site sur un ordinateur pour entrer
/// dans son propre club. C'est le seul endroit de l'app où le mur était total
/// — tous les autres écrans manquants avaient au moins un contournement.
///
/// Hors de `/api/clubs/[clubId]/` exprès : on n'est pas encore membre, donc
/// `getClubApiContext` n'a rien à contextualiser. La seule garde possible est
/// la session, et le code d'invitation est ce qui tient lieu d'autorisation —
/// c'est déjà le contrat du site (`/join/[code]`).
///
/// Le refus est un 404 sur un code inconnu, jamais un 403 : répondre « interdit »
/// confirmerait qu'un club porte ce code à quelqu'un qui en essaie.
export async function POST(req: Request) {
  const session = await getUserSession();
  if (!session) {
    return NextResponse.json({ error: "non connecté" }, { status: 401 });
  }

  const corps = (await req.json().catch(() => null)) as { code?: unknown } | null;

  const res = await rejoindreParCode({
    code: corps?.code,
    user: { id: session.user.id, name: session.user.name },
  });
  if (!res.ok) {
    return NextResponse.json(
      { error: res.error, motif: res.motif },
      { status: STATUT_REJOINDRE[res.motif] },
    );
  }

  // `dejaMembre` est rendu pour que l'app puisse le DIRE (« tu es déjà de ce
  // club ») au lieu d'afficher une fausse bienvenue. Ce n'est pas une erreur :
  // rouvrir un vieux lien est le geste normal.
  return NextResponse.json({
    ok: true,
    clubId: res.clubId,
    slug: res.slug,
    nom: res.nom,
    dejaMembre: res.dejaMembre,
  });
}
