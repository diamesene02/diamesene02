import { prisma } from "@/lib/prisma";
import { estId } from "@/lib/ids";
import { auth } from "@/lib/auth";

/// « On m'a filé un code. »
///
/// La règle vivait entièrement dans `app/actions/club.ts`, donc dans un
/// fichier `"use server"` qu'une route d'API n'a pas le droit d'importer.
/// Elle est ici pour qu'il n'en existe qu'une seule : le site et l'app mobile
/// font entrer un membre par le même chemin. C'est la troisième extraction du
/// même genre (`lib/joueur.ts`, `lib/rattachement.ts`) et la raison ne change
/// pas — une copie passe tous les tests le jour où on l'écrit, et diverge au
/// premier garde ajouté d'un seul côté.
///
/// Extraction pure, à deux ajouts près, tous deux écrits noir sur blanc plus
/// bas : la validation du type du code (une route reçoit n'importe quoi), et
/// `normaliserCode`, qui accepte le LIEN complet — ce que les gens ont
/// réellement dans WhatsApp.

export type MotifRejoindre = "code" | "introuvable";

export type ResultatRejoindre =
  | {
      ok: true;
      clubId: string;
      slug: string;
      nom: string;
      /// Vrai si le compte était DÉJÀ membre. L'appelant ne doit pas traiter
      /// ce cas comme une erreur : rejoindre deux fois le même club est le
      /// geste normal de quelqu'un qui rouvre un vieux lien, et le résultat
      /// attendu est « tu y es », pas un refus.
      dejaMembre: boolean;
    }
  | { ok: false; motif: MotifRejoindre; error: string };

/// Le statut HTTP qui correspond à chaque refus. Ici et pas dans la route :
/// c'est une propriété du refus, pas de l'endpoint.
export const STATUT_REJOINDRE: Record<MotifRejoindre, number> = {
  code: 400,
  introuvable: 404,
};

/// Le code, tel qu'on le reçoit vraiment.
///
/// Le club ne partage pas un code, il partage un LIEN
/// (`.../join/<code>` — voir `InviteCard.tsx` et l'écran des réglages de
/// l'app). Ce que le nouveau venu a sous le pouce est donc l'URL entière,
/// collée depuis WhatsApp, et le champ du site s'intitule « Code
/// d'invitation » : collé tel quel, il ne trouvait rien.
///
/// On accepte les deux, et on renvoie `null` sur ce qui n'est pas un
/// identifiant recevable. Minuscules parce que tous les codes du dépôt sont
/// des cuid2 (`@default(cuid())`, ou `createId().slice(0, 12)` pour ceux
/// qu'on régénère) : abaisser la casse ne peut que rapprocher d'une
/// correspondance, jamais en inventer une.
export function normaliserCode(brut: unknown): string | null {
  if (typeof brut !== "string") return null;
  // Une URL de partage fait une cinquantaine de caractères ; au-delà de 200 on
  // ne cherche plus, c'est du bruit collé par accident.
  if (brut.length > 200) return null;

  let code = brut.trim();
  const apres = code.split(/\/join\//)[1];
  if (apres !== undefined) code = apres;
  // Ce qui suit le code dans une URL : paramètres, ancre, barre finale.
  code = code.split(/[?#/]/)[0].trim().toLowerCase();

  // `estId` est le garde de `lib/ids.ts` : une chaîne non vide, bornée, sans
  // caractère de contrôle. Sans lui, un objet passé pour un code deviendrait
  // un filtre Prisma, et `findUnique` viserait autant de clubs qu'on veut.
  return estId(code) ? code : null;
}

function normaliserNom(s: string): string {
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
///
/// Sans ce rattrapage, celui qui rejoint apparaît deux fois dans le vestiaire :
/// la fiche que l'admin avait préparée pour lui, et la sienne, vide.
export async function assurerProfilJoueur(
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
  const target = normaliserNom(user.name);
  const match = unlinked.find(
    (p) =>
      normaliserNom(p.name) === target ||
      (p.nickname && normaliserNom(p.nickname) === target),
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

/// Rejoindre un club par son code d'invitation.
///
/// Le compte devient membre (rôle `member`) et reçoit un profil joueur. Rien
/// n'est fait si le code ne désigne aucun club : c'est un 404 et non un 403,
/// pour ne pas confirmer l'existence d'un club à qui essaie des codes.
export async function rejoindreParCode(params: {
  code: unknown;
  user: { id: string; name: string };
}): Promise<ResultatRejoindre> {
  const code = normaliserCode(params.code);
  // Le message est celui du site, à la lettre : il s'affiche déjà.
  if (!code) {
    return { ok: false, motif: "code", error: "Code d'invitation invalide." };
  }

  const club = await prisma.club.findUnique({
    where: { inviteCode: code },
    include: { organization: true },
  });
  if (!club) {
    return {
      ok: false,
      motif: "introuvable",
      error: "Code d'invitation invalide.",
    };
  }

  const existing = await prisma.member.findFirst({
    where: { organizationId: club.id, userId: params.user.id },
  });
  if (!existing) {
    await auth.api.addMember({
      body: {
        organizationId: club.id,
        userId: params.user.id,
        role: "member",
      },
    });
  }
  await assurerProfilJoueur(club.id, params.user);

  return {
    ok: true,
    clubId: club.id,
    slug: club.organization.slug,
    nom: club.organization.name,
    dejaMembre: existing != null,
  };
}
