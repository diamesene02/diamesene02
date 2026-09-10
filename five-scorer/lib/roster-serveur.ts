import { prisma } from "@/lib/prisma";
import "server-only";

/// La fiche d'un joueur : ce qu'on accepte d'en écrire.
///
/// Vit ici et non dans `app/actions/roster.ts` parce que DEUX appelants
/// écrivent ces champs : la server action du site et les routes
/// `/api/clubs/[clubId]/joueurs` que l'app mobile appelle. Le plafond de la
/// photo et les bornes du niveau ne peuvent pas exister en deux exemplaires —
/// une borne qui diverge, c'est un joueur « niveau 7 » d'un côté et 5 de
/// l'autre, sans que rien ne le dise.
///
/// La garde d'accès reste à l'appelant : rien ici ne vérifie de droits.

export type PlayerInput = {
  name?: string;
  nickname?: string | null;
  skill?: number;
  isGk?: boolean;
  isGuest?: boolean;
  /// Data-URL JPEG carrée, réduite sur l'appareil (cf. PhotoJoueur).
  /// `null` retire la photo.
  photo?: string | null;
  /// « Je viens tous les lundis » (cf. lib/presences).
  abonne?: boolean;
};

/// La photo arrive du client : on ne la croit pas sur parole.
///
/// Seul un JPEG en data-URL est accepté, et sous 200 ko — le composant en
/// produit une vingtaine. Sans ce plafond, n'importe qui pourrait pousser
/// plusieurs mégaoctets dans une colonne texte à chaque enregistrement de
/// fiche, et la lire ensuite sur toutes les pages du club.
const PHOTO_MAX = 200_000;

function photoValide(v: string): boolean {
  return v.startsWith("data:image/jpeg;base64,") && v.length <= PHOTO_MAX;
}

export function sanitize(input: PlayerInput) {
  const name = input.name?.trim().slice(0, 60);
  return {
    ...(name ? { name } : {}),
    ...(input.nickname !== undefined
      ? { nickname: input.nickname?.trim().slice(0, 40) || null }
      : {}),
    ...(input.skill !== undefined
      ? { skill: Math.min(5, Math.max(1, Math.round(input.skill))) }
      : {}),
    ...(input.isGk !== undefined ? { isGk: input.isGk } : {}),
    ...(input.isGuest !== undefined ? { isGuest: input.isGuest } : {}),
    ...(input.photo !== undefined
      ? { photo: input.photo && photoValide(input.photo) ? input.photo : null }
      : {}),
    ...(input.abonne !== undefined ? { abonne: input.abonne } : {}),
  };
}

/// Revendiquer un profil joueur, ou le lier pour quelqu'un d'autre.
///
/// Le corps vit ici parce que la route mobile en a besoin, et parce qu'il
/// porte des règles qu'on ne veut recopier nulle part : un invité ne se
/// revendique pas, un compte n'a qu'un seul profil par club, et la course
/// entre deux revendications simultanées se tranche DANS la transaction.
///
/// `moi` est le compte qui agit, `userId` celui à qui rattacher le profil —
/// les deux diffèrent quand un admin lie pour un habitué.
export async function lierJoueurAuCompte({
  clubId,
  playerId,
  userId,
  moi,
  peutGerer,
}: {
  clubId: string;
  playerId: string;
  userId: string;
  moi: string;
  peutGerer: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const isSelf = userId === moi;
  if (!isSelf && !peutGerer) {
    return { ok: false, error: "Réservé aux admins." };
  }
  const isMember = await prisma.member.findFirst({
    where: { organizationId: clubId, userId },
  });
  if (!isMember) return { ok: false, error: "Pas membre du club." };

  // Le playerId vient du client : il doit être rattaché à CE club, sinon un
  // membre peut délier le profil d'un joueur d'un club dont il n'est même pas
  // membre. Les garde-fous n'existaient que dans l'affichage du trombinoscope,
  // c'est-à-dire nulle part du point de vue du serveur.
  const cible = await prisma.player.findFirst({
    where: { id: playerId, clubId: clubId },
    select: { id: true, userId: true, isGuest: true, isArchived: true },
  });
  if (!cible) return { ok: false, error: "Joueur introuvable dans ce club." };
  if (cible.isArchived) {
    return { ok: false, error: "Ce joueur est archivé." };
  }
  if (cible.isGuest) {
    return { ok: false, error: "Un invité ne peut pas être revendiqué." };
  }
  // Profil déjà rattaché à quelqu'un d'autre : seul un admin peut trancher.
  if (cible.userId && cible.userId !== userId && !peutGerer) {
    return { ok: false, error: "Ce profil est déjà pris par un autre compte." };
  }

  // L'échec doit être une EXCEPTION, pas une valeur de retour : renvoyer un
  // compte laissait la transaction se terminer normalement, donc COMMITTER le
  // déliement qui la précède. Le compte perdait son profil pendant que
  // l'interface annonçait qu'il ne s'était rien passé.
  const conflit = await prisma
    .$transaction(async (tx) => {
      // Un compte = un seul profil joueur par club.
      await tx.player.updateMany({
        where: { clubId: clubId, userId },
        data: { userId: null },
      });
      // updateMany plutôt qu'update : le filtre clubId reste appliqué au
      // moment de l'écriture, et le compte retourné confirme qu'une ligne —
      // et une seule — a bougé.
      const res = await tx.player.updateMany({
        where: {
          id: playerId,
          clubId: clubId,
          // Course entre deux revendications simultanées : on n'écrase que si
          // le profil est encore libre, ou déjà celui de ce compte, ou si un
          // admin opère.
          ...(peutGerer ? {} : { OR: [{ userId: null }, { userId }] }),
        },
        data: { userId, isGuest: false },
      });
      if (res.count !== 1) throw new Error("link_conflict");
      return null;
    })
    .catch((e: Error) => {
      if (e.message === "link_conflict") return "conflit";
      throw e;
    });
  if (conflit) {
    return {
      ok: false,
      error: "Ce profil vient d'être pris par un autre compte.",
    };
  }

  return { ok: true };
}
