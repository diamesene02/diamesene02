import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getClubApiContext } from "@/lib/guard";
import { estId } from "@/lib/ids";
import { ecrirePrixTerrain } from "@/lib/terrain";

export const dynamic = "force-dynamic";

/// Le prix du terrain d'une soirée, depuis le téléphone.
///
/// C'est l'admin qui avance la location et court après les parts le mardi :
/// il le fait depuis WhatsApp, donc depuis son téléphone, et le prix n'était
/// écrivable que sur le site (`setFieldCost`). Mêmes droits — les admins —,
/// mêmes bornes, dans `lib/terrain.ts`.
///
/// Corps : `{ prixCents: number | null }`. `null` retire le suivi.
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ clubId: string; matchDayId: string }> },
) {
  const { clubId, matchDayId } = await params;
  const ctx = await getClubApiContext(clubId);
  if (!ctx) return NextResponse.json({ error: "introuvable" }, { status: 404 });
  if (!estId(matchDayId)) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  }
  if (!ctx.canManage) {
    return NextResponse.json({ error: "Réservé aux admins." }, { status: 403 });
  }

  const corps = (await req.json().catch(() => null)) as { prixCents?: unknown } | null;
  if (!corps || !("prixCents" in corps)) {
    return NextResponse.json({ error: "prixCents manquant." }, { status: 400 });
  }
  const prix = corps.prixCents;
  if (prix !== null && typeof prix !== "number") {
    return NextResponse.json({ error: "Montant invalide." }, { status: 400 });
  }

  const r = await ecrirePrixTerrain(clubId, matchDayId, prix);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });

  revalidatePath(`/c/${ctx.org.slug}/sessions/${matchDayId}`);
  return NextResponse.json({ ok: true });
}
