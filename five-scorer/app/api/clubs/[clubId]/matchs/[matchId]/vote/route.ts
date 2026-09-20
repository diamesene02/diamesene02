import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getClubApiContext } from "@/lib/guard";
import { estId } from "@/lib/ids";
import { voterHommeDuMatch } from "@/lib/motm";

export const dynamic = "force-dynamic";

/// Voter pour l'homme du match depuis le téléphone.
///
/// Le vote n'existait que comme action serveur du site (`voteMotm`) : le
/// récap de l'app recevait les candidats et les voix, sans aucun moyen d'en
/// ajouter une. La règle — mode du club, verrou du capitaine, fin du match,
/// feuille, pluralité et départage — vit dans `lib/motm.ts`, appelée par
/// l'action ET par cette route.
///
/// En ligne seulement, jamais par la file d'attente : un vote rejoué trois
/// jours plus tard recompterait un homme du match que tout le club a déjà lu.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ clubId: string; matchId: string }> },
) {
  const { clubId, matchId } = await params;
  const ctx = await getClubApiContext(clubId);
  if (!ctx) return NextResponse.json({ error: "introuvable" }, { status: 404 });

  const corps = (await req.json().catch(() => null)) as { playerId?: unknown } | null;
  const playerId = corps?.playerId;
  // Identifiants venus du client : refuser tout ce qui n'est pas une chaîne,
  // sinon un objet passe pour un filtre Prisma (cf. lib/ids.ts).
  if (!estId(matchId) || !estId(playerId)) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  }

  const r = await voterHommeDuMatch({
    clubId,
    motmMode: ctx.club.motmMode,
    votantId: ctx.user.id,
    matchId,
    playerId,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });

  revalidatePath(`/c/${ctx.org.slug}/matches/${matchId}`);
  return NextResponse.json({ ok: true, hommeDuMatch: r.mvpId });
}
