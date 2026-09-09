import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClubApiContext } from "@/lib/guard";

export const dynamic = "force-dynamic";

/// Ajouter une soirée au calendrier.
///
/// Ouvert à qui peut scorer, comme sur le site : dans un groupe du lundi soir,
/// celui qui réserve le terrain n'est pas forcément l'admin.
///
/// Route à part (`/soirees/nouvelle`) plutôt qu'un POST sur `/soirees` : cette
/// dernière est la LISTE, lue par l'écran des soirées, et servir les deux sur
/// la même adresse obligerait l'app à distinguer deux réponses.
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

  const corps = (await req.json().catch(() => null)) as {
    date?: unknown;
    titre?: unknown;
    lieu?: unknown;
  } | null;

  const date = typeof corps?.date === "string" ? new Date(corps.date) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: "Date invalide." }, { status: 400 });
  }

  // La soirée rejoint la saison en cours. Quand il n'y en a pas, elle vit sans
  // saison plutôt que d'en ouvrir une en douce — ouvrir une saison clôture la
  // précédente, et ce n'est pas ce qu'on demande en ajoutant un lundi.
  const saison = await prisma.season.findFirst({
    where: { clubId, isActive: true },
    orderBy: { startsAt: "desc" },
    select: { id: true },
  });

  const md = await prisma.matchDay.create({
    data: {
      clubId,
      seasonId: saison?.id ?? null,
      date,
      title:
        typeof corps?.titre === "string" ? corps.titre.trim().slice(0, 80) || null : null,
      location:
        typeof corps?.lieu === "string" ? corps.lieu.trim().slice(0, 120) || null : null,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, soireeId: md.id });
}
