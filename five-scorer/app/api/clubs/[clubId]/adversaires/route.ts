import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getClubApiContext } from "@/lib/guard";

export const dynamic = "force-dynamic";

/// Les adversaires du club — pour la compo « Vs adversaire ».
///
/// `POST /matches` acceptait déjà un match EXTERNAL et son `opponentId`, mais
/// aucune route ne disait QUI on pouvait affronter : l'app ne pouvait
/// qu'écrire des matchs entre nous.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  const { clubId } = await params;
  const ctx = await getClubApiContext(clubId);
  if (!ctx) return NextResponse.json({ error: "introuvable" }, { status: 404 });

  const adversaires = await prisma.opponent.findMany({
    where: { clubId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return NextResponse.json({
    adversaires: adversaires.map((a) => ({ id: a.id, nom: a.name })),
    // Le même droit que la création côté site (`createOpponent`) : qui peut
    // marquer peut ajouter l'équipe d'en face.
    peutCreer: ctx.canScore,
  });
}

/// Ajouter un adversaire. Mêmes règles que l'action serveur du site
/// (`createOpponent`, app/actions/opponents.ts) : `canScore`, nom de deux à
/// soixante caractères, et un nom déjà connu rend l'adversaire existant au
/// lieu d'en créer un second — la contrainte `@@unique([clubId, name])` le
/// garantit en base, l'`upsert` le rend idempotent pour un pouce qui retape.
///
/// Corps : `{ nom: string }`.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  const { clubId } = await params;
  const ctx = await getClubApiContext(clubId);
  if (!ctx) return NextResponse.json({ error: "introuvable" }, { status: 404 });
  if (!ctx.canScore) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const corps = (await req.json().catch(() => null)) as { nom?: unknown } | null;
  if (typeof corps?.nom !== "string") {
    return NextResponse.json({ error: "Nom manquant." }, { status: 400 });
  }
  const nom = corps.nom.trim().slice(0, 60);
  if (nom.length < 2) {
    return NextResponse.json({ error: "Nom trop court." }, { status: 400 });
  }

  const adversaire = await prisma.opponent.upsert({
    where: { clubId_name: { clubId, name: nom } },
    create: { clubId, name: nom },
    update: {},
    select: { id: true, name: true },
  });

  revalidatePath(`/c/${ctx.org.slug}`);
  return NextResponse.json({ ok: true, adversaire: { id: adversaire.id, nom: adversaire.name } });
}
