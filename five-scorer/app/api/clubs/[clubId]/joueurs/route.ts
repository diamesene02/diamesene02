import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClubApiContext } from "@/lib/guard";
import { sanitize, type PlayerInput } from "@/lib/roster-serveur";

export const dynamic = "force-dynamic";

/// Ajouter un joueur au vestiaire.
///
/// Réservé à qui gère, comme sur le site. Le geste courant au bord du terrain
/// — « un pote est venu, il joue ce soir » — passe par l'INVITÉ de la compo,
/// qui ne demande qu'un prénom et ne salit pas le vestiaire. Ici, c'est le
/// joueur qui revient : il a une fiche, une photo, un niveau, et il comptera
/// au classement.
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

  const corps = (await req.json().catch(() => null)) as PlayerInput | null;
  if (!corps || typeof corps !== "object" || Array.isArray(corps)) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const data = sanitize(corps);
  if (!data.name) return NextResponse.json({ error: "Nom requis." }, { status: 400 });

  // Une photo trop lourde ou d'un format inattendu est SILENCIEUSEMENT réduite
  // à `null` par `sanitize`. On le dit, plutôt que d'annoncer « enregistré »
  // sur une fiche qui reviendra sans visage.
  const photoRefusee = corps.photo != null && data.photo == null;

  const joueur = await prisma.player.create({
    data: { clubId, ...data, name: data.name },
    select: { id: true },
  });

  return NextResponse.json({
    ok: true,
    joueurId: joueur.id,
    ...(photoRefusee
      ? { avertissement: "La photo n'a pas pu être enregistrée : format ou taille refusés." }
      : null),
  });
}
