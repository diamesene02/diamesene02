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

/// Fenêtre de revendication de l'historique v1.
///
/// Le PIN hérité de la v1 est un code à quatre chiffres : dix mille
/// combinaisons pour devenir propriétaire de tout l'historique, avec le droit
/// de le supprimer — et l'écran d'accueil annonce spontanément qu'un historique
/// est à prendre.
///
/// Une limitation du nombre d'essais ne protège pas ici : l'app tourne sur des
/// fonctions sans état, réparties sur plusieurs instances et redémarrées à
/// froid, donc aucun compteur en mémoire ne survit ; et comme l'inscription est
/// libre, un compteur par utilisateur se remet à zéro pour le prix d'un
/// nouveau compte. Une défense qui ne défend rien est pire que pas de défense :
/// elle rassure.
///
/// Le contrôle qui tient sur une architecture sans état est un interrupteur :
/// la revendication n'est possible que si l'exploitant l'ouvre explicitement.
/// Il l'ouvre le temps de récupérer son historique, puis la referme. La
/// fenêtre reste fermée par défaut.
function revendicationOuverte(): boolean {
  return process.env.LEGACY_CLAIM_OPEN === "1";
}

export async function claimLegacyClub(
  userId: string,
  pin: string,
): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  const org = await getUnclaimedLegacyClub();
  if (!org) return { ok: false, error: "Aucun historique à revendiquer." };

  if (!revendicationOuverte()) {
    return {
      ok: false,
      error:
        "La reprise de l'historique est fermée. Demande à l'administrateur de l'ouvrir.",
    };
  }

  const hash = process.env.ADMIN_PIN_HASH;
  if (!hash || !bcrypt.compareSync(pin, hash)) {
    return { ok: false, error: "PIN incorrect." };
  }

  await auth.api.addMember({
    body: { organizationId: org.id, userId, role: "owner" },
  });
  return { ok: true, slug: org.slug };
}
