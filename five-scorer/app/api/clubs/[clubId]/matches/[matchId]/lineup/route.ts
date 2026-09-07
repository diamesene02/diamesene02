import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClubApiContext } from "@/lib/guard";
import { idsValides } from "@/lib/ids";

type Ctx = { params: Promise<{ clubId: string; matchId: string }> };

type PatchBody = { playerId: string; team: "A" | "B" };

/// PATCH : fait changer un joueur de camp dans un match en cours.
///
/// L'erreur de composition ne se voit qu'au coup d'envoi. Avant, la seule
/// issue était de terminer le match et de tout ressaisir. L'écriture est
/// absolue (« ce joueur est dans l'équipe X »), pas incrémentale : la file
/// hors-ligne peut la rejouer sans jamais faire osciller la compo.
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

  const match = await prisma.match.findFirst({
    where: { id: matchId, clubId },
    select: { status: true, kind: true },
  });
  if (!match) {
    return NextResponse.json({ error: "Match introuvable" }, { status: 404 });
  }
  // Recomposer un match terminé, c'est réécrire l'histoire : réservé aux
  // admins, comme toute autre retouche rétroactive.
  if (match.status === "FINISHED" && !ctx.canManage) {
    return NextResponse.json(
      { error: "Admin requis pour modifier un match terminé" },
      { status: 403 },
    );
  }

  // Match contre un adversaire extérieur : l'équipe B n'est pas une équipe du
  // club, c'est l'adversaire. Y envoyer un de nos joueurs le faisait
  // disparaître de l'écran sans retour possible, et lib/stats.ts comptait
  // ensuite une victoire du club comme une défaite pour lui.
  if (match.kind === "EXTERNAL" && body.team === "B") {
    return NextResponse.json(
      { error: "Pas d'équipe B à composer sur un match contre un adversaire" },
      { status: 400 },
    );
  }

  // Le joueur doit être inscrit à CE match : sans ce contrôle, la route
  // servirait à sonder l'existence de joueurs d'autres clubs.
  // Tant que RIEN n'a été saisi dans le match, on est encore au coup d'envoi :
  // corriger la composition corrige aussi l'équipe de départ, puisqu'il n'y a
  // pas encore d'histoire à préserver. Au premier événement, les équipes de
  // départ se figent — c'est tout l'objet du champ.
  //
  // Le repère est l'état du MATCH, pas celui du joueur : se fier aux buts du
  // joueur aurait réécrit l'équipe de départ de quiconque a joué une mi-temps
  // sans marquer, ce qui est le cas courant.
  const dejaSaisi = await prisma.matchEvent.count({ where: { matchId } });
  const corrigeDepart = dejaSaisi === 0;

  const updated = await prisma.matchParticipant.updateMany({
    where: { matchId, playerId: body.playerId },
    data: corrigeDepart
      ? { team: body.team, initialTeam: body.team }
      : { team: body.team },
  });
  // Joueur absent de la feuille : rien à écrire, et surtout rien à réessayer.
  // Un 4xx ici bloquerait DÉFINITIVEMENT toute la chaîne d'opérations du match
  // dans la file hors-ligne (lib/sync.ts) — buts compris — pour un changement
  // de camp devenu sans objet. On répond donc 200 en le disant.
  return NextResponse.json({ ok: true, applique: updated.count > 0 });
}


type PostBody = {
  playerId: string;
  team: "A" | "B";
  isGk?: boolean;
  guest?: { id: string; name: string };
};

/// POST : inscrit un joueur arrivé après le coup d'envoi.
///
/// Idempotent : rejouer l'opération ne crée pas de doublon et ne réécrit pas
/// l'équipe d'un joueur déjà inscrit — sinon un rejeu tardif annulerait un
/// changement de camp fait entre-temps.
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

  const match = await prisma.match.findFirst({
    where: { id: matchId, clubId },
    select: { status: true, kind: true },
  });
  if (!match) {
    return NextResponse.json({ error: "Match introuvable" }, { status: 404 });
  }
  if (match.status === "FINISHED" && !ctx.canManage) {
    return NextResponse.json(
      { error: "Admin requis pour modifier un match terminé" },
      { status: 403 },
    );
  }
  if (match.kind === "EXTERNAL" && body.team === "B") {
    return NextResponse.json(
      { error: "Pas d'équipe B à composer sur un match contre un adversaire" },
      { status: 400 },
    );
  }

  // Un invité créé hors ligne n'existe pas encore côté serveur : on le crée
  // avant, exactement comme le fait la création de match. Sans ce sas, la route
  // répondait 400 — un refus, donc le blocage définitif de toute la chaîne
  // d'opérations du match, buts compris.
  if (body.guest && body.guest.id === body.playerId) {
    if (!idsValides(body.guest.id)) {
      return NextResponse.json({ error: "Invité invalide" }, { status: 400 });
    }
    await prisma.player.upsert({
      where: { id: body.guest.id },
      create: {
        id: body.guest.id,
        clubId,
        name: body.guest.name.trim().slice(0, 60) || "Invité",
        isGuest: true,
      },
      update: {},
    });
  }

  // Le joueur doit être du club — l'identifiant vient du client.
  const aNous = await prisma.player.count({
    where: { id: body.playerId, clubId },
  });
  if (!aNous) {
    return NextResponse.json({ error: "Joueur hors du club" }, { status: 400 });
  }

  // Le joueur arrivé en cours de match a pour équipe de départ celle où il
  // entre : c'est bien le résultat de ce camp qui doit lui être compté.
  await prisma.matchParticipant.createMany({
    data: [
      {
        matchId,
        playerId: body.playerId,
        team: body.team,
        initialTeam: body.team,
        isGk: Boolean(body.isGk),
      },
    ],
    skipDuplicates: true,
  });
  return NextResponse.json({ ok: true });
}
