import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClubApiContext } from "@/lib/guard";
import { nomsChasubles } from "@/lib/color";
import { ecrireReglages, type ClubSettingsInput } from "@/lib/reglages-serveur";
import { ini } from "@/lib/ini";
import * as D from "@/lib/dates";

export const dynamic = "force-dynamic";

const FORMATS = [
  ["FIVE", "Five"],
  ["FUTSAL", "Futsal"],
  ["SEVEN", "Foot à 7"],
  ["ELEVEN", "Foot à 11"],
  ["OTHER", "Autre"],
] as const;

const MOTM = [
  ["VOTE", "Vote des membres"],
  ["ADMIN", "Choix du marqueur"],
  ["OFF", "Désactivé"],
] as const;

/// Les huit couleurs proposées, celles du site. Elles ne vivent pas dans
/// l'app : un club qui change de palette doit la voir changer partout sans
/// qu'on republie un binaire sur l'App Store.
const PASTILLES = [
  "#FF6B2C",
  "#3D8BFF",
  "#E5243B",
  "#1DB954",
  "#FFD60A",
  "#8E44AD",
  "#FFFFFF",
  "#111111",
];

/// L'écran « Réglages », en un aller-retour.
///
/// Réservé à qui gère : le site redirige un simple membre vers l'accueil, ici
/// c'est un 403 — la route existe, elle n'est pas pour lui. On ne rend pas
/// 404 comme pour un club inconnu : le club, lui, il en est membre, et le lui
/// nier serait mentir.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  const { clubId } = await params;
  const ctx = await getClubApiContext(clubId);
  if (!ctx) return NextResponse.json({ error: "introuvable" }, { status: 404 });
  if (!ctx.canManage) {
    return NextResponse.json({ error: "Réservé aux admins." }, { status: 403 });
  }

  const [membres, joueursLies, saisons] = await Promise.all([
    prisma.member.findMany({
      where: { organizationId: ctx.org.id },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.player.findMany({
      where: { clubId, userId: { not: null } },
      select: { userId: true, name: true },
    }),
    prisma.season.findMany({ where: { clubId }, orderBy: { startsAt: "desc" } }),
  ]);

  const joueurParUtilisateur = new Map(joueursLies.map((p) => [p.userId as string, p.name]));
  const admins = membres.filter((m) => m.role === "owner" || m.role === "admin").length;
  const noms = nomsChasubles(ctx.club.colorA, ctx.club.colorB);
  const saisonActive = saisons.find((s) => s.isActive) ?? null;

  return NextResponse.json({
    role: ctx.role,
    sousTitre: ctx.role === "owner" ? "Propriétaire du club" : "Admin du club",
    club: {
      nom: ctx.org.name,
      slug: ctx.org.slug,
      couleurA: ctx.club.colorA,
      couleurB: ctx.club.colorB,
      nomChasubleA: noms.a,
      nomChasubleB: noms.b,
      format: ctx.club.format,
      formatLibelle: FORMATS.find(([f]) => f === ctx.club.format)?.[1] ?? "Autre",
      dureeMatchMin: ctx.club.matchDurationMin,
      minJoueurs: ctx.club.minJoueurs,
      capaciteSoiree: ctx.club.capaciteSoiree,
      pointsVictoire: ctx.club.pointsWin,
      pointsNul: ctx.club.pointsDraw,
      suitPasses: ctx.club.trackAssists,
      suitCartons: ctx.club.trackCards,
      membresPeuventScorer: ctx.club.membersCanScore,
      modeHommeDuMatch: ctx.club.motmMode,
      modeHommeDuMatchLibelle: MOTM.find(([m]) => m === ctx.club.motmMode)?.[1] ?? "Désactivé",
      publique: ctx.club.isPublic,
    },
    choix: {
      formats: FORMATS.map(([valeur, libelle]) => ({ valeur, libelle })),
      hommeDuMatch: MOTM.map(([valeur, libelle]) => ({ valeur, libelle })),
      pastilles: PASTILLES,
    },
    invitation: {
      // Le code entier sert à fabriquer le lien ; les huit derniers caractères
      // en majuscules sont ce qu'on montre, comme sur le site.
      code: ctx.club.inviteCode,
      affiche: ctx.club.inviteCode.slice(-8).toUpperCase(),
      lien: `/join/${ctx.club.inviteCode}`,
    },
    // Le jeton d'agenda est un SECOND secret, distinct du code d'invitation :
    // un lien iCal finit dans quinze téléphones et circule. S'il portait le
    // code d'invitation, s'y abonner reviendrait à distribuer le droit
    // d'entrer dans le club.
    agenda: { chemin: `/api/cal/${ctx.club.calendarToken}` },
    membres: {
      sousTitre: `${membres.length} membre${membres.length > 1 ? "s" : ""} · ${admins} admin${admins > 1 ? "s" : ""}`,
      liste: membres.map((m) => ({
        id: m.id,
        nom: m.user.name,
        initiales: ini(m.user.name),
        courriel: m.user.email,
        joueur: joueurParUtilisateur.get(m.user.id) ?? null,
        role: m.role,
        roleLibelle:
          m.role === "owner" ? "Capitaine" : m.role === "admin" ? "Admin" : "Membre",
        estOwner: m.role === "owner",
        estMoi: m.user.id === ctx.user.id,
      })),
    },
    saisons: {
      active: saisonActive?.name ?? null,
      liste: saisons.map((s) => ({
        id: s.id,
        nom: s.name,
        active: s.isActive,
        periode: `${D.dateComplete(s.startsAt)}${s.endsAt ? ` → ${D.dateComplete(s.endsAt)}` : " → en cours"}`,
      })),
    },
  });
}

/// Enregistrer un réglage. Un champ à la fois, comme sur le site : il n'y a
/// pas de bouton « Enregistrer », chaque ligne part toute seule.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  const { clubId } = await params;
  const ctx = await getClubApiContext(clubId);
  if (!ctx) return NextResponse.json({ error: "introuvable" }, { status: 404 });
  if (!ctx.canManage) {
    return NextResponse.json({ error: "Réservé aux admins." }, { status: 403 });
  }

  const corps = (await req.json().catch(() => null)) as ClubSettingsInput | null;
  if (!corps || typeof corps !== "object" || Array.isArray(corps)) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const res = await ecrireReglages(clubId, corps);
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
