import type { Noyau } from "../Noyau";
import { chargerMoiMemorise } from "../ClubCourant";
import type { FicheMatch } from "../../lib/api";
import type { LivePlayer } from "../../lib/match/local";
import type { LocalMatch } from "../../lib/outbox/types";
import { feuilleAReprendre } from "./reprise";
import { heureDuSuivant } from "./textes";

// « On rejoue — mêmes équipes » : le geste le plus fréquent d'une soirée. Le
// club enchaîne six à huit matchs avec les mêmes chasubles ; repasser par la
// compo complète entre chaque, c'est quatorze taps pour rien.
//
// Les deux chemins écrivent le match sur l'APPAREIL (`createMatch`), comme le
// coup d'envoi de la compo : la feuille s'ouvre sans attendre le serveur, la
// file s'en charge. Au gymnase, le réseau est une chance, pas une condition.

type Rejouer = NonNullable<FicheMatch["rejouer"]>;

/// Depuis le récap : la compo que le serveur a préparée (`FicheMatch.
/// rejouer`), joueurs archivés déjà écartés, soirée et saison déjà choisies.
///
/// Si la feuille de CETTE soirée tourne déjà sur ce téléphone, on y va plutôt
/// que d'en ouvrir une seconde : le serveur ne le sait pas encore si elle n'est
/// pas partie, et deux matchs en direct, c'est deux tableaux pour un terrain.
/// Une feuille d'un autre jour restée ouverte, elle, ne compte pas —
/// `feuilleAReprendre` dit pourquoi.
///
/// Rend l'identifiant du match à ouvrir.
export async function rejouerDepuisLeRecap(
  { local, drain }: Pick<Noyau, "local" | "drain">,
  clubId: string,
  r: Rejouer,
): Promise<string> {
  const enCours = feuilleAReprendre(await local.getLiveMatchOfClub(clubId), {
    matchDayId: r.soireeId,
    playedAt: r.joueLe,
  });
  if (enCours) return enCours.id;

  // Les réglages du club (couleurs, passes, cartons, mode de l'homme du
  // match) : la feuille les lit dans le miroir local. Un téléphone qui n'a
  // jamais ouvert la compo ne les a pas — sans eux, la feuille s'ouvrirait
  // en blanc et noir et ne demanderait pas les passes.
  if (!(await local.getLocalClub(clubId))) {
    const moi = await chargerMoiMemorise();
    const c = moi.clubs.find((x) => x.id === clubId);
    if (c) {
      await local.saveClubSettings({
        id: c.id,
        slug: c.slug,
        name: c.nom,
        colorA: c.couleurA,
        colorB: c.couleurB,
        trackAssists: c.reglages.suitPasses,
        trackCards: c.reglages.suitCartons,
        motmMode: c.reglages.modeHommeDuMatch,
        matchDurationMin: c.reglages.dureeMatchMin,
      });
    }
  }

  // Les fiches des joueurs, pour que la feuille ait leurs noms et leurs
  // visages même sans réseau (et pour que `createMatch` reconnaisse les
  // invités à embarquer). Sans `photo` : le serveur ne l'envoie plus ici (elle
  // est déjà dans les effectifs du même récap), et `saveRoster` garde alors le
  // visage déjà en base plutôt que de l'effacer.
  await local.saveRoster(
    clubId,
    r.joueurs.map((j) => ({
      id: j.playerId,
      name: j.nom,
      nickname: j.surnom,
      skill: j.niveau,
      isGk: j.estGardien,
      isGuest: j.invite,
      isArchived: false,
    })),
  );

  const camp = (c: "A" | "B") =>
    r.joueurs
      .filter((j) => j.camp === c)
      .map((j) => ({ playerId: j.playerId, isGk: j.gardienCeMatch }));

  const id = await local.createMatch({
    clubId,
    matchDayId: r.soireeId,
    seasonId: r.saisonId,
    kind: r.genre,
    opponentId: r.adversaireId,
    teamAName: r.nomA,
    teamBName: r.nomB,
    teamA: camp("A"),
    teamB: camp("B"),
    playedAt: r.joueLe,
  });
  void drain.relancer();
  return id;
}

/// Depuis la feuille qu'on vient de terminer : tout est déjà sur l'appareil.
/// Même soirée, même saison, mêmes équipes, mêmes gardiens.
///
/// Sur une feuille saisie après coup, le suivant se date une demi-heure plus
/// tard (jamais dans le futur) : c'est le deuxième match de CE lundi-là, pas
/// un match de ce soir.
///
/// Le match qu'on vient de terminer n'est plus LIVE : la seule feuille en
/// cours que le téléphone puisse encore avoir est donc soit celle qu'on vient
/// de lancer (double tap), soit un oubli d'un autre jour. `feuilleAReprendre`
/// fait le tri — sans lui, ce bouton renvoyait dans le match de la semaine
/// dernière.
export async function matchSuivant(
  { local, drain }: Pick<Noyau, "local" | "drain">,
  m: LocalMatch,
  equipes: { teamA: LivePlayer[]; teamB: LivePlayer[] },
  retro: boolean,
): Promise<string> {
  const matchDayId = m.matchDayId ?? null;
  const playedAt = retro ? heureDuSuivant(m.playedAt) : null;
  const enCours = feuilleAReprendre(await local.getLiveMatchOfClub(m.clubId), {
    matchDayId,
    playedAt,
  });
  if (enCours) return enCours.id;
  const id = await local.createMatch({
    clubId: m.clubId,
    matchDayId,
    seasonId: m.seasonId ?? null,
    kind: m.kind,
    opponentId: m.opponentId ?? null,
    teamAName: m.teamAName,
    teamBName: m.teamBName,
    teamA: equipes.teamA.map((p) => ({ playerId: p.id, isGk: p.isGk })),
    teamB: equipes.teamB.map((p) => ({ playerId: p.id, isGk: p.isGk })),
    playedAt,
  });
  void drain.relancer();
  return id;
}
