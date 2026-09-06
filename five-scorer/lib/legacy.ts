import "server-only";

import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { auth } from "./auth";

// Pont v1 → v2 : la migration SQL a rangé l'historique pré-plateforme dans un
// club "club_legacy" sans aucun membre. Le premier compte qui saisit l'ancien
// PIN admin (ADMIN_PIN_HASH, inchangé depuis la v1) le revendique et en
// devient owner.

export const LEGACY_CLUB_ID = "club_legacy";

export async function getUnclaimedLegacyClub() {
  const org = await prisma.organization.findUnique({
    where: { id: LEGACY_CLUB_ID },
    include: { club: true, members: { take: 1 } },
  });
  if (!org?.club || org.members.length > 0) return null;
  return org;
}

export async function claimLegacyClub(
  userId: string,
  pin: string
): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  const org = await getUnclaimedLegacyClub();
  if (!org) return { ok: false, error: "Aucun historique à revendiquer." };

  const hash = process.env.ADMIN_PIN_HASH;
  if (!hash || !bcrypt.compareSync(pin, hash)) {
    return { ok: false, error: "PIN incorrect." };
  }

  await auth.api.addMember({
    body: { organizationId: org.id, userId, role: "owner" },
  });
  return { ok: true, slug: org.slug };
}
