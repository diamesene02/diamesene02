import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClubApiContext } from "@/lib/guard";
import type { MatchKind, MatchStatus } from "@prisma/client";

type Ctx = { params: Promise<{ clubId: string }> };

const STATUTS: MatchStatus[] = ["SCHEDULED", "LIVE", "FINISHED", "CANCELED"];

/// La liste des matchs du club.
///
/// Elle existe d'abord pour UNE question, celle que l'app pose au démarrage :
/// « y a-t-il déjà un match ouvert ? ». Deux téléphones qui ouvrent chacun leur
/// feuille sur la même soirée produisent deux scores, et rien ne les réconcilie
/// après coup — l'outbox est idempotente par identifiant, pas par soirée.
/// `?status=LIVE,SCHEDULED` répond en un aller-retour, avant le coup d'envoi.
///
/// Sans filtre, on rend les matchs les plus récents : c'est la liste de
/// l'écran « Matchs ».
///
/// Les noms de champs sont ceux de `LocalMatch` côté app (five-scorer-mobile,
/// `lib/outbox/types.ts`) : la réponse se recopie telle quelle dans la table
/// SQLite locale, sans couche de traduction qui divergerait un jour.
export async function GET(req: Request, { params }: Ctx) {
  const { clubId } = await params;
  const ctx = await getClubApiContext(clubId);
  // 404 et non 403 — comme `GET /api/clubs/[clubId]` : répondre « interdit »
  // confirmerait l'existence du club à qui devine un identifiant.
  if (!ctx) return NextResponse.json({ error: "introuvable" }, { status: 404 });

  const q = new URL(req.url).searchParams;

  // Un statut inconnu est refusé ICI, et nommé. Sans ce garde, `?status=LVE`
  // (faute de frappe) descend jusqu'à Prisma, qui refuse la valeur d'énumération
  // et fait remonter un 500 — vérifié en retirant la condition. Un 500 ne dit
  // rien à l'app : elle le compte comme une panne serveur, le réessaie en
  // boucle avec sa relance exponentielle, et personne ne voit jamais la faute
  // de frappe. Un 400 qui nomme le statut, si.
  const demandes = (q.get("status") ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const inconnu = demandes.find((s) => !STATUTS.includes(s as MatchStatus));
  if (inconnu) {
    return NextResponse.json(
      { error: `Statut inconnu : ${inconnu}` },
      { status: 400 },
    );
  }

  const limiteDemandee = Number(q.get("limite"));
  const limite =
    Number.isInteger(limiteDemandee) && limiteDemandee > 0
      ? Math.min(limiteDemandee, 100)
      : 20;

  const matches = await prisma.match.findMany({
    where: {
      clubId,
      ...(demandes.length
        ? { status: { in: demandes as MatchStatus[] } }
        : {}),
    },
    orderBy: { playedAt: "desc" },
    take: limite,
    select: {
      id: true,
      status: true,
      kind: true,
      playedAt: true,
      matchDayId: true,
      seasonId: true,
      opponentId: true,
      opponent: { select: { name: true } },
      teamAName: true,
      teamBName: true,
      scoreA: true,
      scoreB: true,
      durationMin: true,
      mvpId: true,
    },
  });

  return NextResponse.json({
    matches: matches.map((m) => ({
      id: m.id,
      clubId,
      status: m.status,
      kind: m.kind,
      playedAt: m.playedAt.toISOString(),
      matchDayId: m.matchDayId,
      seasonId: m.seasonId,
      opponentId: m.opponentId,
      // Le nom voyage avec le match : un match contre une équipe externe
      // s'affiche dans la liste sans second aller-retour vers les adversaires.
      opponentName: m.opponent?.name ?? null,
      teamAName: m.teamAName,
      teamBName: m.teamBName,
      scoreA: m.scoreA,
      scoreB: m.scoreB,
      durationMin: m.durationMin,
      mvpId: m.mvpId,
    })),
  });
}

type TeamEntry = { playerId: string; isGk?: boolean };

type CreateBody = {
  id?: string;
  playedAt?: string; // ISO
  matchDayId?: string | null;
  seasonId?: string | null;
  matchKind?: MatchKind;
  opponentId?: string | null;
  teamAName?: string;
  teamBName?: string;
  teamA: TeamEntry[];
  teamB: TeamEntry[];
  guests?: { id: string; name: string }[];
};

export async function POST(req: Request, { params }: Ctx) {
  const { clubId } = await params;
  const ctx = await getClubApiContext(clubId);
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!ctx.canScore) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as CreateBody | null;
  if (!body || !Array.isArray(body.teamA) || !Array.isArray(body.teamB)) {
    return NextResponse.json({ error: "Payload invalide" }, { status: 400 });
  }
  const all = [...body.teamA, ...body.teamB].map((t) => t.playerId);
  if (all.length === 0) {
    return NextResponse.json({ error: "Aucun joueur" }, { status: 400 });
  }
  if (new Set(all).size !== all.length) {
    return NextResponse.json(
      { error: "Un joueur ne peut pas être dans les deux équipes" },
      { status: 400 },
    );
  }

  const teamAName = body.teamAName?.trim() || "Équipe A";
  const teamBName = body.teamBName?.trim() || "Équipe B";
  const playedAt = body.playedAt ? new Date(body.playedAt) : undefined;
  const kind: MatchKind =
    body.matchKind === "EXTERNAL" ? "EXTERNAL" : "INTERNAL";

  // Saison : celle demandée SI elle appartient à ce club, sinon la saison
  // active. matchDayId et opponentId étaient déjà revérifiés ainsi ; seasonId
  // ne l'était pas, et un match rattaché à la saison d'un autre club
  // disparaissait de toutes les vues saisonnières du sien — corruption
  // silencieuse, sans erreur ni trace.
  const seasonDemandee = body.seasonId
    ? ((
        await prisma.season.findFirst({
          where: { id: body.seasonId, clubId },
          select: { id: true },
        })
      )?.id ?? null)
    : null;
  const seasonId =
    seasonDemandee ??
    (
      await prisma.season.findFirst({
        where: { clubId, isActive: true },
        orderBy: { startsAt: "desc" },
        select: { id: true },
      })
    )?.id ??
    null;

  const match = await prisma
    .$transaction(async (tx) => {
      // Invités créés hors-ligne : upsert avant les compos.
      for (const g of body.guests ?? []) {
        await tx.player.upsert({
          where: { id: g.id },
          create: {
            id: g.id,
            clubId,
            name: g.name.trim().slice(0, 60) || "Invité",
            isGuest: true,
          },
          update: {},
        });
      }

      // Tous les joueurs référencés doivent appartenir au club.
      const owned = await tx.player.count({
        where: { id: { in: all }, clubId },
      });
      if (owned !== all.length) {
        throw new Error("player_scope");
      }

      // Ancrages optionnels : ignorés s'ils n'appartiennent pas au club.
      const matchDayId = body.matchDayId
        ? ((
            await tx.matchDay.findFirst({
              where: { id: body.matchDayId, clubId },
              select: { id: true },
            })
          )?.id ?? null)
        : null;
      const opponentId =
        kind === "EXTERNAL" && body.opponentId
          ? ((
              await tx.opponent.findFirst({
                where: { id: body.opponentId, clubId },
                select: { id: true },
              })
            )?.id ?? null)
          : null;

      const data = {
        clubId,
        kind,
        opponentId,
        matchDayId,
        seasonId,
        teamAName,
        teamBName,
        ...(playedAt ? { playedAt } : {}),
      };

      // Upsert idempotent — rejouable depuis l'outbox offline.
      const upserted = body.id
        ? await tx.match.upsert({
            where: { id: body.id },
            create: { id: body.id, ...data },
            update: { teamAName, teamBName },
          })
        : await tx.match.create({ data });

      if (upserted.clubId !== clubId) throw new Error("match_scope");

      // Lancement d'un match programmé : SCHEDULED → LIVE (conditionnel pour
      // qu'un replay tardif de l'outbox ne rouvre jamais un match terminé).
      await tx.match.updateMany({
        where: { id: upserted.id, status: "SCHEDULED" },
        data: { status: "LIVE", playedAt: playedAt ?? new Date() },
      });

      // Un match terminé garde sa composition. Sans ce garde, deux téléphones sur
      // le même match programmé suffisaient : celui resté hors ligne rejouait sa
      // propre compo le lendemain et écrasait celle du match déjà joué. Tout en
      // dépend — apparitions, victoires, pourcentages, Élo. Le statut, lui, était
      // déjà protégé ; les compos ne l'étaient pas.
      if (upserted.status === "FINISHED" && !ctx.canManage) {
        throw new Error("finished_scope");
      }

      // La composition n'est écrite QUE si le match n'en a pas encore.
      //
      // C'était un deleteMany suivi d'un createMany, sans condition. Deux
      // téléphones sur le même match programmé suffisaient : chacun enfile son
      // propre createMatch avec le MÊME identifiant. Le premier passe, le match
      // devient LIVE, on corrige la composition en direct — puis le second
      // téléphone retrouve du réseau et son createMatch rejoue : la correction
      // est effacée, et rien ne la remet. Le garde qui existait ne couvrait que
      // les matchs déjà terminés.
      //
      // Un match SCHEDULED garde l'ancien comportement : sa composition
      // prévisionnelle est justement là pour être remplacée au coup d'envoi.
      const compoExistante = await tx.matchParticipant.count({
        where: { matchId: upserted.id },
      });
      const peutReecrire = compoExistante === 0 || upserted.status === "SCHEDULED";
      if (!peutReecrire) return upserted;

      await tx.matchParticipant.deleteMany({ where: { matchId: upserted.id } });
      await tx.matchParticipant.createMany({
        data: [
          // `initialTeam` est écrite ici et nulle part ailleurs : c'est la
          // seule écriture de la composition, donc le coup d'envoi.
          ...body.teamA.map((t) => ({
            matchId: upserted.id,
            playerId: t.playerId,
            team: "A" as const,
            initialTeam: "A" as const,
            isGk: Boolean(t.isGk),
          })),
          ...body.teamB.map((t) => ({
            matchId: upserted.id,
            playerId: t.playerId,
            team: "B" as const,
            initialTeam: "B" as const,
            isGk: Boolean(t.isGk),
          })),
        ],
      });

      return upserted;
    })
    .catch((e: Error) => {
      if (
        e.message === "player_scope" ||
        e.message === "match_scope" ||
        e.message === "finished_scope"
      ) {
        return e.message;
      }
      throw e;
    });

  // Un rejeu tardif sur un match terminé n'est pas une erreur du client : on le
  // refuse explicitement pour que la file d'attente hors-ligne sache qu'il faut
  // conserver l'opération et prévenir, au lieu de la jeter.
  if (match === "finished_scope") {
    return NextResponse.json(
      { error: "Match déjà terminé — admin requis pour le modifier" },
      { status: 403 },
    );
  }
  if (!match || typeof match === "string") {
    return NextResponse.json(
      { error: "Joueur ou match hors du club" },
      { status: 400 },
    );
  }
  return NextResponse.json({ match }, { status: 201 });
}
