import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getClubApiContext } from "@/lib/guard";
import { estId } from "@/lib/ids";
import { reprendreCompo } from "@/lib/compo";

export const dynamic = "force-dynamic";

/// « Compo précédente » depuis le téléphone : reprendre les équipes de la
/// dernière soirée préparée comme point de départ.
///
/// Le club fait sa compo le jeudi, sur WhatsApp — donc sur le téléphone —, et
/// ce geste n'existait que comme action serveur du site
/// (`reprendreCompoPrecedente`). Même droit (`canScore` : qui peut marquer
/// peut composer, comme le PUT voisin), même règle, dans `lib/compo.ts`.
///
/// Rien à envoyer dans le corps. La réponse dit combien de joueurs ont été
/// repris ; l'app relit la soirée pour les placer.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ clubId: string; matchDayId: string }> },
) {
  const { clubId, matchDayId } = await params;
  const ctx = await getClubApiContext(clubId);
  if (!ctx) return NextResponse.json({ error: "introuvable" }, { status: 404 });
  if (!estId(matchDayId)) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  }
  if (!ctx.canScore) {
    return NextResponse.json({ error: "Droits insuffisants." }, { status: 403 });
  }

  const r = await reprendreCompo(clubId, matchDayId);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });

  revalidatePath(`/c/${ctx.org.slug}`, "layout");
  return NextResponse.json({ ok: true, reprises: r.reprises });
}
