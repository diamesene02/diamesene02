import { NextResponse } from "next/server";
import { getClubApiContext } from "@/lib/guard";
import { poserCalendrier } from "@/lib/calendrier-serveur";

export const dynamic = "force-dynamic";

/// Poser toute la saison d'un coup.
///
/// Un club qui joue tous les lundis de septembre à juillet a quarante-quatre
/// soirées à créer. Personne ne les crée une par une — d'où la feuille de match
/// absente au coup d'envoi. Les dates sont calculées sur le TÉLÉPHONE, dans le
/// fuseau de la personne qui prépare : c'est elle qui joue.
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

  const corps = (await req.json().catch(() => null)) as {
    nomSaison?: unknown;
    dates?: unknown;
    titre?: unknown;
    lieu?: unknown;
    seasonId?: unknown;
  } | null;

  if (typeof corps?.nomSaison !== "string" || !Array.isArray(corps.dates)) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  if (!corps.dates.every((d) => typeof d === "string")) {
    return NextResponse.json({ error: "Dates invalides." }, { status: 400 });
  }

  const res = await poserCalendrier(clubId, {
    nomSaison: corps.nomSaison,
    dates: corps.dates as string[],
    titre: typeof corps.titre === "string" ? corps.titre : undefined,
    lieu: typeof corps.lieu === "string" ? corps.lieu : undefined,
    seasonId: typeof corps.seasonId === "string" ? corps.seasonId : null,
  });
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
