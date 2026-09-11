/// La version du CONTRAT entre cette app et le serveur.
///
/// **Miroir de `five-scorer/lib/protocole.ts`, recopié et non importé.** Les
/// deux dépôts ne s'importent pas l'un l'autre — c'est la discipline de
/// `lib/noyau/`, pour la même raison : l'app se construit seule, sans avoir le
/// site sous la main.
///
/// La différence avec `lib/noyau/`, et elle compte : ces deux fichiers ne sont
/// PAS des copies conformes. Le serveur porte deux nombres (le minimum qu'il
/// sert encore, le courant), l'app n'en porte qu'un — celui qu'elle annonce.
/// Un test d'égalité octet pour octet serait donc une fausse promesse. Ce qui
/// est vérifié, c'est la VALEUR, et elle l'est de la seule façon qui vaille :
/// `scripts/verif-version.mjs` interroge le vrai serveur.
export const PROTOCOLE_COURANT = 1;

/// Le nom de l'en-tête, des deux côtés. Il ne change pas avec le nom du
/// produit : « x-protocole » désigne le contrat, pas la marque.
export const ENTETE_PROTOCOLE = "x-protocole";
export const ENTETE_VERDICT = "x-protocole-verdict";

export type VerdictProtocole = "ok" | "trop-vieux" | "trop-recent";
