import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClubApiContext } from "@/lib/guard";
import { idsValides } from "@/lib/ids";
import { entreeDepuisCorps, nettoyerJoueur } from "@/lib/joueur";
import { ini } from "@/lib/ini";

export const dynamic = "force-dynamic";

/// Ajouter un joueur au vestiaire.
///
/// Le jumeau HTTP de `addPlayer` (`app/actions/roster.ts`), à la règle près
/// qui suit — la seule qui change, et elle change dans le bon sens.
///
/// **L'identifiant peut venir du client**, comme pour un match : `lib/ids.ts`
/// produit un cuid2 sur le téléphone, on l'écrit tel quel, et un second envoi
/// du même identifiant ne crée rien de plus. C'est ce qui rend le bouton
/// « Enregistrer » sûr sur un réseau de gymnase, où la réponse se perd plus
/// souvent que la requête. Sans lui, un pouce impatient inscrit deux Sofiane
/// dans l'effectif, et il faut ensuite en archiver un — en ayant perdu les
/// buts partis sur l'autre.
///
/// Le rejeu ne réécrit PAS la fiche : si l'identifiant existe déjà, la
/// création est un constat, pas une modification. Modifier, c'est le PATCH.
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

  const corps = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const data = nettoyerJoueur(entreeDepuisCorps(corps));
  if (!data.name) {
    return NextResponse.json({ error: "Nom requis." }, { status: 400 });
  }

  // Même règle qu'au PATCH : une photo refusée ressort à `null` sans bruit, et
  // le silence ferait chercher la panne du côté du réseau.
  const photoRefusee = typeof corps?.photo === "string" && data.photo == null;

  // Un identifiant fourni doit être une chaîne : un objet passerait pour un
  // filtre Prisma (cf. lib/ids.ts). Absent, la base en génère un.
  const id = corps?.id;
  if (id !== undefined && !idsValides(id)) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  }

  if (typeof id === "string") {
    const deja = await prisma.player.findUnique({
      where: { id },
      select: { id: true, clubId: true },
    });
    // Même identifiant dans un AUTRE club : on refuse plutôt que de renvoyer
    // « c'est bon ». L'app croirait le joueur inscrit ici, et le vestiaire ne
    // le montrerait jamais.
    if (deja && deja.clubId !== clubId) {
      return NextResponse.json({ error: "Identifiant déjà pris." }, { status: 409 });
    }
    if (deja) {
      return NextResponse.json({ ok: true, joueurId: deja.id, rejeu: true });
    }
  }

  const joueur = await prisma.player.create({
    data: {
      ...(typeof id === "string" ? { id } : {}),
      clubId,
      ...data,
      name: data.name,
    },
    select: { id: true, name: true },
  });

  // Les initiales repartent avec la réponse : l'écran vient d'écrire une
  // vignette sans photo, et `lib/ini.ts` est la seule règle qui dit ce qu'on y
  // peint (cf. l'endpoint de l'effectif).
  return NextResponse.json({
    ok: true,
    joueurId: joueur.id,
    initiales: ini(joueur.name),
    ...(photoRefusee
      ? { avertissement: "La photo n'a pas pu être enregistrée : format ou taille refusés." }
      : null),
  });
}
