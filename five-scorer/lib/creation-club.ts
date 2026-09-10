/// Reconnaître « cette adresse est déjà prise » dans un refus de Better Auth.
///
/// Cette fonction existe parce que la lecture qu'en faisait le site était
/// FAUSSE, et silencieusement. `CreateClubForm` cherchait le mot « slug » dans
/// le refus :
///
///     if (!msg.includes("slug")) { /* on abandonne */ }
///
/// Or la création d'organisation ne rend PAS ce mot-là. Vérifié dans la source
/// de Better Auth 1.7.1 : la route `create` teste `findOrganizationBySlug` et
/// lève `ORGANIZATION_ALREADY_EXISTS` / « Organization already exists »
/// (`node_modules/better-auth/dist/plugins/organization/routes/crud-org.mjs:62`).
/// Le mot « slug » n'apparaît que dans `ORGANIZATION_SLUG_ALREADY_TAKEN`, que
/// seule la MISE À JOUR d'une organisation lève (lignes 158 et 215).
///
/// Conséquence, en production : la reprise avec suffixe (`fc-lundi-2` …
/// `fc-lundi-5`) juste en dessous n'a jamais servi. Le deuxième club à choisir
/// un nom déjà pris — « Les Lundis », « FC Lundi », le genre de nom qu'on
/// choisit deux fois — se voyait refuser sa création avec un message anglais
/// que personne ne pouvait relier au nom qu'il venait de taper.
///
/// La règle est ici, et pas dans l'écran, parce que l'app aura le même
/// formulaire : deux lectures d'un même refus, c'est une divergence qui attend
/// son heure.

/// Les deux codes que Better Auth peut rendre pour une adresse déjà prise. On
/// les teste tous les deux : la création lève le premier, la mise à jour le
/// second, et une version future pourrait les échanger sans prévenir.
const REFUS = ["organization_already_exists", "organization already exists", "slug"];

export function adresseDejaPrise(refus: {
  code?: string | null;
  message?: string | null;
}): boolean {
  const m = `${refus.code ?? ""} ${refus.message ?? ""}`.toLowerCase();
  return REFUS.some((r) => m.includes(r));
}

/// Cinq essais : `fc-lundi`, puis `fc-lundi-2` … `fc-lundi-5`. Au-delà, ce
/// n'est plus une collision, c'est un nom trop banal — et cinq allers-retours
/// suffisent à le dire sans faire attendre.
export const ESSAIS_DE_SLUG = 5;
