// L'union des opérations que la file de CE téléphone peut porter.
//
// `types.ts` est une copie OCTET POUR OCTET de `five-scorer/lib/db.ts`
// (voir `types.test.ts` — c'est vérifié) : les huit gestes du direct, partagés
// avec le miroir du navigateur. Rien ne doit s'y ajouter, sous peine de
// rendre la copie infidèle et le test rouge.
//
// Une compo préparée n'est pas un geste du direct — elle vit sur une soirée,
// pas sur un match, et le site ne la met jamais dans une file d'attente : son
// enregistrement passe par une action serveur, en ligne, tout de suite. Elle
// n'a donc rien à faire dans le fichier partagé.
//
// Elle est étendue ICI, à côté de la copie et non dedans, pour que les deux
// restent vraies en même temps : `OutboxOp` (le type copié) dit ce que le web
// et le mobile ont en commun ; `OutboxOpMobile` (ici) dit ce que CE téléphone
// sait mettre en attente, huit gestes du direct plus la compo.
import type { OutboxEntry as OutboxEntryPartagee, OutboxOp as OutboxOpPartagee } from "./types";

export type OutboxOpCompo = {
  /// Pose la composition PRÉPARÉE d'une soirée — les équipes décidées
  /// trois ou quatre jours avant, sur WhatsApp.
  ///
  /// **La première opération de la file qui ne porte pas de match**, et
  /// c'est voulu : une compo vit sur la SOIRÉE, pas sur un match. Une
  /// soirée enchaîne quatre à huit matchs avec les deux mêmes équipes.
  /// `matchId` est donc explicitement `undefined` — `outbox.ts:57` écrit
  /// déjà `op.matchId ?? null` et le blocage sait mettre de côté une
  /// opération seule (`outbox.ts:117-122`, écrit en prévision de ce cas).
  ///
  /// **Le payload porte la liste ENTIÈRE**, jamais un delta : le serveur
  /// remplace l'ensemble. C'est ce qui rend le rejeu sûr — rejouer deux
  /// fois donne le même état qu'une fois — et le dernier-arrivé-gagne
  /// honnête quand deux téléphones composent hors ligne (spec 0005).
  kind: "setCompo";
  clubId: string;
  matchId?: undefined;
  soireeId: string;
  payload: {
    joueurs: { playerId: string; team: "A" | "B"; isGk: boolean }[];
    teamAName?: string;
    teamBName?: string;
  };
};

export type OutboxOp = OutboxOpPartagee | OutboxOpCompo;

export type OutboxEntry = Omit<OutboxEntryPartagee, "op"> & { op: OutboxOp };
