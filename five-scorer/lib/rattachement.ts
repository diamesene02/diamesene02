import { prisma } from "@/lib/prisma";
import { idsValides } from "@/lib/ids";

/// « Ce joueur, c'est moi. »
///
/// La règle vivait entièrement dans `app/actions/roster.ts`, donc dans un
/// fichier `"use server"` qu'une route d'API n'a pas le droit d'importer.
/// Elle est ici pour qu'il n'en existe qu'une seule : le site et l'app mobile
/// revendiquent le même profil, et une seconde copie aurait divergé au premier
/// garde ajouté — celui qui manque étant toujours celui qui protège la course
/// entre deux téléphones.
///
/// Extraction pure : aucun contrôle n'a été retiré, ajouté ni réordonné. Les
/// messages sont ceux du site, à la lettre, parce qu'ils s'affichent déjà.

export type MotifRattachement =
  | "identifiant"
  | "interdit"
  | "pas_membre"
  | "introuvable"
  | "archive"
  | "invite"
  | "deja_pris"
  | "conflit";

export type ResultatRattachement =
  | { ok: true }
  | { ok: false; motif: MotifRattachement; error: string };

/// Le statut HTTP qui correspond à chaque refus.
///
/// Il est ici et pas dans la route : c'est une propriété du refus, pas de
/// l'endpoint, et le jour où un second appelant existera il ne devra pas
/// réinventer la table.
export const STATUT_RATTACHEMENT: Record<MotifRattachement, number> = {
  identifiant: 400,
  interdit: 403,
  pas_membre: 403,
  introuvable: 404,
  archive: 409,
  invite: 409,
  deja_pris: 409,
  conflit: 409,
};

export async function rattacherJoueur(params: {
  clubId: string;
  playerId: string;
  /// Le compte qui prend le profil.
  userId: string;
  /// Le compte qui le demande. Différent du précédent quand un admin lie
  /// quelqu'un d'autre.
  acteurId: string;
  canManage: boolean;
}): Promise<ResultatRattachement> {
  const { clubId, playerId, userId, acteurId, canManage } = params;

  // Les types TypeScript ne survivent pas à la compilation : un appelant peut
  // envoyer un objet là où le code attend une chaîne, et Prisma l'interprète
  // comme un filtre. Sans ce contrôle, `{ in: [...] }` en guise d'identifiant
  // faisait porter l'écriture sur tous les profils libres du club d'un coup.
  if (!idsValides(playerId, userId)) {
    return { ok: false, motif: "identifiant", error: "Identifiant invalide." };
  }

  const isSelf = userId === acteurId;
  if (!isSelf && !canManage) {
    return { ok: false, motif: "interdit", error: "Réservé aux admins." };
  }

  const isMember = await prisma.member.findFirst({
    where: { organizationId: clubId, userId },
  });
  if (!isMember) {
    return { ok: false, motif: "pas_membre", error: "Pas membre du club." };
  }

  // Le playerId vient du client : il doit être rattaché à CE club, sinon un
  // membre peut délier le profil d'un joueur d'un club dont il n'est même pas
  // membre. Les garde-fous n'existaient que dans l'affichage du trombinoscope,
  // c'est-à-dire nulle part du point de vue du serveur.
  const cible = await prisma.player.findFirst({
    where: { id: playerId, clubId },
    select: { id: true, userId: true, isGuest: true, isArchived: true },
  });
  if (!cible) {
    return {
      ok: false,
      motif: "introuvable",
      error: "Joueur introuvable dans ce club.",
    };
  }
  if (cible.isArchived) {
    return { ok: false, motif: "archive", error: "Ce joueur est archivé." };
  }
  if (cible.isGuest) {
    return {
      ok: false,
      motif: "invite",
      error: "Un invité ne peut pas être revendiqué.",
    };
  }
  // Profil déjà rattaché à quelqu'un d'autre : seul un admin peut trancher.
  if (cible.userId && cible.userId !== userId && !canManage) {
    return {
      ok: false,
      motif: "deja_pris",
      error: "Ce profil est déjà pris par un autre compte.",
    };
  }

  // L'échec doit être une EXCEPTION, pas une valeur de retour : renvoyer un
  // compte laissait la transaction se terminer normalement, donc COMMITTER le
  // déliement qui la précède. Le compte perdait son profil pendant que
  // l'interface annonçait qu'il ne s'était rien passé.
  const conflit = await prisma
    .$transaction(async (tx) => {
      // Un compte = un seul profil joueur par club.
      await tx.player.updateMany({
        where: { clubId, userId },
        data: { userId: null },
      });
      // updateMany plutôt qu'update : le filtre clubId reste appliqué au
      // moment de l'écriture, et le compte retourné confirme qu'une ligne —
      // et une seule — a bougé.
      const res = await tx.player.updateMany({
        where: {
          id: playerId,
          clubId,
          // Course entre deux revendications simultanées : on n'écrase que si
          // le profil est encore libre, ou déjà celui de ce compte, ou si un
          // admin opère.
          ...(canManage ? {} : { OR: [{ userId: null }, { userId }] }),
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
      motif: "conflit",
      error: "Ce profil vient d'être pris par un autre compte.",
    };
  }

  return { ok: true };
}
