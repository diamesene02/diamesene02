"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { idsValides } from "@/lib/ids";
import {
  ecrireReglages,
  type ClubSettingsInput,
} from "@/lib/reglages-serveur";
import { auth } from "@/lib/auth";
import { requireUser, requireClub } from "@/lib/guard";
import { claimLegacyClub } from "@/lib/legacy";
import { createId } from "@paralleldrive/cuid2";

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/// Donne un profil joueur au compte : adopte un profil existant non lié qui
/// porte le même nom (cas typique : le roster migré de la v1, ou un joueur
/// créé par l'admin avant que la personne ne s'inscrive) — sinon en crée un.
async function ensureLinkedPlayer(
  clubId: string,
  user: { id: string; name: string },
) {
  const existing = await prisma.player.findFirst({
    where: { clubId, userId: user.id },
  });
  if (existing) return;

  const unlinked = await prisma.player.findMany({
    where: { clubId, userId: null, isGuest: false, isArchived: false },
    select: { id: true, name: true, nickname: true },
  });
  const target = normalizeName(user.name);
  const match = unlinked.find(
    (p) =>
      normalizeName(p.name) === target ||
      (p.nickname && normalizeName(p.nickname) === target),
  );
  if (match) {
    await prisma.player.update({
      where: { id: match.id },
      data: { userId: user.id },
    });
  } else {
    await prisma.player.create({
      data: { clubId, name: user.name, userId: user.id },
    });
  }
}

// --- Rejoindre un club par code d'invitation --------------------------------

export async function joinClubByCode(
  code: string,
): Promise<{ ok: false; error: string } | never> {
  const session = await requireUser();
  const club = await prisma.club.findUnique({
    where: { inviteCode: code.trim() },
    include: { organization: true },
  });
  if (!club) return { ok: false, error: "Code d'invitation invalide." };

  const existing = await prisma.member.findFirst({
    where: { organizationId: club.id, userId: session.user.id },
  });
  if (!existing) {
    await auth.api.addMember({
      body: {
        organizationId: club.id,
        userId: session.user.id,
        role: "member",
      },
    });
  }
  await ensureLinkedPlayer(club.id, session.user);
  redirect(`/c/${club.organization.slug}`);
}

// --- Revendiquer l'historique v1 (ancien PIN admin) ------------------------

export async function claimLegacy(
  pin: string,
): Promise<{ ok: false; error: string } | never> {
  const session = await requireUser();
  const res = await claimLegacyClub(session.user.id, pin);
  if (!res.ok) return res;
  // Le nouvel owner récupère un profil joueur : celui du roster migré qui
  // porte son nom si possible, sinon un nouveau.
  await ensureLinkedPlayer("club_legacy", session.user);
  redirect(`/c/${res.slug}`);
}

// --- Réglages du club -------------------------------------------------------

export type { ClubSettingsInput } from "@/lib/reglages-serveur";

/// Les réglages du club. Le corps vit dans `lib/reglages-serveur.ts` : la
/// route mobile `PATCH /api/clubs/[clubId]/reglages` écrit les mêmes champs,
/// avec les mêmes bornes.
export async function updateClubSettings(
  slug: string,
  input: ClubSettingsInput,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireClub(slug);
  if (!ctx.canManage) return { ok: false, error: "Réservé aux admins." };

  const res = await ecrireReglages(ctx.club.id, input);
  if (res.ok) revalidatePath(`/c/${slug}`, "layout");
  return res;
}

/// Régénère le code d'invitation. IRRÉVERSIBLE : tous les liens déjà
/// partagés cessent de fonctionner à la seconde.
export async function regenerateInviteCode(
  slug: string,
): Promise<{ ok: boolean; code?: string; error?: string }> {
  const ctx = await requireClub(slug);
  if (!ctx.canManage) return { ok: false, error: "Réservé aux admins." };
  const code = createId().slice(0, 12);
  await prisma.club.update({
    where: { id: ctx.club.id },
    data: { inviteCode: code },
  });
  revalidatePath(`/c/${slug}/settings`);
  return { ok: true, code };
}

// --- Membres ----------------------------------------------------------------

export async function setMemberRole(
  slug: string,
  memberId: string,
  role: "admin" | "member",
): Promise<{ ok: boolean; error?: string }> {
  // Identifiants venus du client : refuser tout ce qui n'est pas une
  // chaîne, sinon un objet passe pour un filtre Prisma (cf. lib/ids.ts).
  if (!idsValides(memberId)) {
    return { ok: false, error: "Identifiant invalide." };
  }

  // Le rôle est validé À L'EXÉCUTION, pas seulement par le type. Une server
  // action s'appelle depuis n'importe quel client : `role` n'était contraint
  // que par TypeScript, et rien n'empêchait d'envoyer « owner ». Un admin se
  // serait promu owner — un rôle que `removeMember` et cette action même
  // refusent ensuite de toucher, donc indéboulonnable.
  if (role !== "admin" && role !== "member") {
    return { ok: false, error: "Rôle inconnu." };
  }

  const ctx = await requireClub(slug);
  if (!ctx.canManage) return { ok: false, error: "Réservé aux admins." };
  const member = await prisma.member.findFirst({
    where: { id: memberId, organizationId: ctx.club.id },
  });
  if (!member) return { ok: false, error: "Membre introuvable." };
  if (member.role === "owner") {
    return { ok: false, error: "Impossible de modifier l'owner." };
  }
  await prisma.member.update({ where: { id: memberId }, data: { role } });
  revalidatePath(`/c/${slug}/settings`);
  return { ok: true };
}

export async function removeMember(
  slug: string,
  memberId: string,
): Promise<{ ok: boolean; error?: string }> {
  // Identifiants venus du client : refuser tout ce qui n'est pas une
  // chaîne, sinon un objet passe pour un filtre Prisma (cf. lib/ids.ts).
  if (!idsValides(memberId)) {
    return { ok: false, error: "Identifiant invalide." };
  }

  const ctx = await requireClub(slug);
  if (!ctx.canManage) return { ok: false, error: "Réservé aux admins." };
  const member = await prisma.member.findFirst({
    where: { id: memberId, organizationId: ctx.club.id },
  });
  if (!member) return { ok: false, error: "Membre introuvable." };
  if (member.role === "owner") {
    return { ok: false, error: "Impossible de retirer l'owner." };
  }
  await prisma.$transaction([
    // Le profil joueur reste (l'historique des matchs est à lui) mais est
    // délié du compte.
    prisma.player.updateMany({
      where: { clubId: ctx.club.id, userId: member.userId },
      data: { userId: null },
    }),
    prisma.member.delete({ where: { id: member.id } }),
  ]);
  revalidatePath(`/c/${slug}/settings`);
  return { ok: true };
}
