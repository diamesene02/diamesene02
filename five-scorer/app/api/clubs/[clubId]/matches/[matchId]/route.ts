import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClubApiContext } from "@/lib/guard";
import { estId } from "@/lib/ids";

type Ctx = { params: Promise<{ clubId: string; matchId: string }> };

/// La feuille complète d'un match — c'est la REPRISE.
///
/// L'outbox ne suffit pas, et c'est le point qu'on oublie : elle contient ce
/// que CE téléphone a saisi, pas ce que le match est. Trois soirées sur quatre
/// s'en passent ; la quatrième, c'est le téléphone à plat à la mi-temps, ou la
/// deuxième personne qui prend la saisie, ou l'app réinstallée. Il faut alors
/// pouvoir redescendre la feuille entière et repartir de là.
///
/// Les noms de champs sont ceux de `LocalMatch`, `LocalParticipant` et
/// `LocalEvent` côté app (five-scorer-mobile, `lib/outbox/types.ts`) : chaque
/// bloc se recopie tel quel dans sa table SQLite.
export async function GET(_req: Request, { params }: Ctx) {
  const { clubId, matchId } = await params;
  // `matchId` part directement dans un `where` Prisma : il passe par `estId`
  // avant, comme tout identifiant venu du client (lib/ids.ts).
  if (!estId(matchId)) {
    return NextResponse.json({ error: "introuvable" }, { status: 404 });
  }
  const ctx = await getClubApiContext(clubId);
  if (!ctx) return NextResponse.json({ error: "introuvable" }, { status: 404 });

  const match = await prisma.match.findFirst({
    where: { id: matchId, clubId },
    include: {
      opponent: { select: { name: true } },
      participants: {
        select: { playerId: true, team: true, initialTeam: true, isGk: true },
      },
      // L'ordre est celui de la saisie, pas celui de la minute : c'est lui qui
      // fait la chronologie, et c'est lui que `lib/sync.ts` rejoue. Une minute
      // peut être nulle (feuille rétro) ou corrigée à la main.
      events: { orderBy: { createdAt: "asc" } },
      motmVotes: { select: { playerId: true, voterId: true } },
      rsvps: { select: { playerId: true, status: true, hasPaid: true } },
    },
  });
  if (!match) {
    return NextResponse.json({ error: "introuvable" }, { status: 404 });
  }

  // Les votes se rendent COMPTÉS, jamais nominatifs. La page web les compte
  // déjà pour l'affichage ; rendre la liste des votants ajouterait « qui a
  // voté pour qui » à un club de quinze personnes qui se voient tous les
  // lundis. On rend les deux seules réponses dont un écran a besoin : le
  // total par joueur, et mon propre vote.
  const parJoueur = new Map<string, number>();
  for (const v of match.motmVotes) {
    parJoueur.set(v.playerId, (parJoueur.get(v.playerId) ?? 0) + 1);
  }

  return NextResponse.json({
    match: {
      id: match.id,
      clubId,
      status: match.status,
      kind: match.kind,
      isHome: match.isHome,
      playedAt: match.playedAt.toISOString(),
      scheduledAt: match.scheduledAt?.toISOString() ?? null,
      matchDayId: match.matchDayId,
      seasonId: match.seasonId,
      opponentId: match.opponentId,
      opponentName: match.opponent?.name ?? null,
      teamAName: match.teamAName,
      teamBName: match.teamBName,
      scoreA: match.scoreA,
      scoreB: match.scoreB,
      durationMin: match.durationMin,
      mvpId: match.mvpId,
      notes: match.notes,
    },
    participants: match.participants.map((p) => ({
      // La clé composée de la table locale, calculée ici pour que l'app n'ait
      // pas à connaître deux fois la règle (`pKey` de lib/match/tables.ts).
      key: `${match.id}::${p.playerId}`,
      matchId: match.id,
      playerId: p.playerId,
      team: p.team,
      initialTeam: p.initialTeam,
      isGk: p.isGk,
    })),
    events: match.events.map((e) => ({
      id: e.id,
      matchId: match.id,
      type: e.type,
      team: e.team,
      playerId: e.playerId,
      assistPlayerId: e.assistPlayerId,
      minute: e.minute,
      createdAt: e.createdAt.toISOString(),
    })),
    rsvps: match.rsvps.map((r) => ({
      playerId: r.playerId,
      status: r.status,
      hasPaid: r.hasPaid,
    })),
    votes: {
      total: match.motmVotes.length,
      byPlayer: [...parJoueur].map(([playerId, count]) => ({ playerId, count })),
      mine:
        match.motmVotes.find((v) => v.voterId === ctx.user.id)?.playerId ?? null,
    },
  });
}

type PatchBody = {
  status?: "FINISHED";
  mvpId?: string | null;
  durationMin?: number | null;
  teamAName?: string;
  teamBName?: string;
  notes?: string | null;
};

export async function PATCH(req: Request, { params }: Ctx) {
  const { clubId, matchId } = await params;
  const ctx = await getClubApiContext(clubId);
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!ctx.canScore) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const match = await prisma.match.findFirst({
    where: { id: matchId, clubId },
  });
  if (!match) {
    return NextResponse.json({ error: "Match introuvable" }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as PatchBody | null;
  if (!body) {
    return NextResponse.json({ error: "Payload invalide" }, { status: 400 });
  }

  // Terminer un match LIVE : ouvert à qui peut scorer (idempotent).
  // Toute retouche d'un match déjà FINISHED : admin.
  const isFinishing = body.status === "FINISHED" && match.status === "LIVE";
  const isIdempotentFinish =
    body.status === "FINISHED" && match.status === "FINISHED";
  if (!isFinishing && !isIdempotentFinish && !ctx.canManage) {
    return NextResponse.json(
      { error: "Admin requis pour modifier un match terminé" },
      { status: 403 },
    );
  }

  if (body.mvpId) {
    const mvpOk = await prisma.player.count({
      where: { id: body.mvpId, clubId },
    });
    if (!mvpOk) {
      return NextResponse.json({ error: "MVP hors du club" }, { status: 400 });
    }
  }

  // « Terminer un match déjà terminé » est toléré pour que la file d'attente
  // hors-ligne puisse rejouer sans erreur — mais ce rejeu doit être INERTE.
  // Il ne l'était pas : mvpId et durationMin s'écrivaient sans condition de
  // rôle, si bien qu'un simple membre réécrivait l'homme du match et la durée
  // d'une rencontre close. Et le cas n'était pas théorique : c'est exactement
  // ce que produisait le scénario des deux téléphones, le finishMatch en file
  // arrivant après le createMatch refusé.
  // Le rejeu inerte est une propriété du REJEU, pas du rôle de l'émetteur.
  //
  // La condition portait aussi sur `!ctx.canManage` : pour un admin, un
  // finishMatch resté en file hors ligne réécrivait donc mvpId et durationMin
  // d'un match déjà terminé. Or ce corps n'est pas composé par un humain —
  // lib/sync.ts envoie toujours le mvpId qu'il avait au moment du tap, c'est-à-
  // dire null en mode vote. Un admin qui retrouve du réseau le lendemain
  // effaçait ainsi le MVP élu par le club. La retouche délibérée passe par
  // l'écran d'édition, qui vérifie déjà les droits.
  const rejeuInerte = isIdempotentFinish;

  const updated = await prisma.match.update({
    where: { id: matchId },
    data: {
      ...(body.status === "FINISHED" ? { status: "FINISHED" } : {}),
      ...(body.mvpId !== undefined && !rejeuInerte
        ? { mvpId: body.mvpId }
        : {}),
      ...(body.durationMin !== undefined && !rejeuInerte
        ? { durationMin: body.durationMin }
        : {}),
      ...(ctx.canManage && body.teamAName?.trim()
        ? { teamAName: body.teamAName.trim() }
        : {}),
      ...(ctx.canManage && body.teamBName?.trim()
        ? { teamBName: body.teamBName.trim() }
        : {}),
      ...(ctx.canManage && body.notes !== undefined
        ? { notes: body.notes }
        : {}),
    },
  });
  return NextResponse.json({ match: updated });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { clubId, matchId } = await params;
  const ctx = await getClubApiContext(clubId);
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!ctx.canManage) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  await prisma.match
    .delete({ where: { id: matchId, clubId } })
    .catch(() => null);
  return NextResponse.json({ ok: true });
}
