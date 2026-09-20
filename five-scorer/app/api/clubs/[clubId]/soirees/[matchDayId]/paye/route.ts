import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getClubApiContext } from "@/lib/guard";
import { estId } from "@/lib/ids";
import { marquerPaye } from "@/lib/terrain";

export const dynamic = "force-dynamic";

/// « A payé sa part » — cocher ou décocher un joueur dans la caisse du
/// terrain, depuis le téléphone.
///
/// Mêmes droits que le site (`setRsvpPaid`) : les admins. Et une seule règle,
/// dans `lib/terrain.ts`, pour les deux — la case vit sur la réponse du joueur
/// à la soirée, avec deux écarts voulus qui y sont expliqués : un ABONNÉ qui
/// n'a rien répondu peut payer (on lui écrit sa présence, datée de la création
/// de la soirée, parce qu'il est déjà compté présent), et cocher ne repousse
/// pas `respondedAt`, donc ne fait reculer personne dans la file. Le refus dit
/// (409) ne vaut que pour un joueur ni répondant ni abonné.
///
/// Corps : `{ playerId: string, paye: boolean }`.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ clubId: string; matchDayId: string }> },
) {
  const { clubId, matchDayId } = await params;
  const ctx = await getClubApiContext(clubId);
  if (!ctx) return NextResponse.json({ error: "introuvable" }, { status: 404 });

  const corps = (await req.json().catch(() => null)) as {
    playerId?: unknown;
    paye?: unknown;
  } | null;
  const playerId = corps?.playerId;
  // Identifiants venus du client : refuser tout ce qui n'est pas une chaîne,
  // sinon un objet passe pour un filtre Prisma (cf. lib/ids.ts).
  if (!estId(matchDayId) || !estId(playerId)) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  }
  if (typeof corps?.paye !== "boolean") {
    return NextResponse.json({ error: "« paye » doit être vrai ou faux." }, { status: 400 });
  }
  if (!ctx.canManage) {
    return NextResponse.json({ error: "Réservé aux admins." }, { status: 403 });
  }

  const r = await marquerPaye(clubId, matchDayId, playerId, corps.paye);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });

  revalidatePath(`/c/${ctx.org.slug}/sessions/${matchDayId}`);
  return NextResponse.json({ ok: true, paye: corps.paye });
}
