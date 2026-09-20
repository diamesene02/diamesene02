import type { MatchLocal } from "../../lib/match/local";
import type { Accueil, ClubDeMoi } from "../../lib/api";

type CoupDEnvoi = NonNullable<Accueil["coupDEnvoi"]>;

/// Le coup d'envoi en un tap : le match s'écrit sur l'appareil avec la compo
/// que le serveur a jugée prête (préparée pour la soirée, sinon celle de la
/// dernière fois) — le `RematchButton` de l'accueil du site.
///
/// Comme « Nouveau match », rien ne touche le réseau : le club et les joueurs
/// de la compo sont recopiés dans le miroir local (la feuille lit les noms
/// là, et s'ouvre hors ligne), puis `createMatch` enfile l'envoi. Rend
/// l'identifiant du match.
export async function lancerCompoPrete(
  local: MatchLocal,
  clubId: string,
  club: ClubDeMoi | null,
  compo: CoupDEnvoi,
): Promise<string> {
  if (club) {
    await local.saveClubSettings({
      id: club.id,
      slug: club.slug,
      name: club.nom,
      colorA: club.couleurA,
      colorB: club.couleurB,
      trackAssists: club.reglages.suitPasses,
      trackCards: club.reglages.suitCartons,
      motmMode: club.reglages.modeHommeDuMatch,
      matchDurationMin: club.reglages.dureeMatchMin,
    });
  }
  // Sans `photo` : le serveur ne l'envoie plus dans la compo — elle est déjà
  // dans le classement de la même réponse —, et `saveRoster` garde alors le
  // visage déjà en base plutôt que de l'effacer.
  await local.saveRoster(
    clubId,
    compo.joueurs.map((j) => ({
      id: j.playerId,
      name: j.nom,
      nickname: j.surnom,
      skill: j.niveau,
      isGk: j.estGardien,
      isGuest: j.invite,
    })),
  );
  // Le gardien DE CE MATCH, pas le gardien attitré : la compo du jeudi a pu
  // mettre quelqu'un d'autre aux cages.
  const camp = (c: "A" | "B") =>
    compo.joueurs
      .filter((j) => j.camp === c)
      .map((j) => ({ playerId: j.playerId, isGk: j.gardienCeMatch }));
  return local.createMatch({
    clubId,
    kind: "INTERNAL",
    teamAName: compo.nomA,
    teamBName: compo.nomB,
    teamA: camp("A"),
    teamB: camp("B"),
    playedAt: null,
    // Posé par le serveur seulement si la soirée est aujourd'hui ; sinon il
    // rattache lui-même le match à la soirée de son jour.
    matchDayId: compo.soireeId,
    seasonId: compo.saisonId,
  });
}
