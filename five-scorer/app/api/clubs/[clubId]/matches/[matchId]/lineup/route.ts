import { NextResponse } from "next/server";
import { getClubApiContext } from "@/lib/guard";
import { deplacerJoueurMatch, inscrireJoueurMatch } from "@/lib/matchEvents";
import { idsValides } from "@/lib/ids";

// Les deux gestes vivent dans lib/matchEvents.ts, partagés avec l'écran
// /corriger du site (spec 0001) : cette route ne fait plus que lire la
// requête et traduire le résultat en réponse HTTP — mêmes codes, mêmes
// messages, même JSON que ce qu'attend l'app mobile.

type Ctx = { params: Promise<{ clubId: string; matchId: string }> };

type PatchBody = { playerId: string; team: "A" | "B" };

/// PATCH : fait changer un joueur de camp dans un match en cours.
export async function PATCH(req: Request, { params }: Ctx) {
  const { clubId, matchId } = await params;
  const ctx = await getClubApiContext(clubId);
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!ctx.canScore) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as PatchBody | null;
  // Identifiants venus du client : refuser tout ce qui n'est pas une chaîne,
  // sinon un objet passe pour un filtre Prisma (cf. lib/ids.ts).
  if (!body || !idsValides(body.playerId)) {
    return NextResponse.json({ error: "playerId requis" }, { status: 400 });
  }
  if (body.team !== "A" && body.team !== "B") {
    return NextResponse.json({ error: "Équipe invalide" }, { status: 400 });
  }

  const res = await deplacerJoueurMatch({
    clubId,
    matchId,
    canManage: ctx.canManage,
    userId: ctx.user.id,
    playerId: body.playerId,
    team: body.team,
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  // Joueur absent de la feuille : rien à écrire, et surtout rien à réessayer
  // — un 4xx bloquerait toute la chaîne du match dans la file hors-ligne.
  return NextResponse.json({ ok: true, applique: res.applique });
}

type PostBody = {
  playerId: string;
  team: "A" | "B";
  isGk?: boolean;
  guest?: { id: string; name: string };
};

/// POST : inscrit un joueur arrivé après le coup d'envoi (idempotent).
export async function POST(req: Request, { params }: Ctx) {
  const { clubId, matchId } = await params;
  const ctx = await getClubApiContext(clubId);
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!ctx.canScore) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as PostBody | null;
  if (!body || !idsValides(body.playerId)) {
    return NextResponse.json({ error: "playerId requis" }, { status: 400 });
  }
  if (body.team !== "A" && body.team !== "B") {
    return NextResponse.json({ error: "Équipe invalide" }, { status: 400 });
  }

  const res = await inscrireJoueurMatch({
    clubId,
    matchId,
    canManage: ctx.canManage,
    userId: ctx.user.id,
    playerId: body.playerId,
    team: body.team,
    isGk: body.isGk,
    guest: body.guest,
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ ok: true });
}
