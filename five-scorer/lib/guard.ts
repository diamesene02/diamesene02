import "server-only";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "./auth";
import { prisma } from "./prisma";
import type { Club, Organization } from "@prisma/client";

export type ClubRole = "owner" | "admin" | "member";

export type ClubContext = {
  user: { id: string; name: string; email: string; image?: string | null };
  org: Organization;
  club: Club;
  role: ClubRole;
  /// Peut gérer : matchs (edit/suppr), roster, saisons, réglages, membres.
  canManage: boolean;
  /// Peut saisir en live (créer un match, marquer des events).
  canScore: boolean;
};

export const getUserSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

export async function requireUser() {
  const session = await getUserSession();
  if (!session) redirect("/login");

  // La session vit cinq minutes dans un cookie signé, sans relecture de la
  // base : elle peut donc survivre au compte qu'elle désigne. On vérifie que
  // l'utilisateur existe encore, sinon les pages suivantes travaillent sur un
  // fantôme — écrans vides, ou échec sur une contrainte de clé étrangère dès
  // la première écriture. Une requête sur clé primaire, dédupliquée par
  // React.cache pour toute la requête : le coût est négligeable devant le
  // risque de laisser un accès ouvert après une révocation.
  const stillExists = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true },
  });
  if (!stillExists) redirect("/session-expiree");

  return session;
}

function toContext(
  user: ClubContext["user"],
  org: Organization,
  club: Club,
  role: string,
): ClubContext {
  const r: ClubRole = role === "owner" || role === "admin" ? role : "member";
  const canManage = r !== "member";
  return {
    user,
    org,
    club,
    role: r,
    canManage,
    canScore: canManage || club.membersCanScore,
  };
}

/// Garde des pages /c/[slug]/** : session requise + appartenance au club.
export const requireClub = cache(async (slug: string): Promise<ClubContext> => {
  const session = await requireUser();
  const org = await prisma.organization.findUnique({
    where: { slug },
    include: { club: true },
  });
  if (!org?.club) notFound();
  const member = await prisma.member.findFirst({
    where: { organizationId: org.id, userId: session.user.id },
  });
  if (!member) redirect("/onboarding");
  const { club, ...orgOnly } = org;
  return toContext(session.user, orgOnly, club, member.role);
});

/// Variante API (outbox de sync) : renvoie null au lieu de rediriger.
export async function getClubApiContext(
  clubId: string,
): Promise<ClubContext | null> {
  const session = await getUserSession();
  if (!session) return null;
  const org = await prisma.organization.findUnique({
    where: { id: clubId },
    include: { club: true },
  });
  if (!org?.club) return null;
  const member = await prisma.member.findFirst({
    where: { organizationId: org.id, userId: session.user.id },
  });
  if (!member) return null;
  const { club, ...orgOnly } = org;
  return toContext(session.user, orgOnly, club, member.role);
}

/// Clubs de l'utilisateur courant (switcher, redirection post-login).
export async function getUserClubs(userId: string) {
  const members = await prisma.member.findMany({
    where: { userId },
    include: { organization: { include: { club: true } } },
    orderBy: { createdAt: "asc" },
  });
  return members
    .filter((m) => m.organization.club)
    .map((m) => ({
      role: m.role,
      org: m.organization,
      club: m.organization.club!,
    }));
}
