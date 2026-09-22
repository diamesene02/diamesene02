import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import Ecran from "../composants/Ecran";
import EnTeteClub, { TitreEcran } from "../composants/EnTeteClub";
import ErreurChargement from "../composants/ErreurChargement";
import LigneScore from "../composants/LigneScore";
import { BoutonPlein, BoutonVerre, CarteVerre, Saisie, Segment } from "../composants/base";
import RangeeCompo from "../composants/compo/Rangee";
import { Bloc, Squelette } from "../composants/Squelette";
import { IconePlus } from "../composants/Icones";
import { useNoyau } from "../composants/Noyau";
import { chargerMoiMemorise, useClubMemorise } from "../composants/ClubCourant";
import ChampDate from "../composants/soiree/ChampDate";
import { useGarderBrouillon } from "../composants/soiree/useGarderBrouillon";
import { avecDelai } from "../composants/soiree/logique";
import { jeton, jetonsDuClub, JETONS_NEUTRES, type Jetons } from "../lib/couleurs";
import { nomsChasubles } from "../lib/noyau/color";
import { balanceTeams, type BalanceInput } from "../lib/noyau/balance";
import { joursEntre } from "../lib/datesRelatives";
import { avertissement, choix as retourChoix, succes } from "../lib/haptique";
import { messageErreur } from "../lib/erreurs";
import {
  chargerAdversaires,
  chargerEffectif,
  chargerSoiree,
  chargerSoirees,
  creerAdversaire,
  SessionExpiree,
  type Adversaire,
  type ClubDeMoi,
  type FicheSoiree,
} from "../lib/api";

/// « Nouveau match » — l'écran du site (matches/new), au pixel.
///
/// Même déroulé, mêmes cartes : entre nous ou contre un adversaire, quand,
/// la ligne de score avec les deux chasubles, la liste où un tap fait
/// tourner un joueur aucun → A → B, l'équilibrage, l'invité, le coup d'envoi.
///
/// **La compo préparée d'abord.** Le club décide ses équipes trois à quatre
/// jours avant, sur la soirée. Quand elle existe — soirée passée en
/// paramètre, ou soirée du jour —, ce sont ELLES qui arrivent, gardiens
/// compris. À défaut, les présents de la soirée ; à défaut encore, les
/// abonnés, présumés là.
///
/// **Le téléphone d'abord, le réseau ensuite.** L'effectif du miroir local
/// s'affiche tout de suite ; le serveur le rafraîchit s'il répond, borné dans
/// le temps. Au bord du terrain, l'écran restait sur « On va chercher
/// l'effectif… » tant que le réseau ne répondait pas.
///
/// Rien ne touche le réseau au coup d'envoi : `createMatch` écrit sur
/// l'appareil et enfile l'opération.

type Choix = "aucun" | "A" | "B";
type Mode = "INTERNAL" | "EXTERNAL";

type Fiche = BalanceInput & {
  photo: string | null;
  isGuest: boolean;
  abonne: boolean;
};

export default function Compo() {
  // `quand` et `soireeId` viennent de l'appelant. « Lancer un match » depuis
  // une soirée passe la soirée SANS `quand` : on joue maintenant, avec ses
  // équipes. La saisie après coup passe `quand: "deja"` et la date.
  const { clubId, quand: quandDemande, soireeId, date: dateDemandee } =
    useLocalSearchParams<{
      clubId?: string;
      quand?: string;
      soireeId?: string;
      date?: string;
    }>();
  const { local, drain } = useNoyau();
  const memo = useClubMemorise(clubId);
  const saisieApresCoup = quandDemande === "deja";

  const [club, setClub] = useState<ClubDeMoi | null>(null);
  const [couleursLocales, setCouleursLocales] = useState<{ a: string; b: string } | null>(null);
  const [effectif, setEffectif] = useState<Fiche[]>([]);
  const [choix, setChoix] = useState<Record<string, Choix>>({});
  /// Le gardien DE LA SOIRÉE quand la compo préparée le désigne ; sinon le
  /// rôle du joueur.
  const [gardienDuSoir, setGardienDuSoir] = useState<Record<string, boolean>>({});
  const [soireeCible, setSoireeCible] = useState<string | null>(soireeId ?? null);
  const [reprise, setReprise] = useState<string | null>(null);
  const [horsLigne, setHorsLigne] = useState(false);
  const [mode, setMode] = useState<Mode>("INTERNAL");
  const [adversaires, setAdversaires] = useState<Adversaire[] | null>(null);
  const [peutCreerAdversaire, setPeutCreerAdversaire] = useState(false);
  const [adversaireId, setAdversaireId] = useState("");
  const [nouvelAdversaire, setNouvelAdversaire] = useState("");
  const [quand, setQuand] = useState<"maintenant" | "deja">(
    saisieApresCoup ? "deja" : "maintenant",
  );
  const [date, setDate] = useState(() => {
    // La date de la soirée à rattraper, si on nous l'a donnée. Jamais dans le
    // futur : une feuille datée de demain fausse le classement.
    const t = dateDemandee ? Date.parse(dateDemandee) : NaN;
    if (Number.isNaN(t)) return veille();
    const d = new Date(t);
    // Une soirée stockée à minuit : l'heure du five est plus juste.
    if (d.getHours() === 0 && d.getMinutes() === 0) d.setHours(20, 0, 0, 0);
    return new Date(Math.min(d.getTime(), Date.now()));
  });
  const [nomA, setNomA] = useState("");
  const [nomB, setNomB] = useState("");
  const [graine, setGraine] = useState(() => Math.floor(Math.random() * 1_000_000) + 1);
  const [tire, setTire] = useState(false);
  const [nomInvite, setNomInvite] = useState("");
  const [occupe, setOccupe] = useState(true);
  const [erreurChargement, setErreurChargement] = useState<unknown>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  /// La sélection a été touchée à la main : ce qui arrive du réseau ensuite
  /// ne l'écrase plus.
  const [touche, setTouche] = useState(false);
  const toucheRef = useRef(false);
  toucheRef.current = touche;
  const nomsTouches = useRef(false);

  const c = club ?? memo;
  const couleurA = c?.couleurA ?? couleursLocales?.a ?? "#ffffff";
  const couleurB = c?.couleurB ?? couleursLocales?.b ?? "#111111";
  const t: Jetons =
    c?.theme.sombre ??
    (couleursLocales ? jetonsDuClub(couleursLocales.a, couleursLocales.b, "dark") : JETONS_NEUTRES);

  const poserNoms = (a: string, b: string) => {
    if (nomsTouches.current) return;
    setNomA(a);
    setNomB(b);
  };

  /// Qui arrive déjà placé : la compo préparée, sinon les présents de la
  /// soirée, sinon les abonnés.
  const preselectionner = (fiches: Fiche[], soiree: FicheSoiree | null) => {
    if (toucheRef.current) return;
    const connus = new Set(fiches.map((f) => f.id));
    const preparee = soiree?.compo.joueurs.filter((j) => j.camp && connus.has(j.playerId)) ?? [];
    if (soiree && preparee.length > 0) {
      setChoix(Object.fromEntries(preparee.map((j) => [j.playerId, j.camp as Choix])));
      setGardienDuSoir(Object.fromEntries(preparee.map((j) => [j.playerId, j.gardienSoiree])));
      poserNoms(soiree.compo.nomA, soiree.compo.nomB);
      const a = preparee.filter((j) => j.camp === "A").length;
      setReprise(
        `Les équipes préparées pour la soirée : ${soiree.compo.nomA} ${a} · ${soiree.compo.nomB} ${preparee.length - a}.`,
      );
      return;
    }
    if (soiree) {
      const presents = soiree.presences.lignes.filter((l) => l.statut === "IN" && l.titulaire);
      setChoix(
        Object.fromEntries(
          presents.filter((l) => connus.has(l.playerId)).map((l) => [l.playerId, "A" as Choix]),
        ),
      );
      poserNoms(soiree.compo.nomA, soiree.compo.nomB);
      if (presents.length > 0) {
        setReprise(`Les ${presents.length} présents de la soirée sont sélectionnés.`);
      }
      return;
    }
    // Les abonnés sont présumés là : c'est la règle du club, et c'est ce que
    // `lib/presences.ts` fait côté serveur.
    setChoix(Object.fromEntries(fiches.filter((f) => f.abonne).map((f) => [f.id, "A" as Choix])));
  };

  const charger = useCallback(async () => {
    if (!clubId) return;
    setErreurChargement(null);
    // 1. Le miroir du téléphone : l'écran est utilisable tout de suite.
    const [cache, clubLocal] = await Promise.all([
      local.effectifDuClub(clubId).catch(() => []),
      local.getLocalClub(clubId).catch(() => undefined),
    ]);
    if (cache.length > 0) {
      setEffectif((e) =>
        e.length > 0
          ? e
          : cache.map((p) => ({
              id: p.id,
              name: p.name,
              skill: p.skill,
              isGk: p.isGk,
              photo: p.photo ?? null,
              isGuest: p.isGuest,
              abonne: false,
            })),
      );
    }
    if (clubLocal?.colorA && clubLocal.colorB) {
      setCouleursLocales({ a: clubLocal.colorA, b: clubLocal.colorB });
    }
    const noms = nomsChasubles(clubLocal?.colorA, clubLocal?.colorB);
    setNomA((n) => n || noms.a);
    setNomB((n) => n || noms.b);

    // 2. Le serveur, borné : il rafraîchit ce qu'on montre déjà.
    try {
      const [moi, serveur] = await avecDelai(
        Promise.all([chargerMoiMemorise(), chargerEffectif(clubId)]),
        8000,
      );
      setHorsLigne(false);
      const cl = moi.clubs.find((x) => x.id === clubId) ?? null;
      setClub(cl);
      if (cl) {
        if (!soireeId) poserNoms(cl.nomChasubleA, cl.nomChasubleB);
        // Le miroir local, pour que la soirée suivante s'ouvre sans réseau.
        await local.saveClubSettings({
          id: cl.id,
          slug: cl.slug,
          name: cl.nom,
          colorA: cl.couleurA,
          colorB: cl.couleurB,
          trackAssists: cl.reglages.suitPasses,
          trackCards: cl.reglages.suitCartons,
          motmMode: cl.reglages.modeHommeDuMatch,
          matchDurationMin: cl.reglages.dureeMatchMin,
        });
      }
      await local.saveRoster(clubId, serveur);
      const fiches: Fiche[] = serveur.map((p) => ({
        id: p.id,
        name: p.name,
        skill: p.skill,
        isGk: p.isGk,
        photo: p.photo,
        isGuest: p.isGuest,
        abonne: p.abonne,
      }));
      // Les invités créés ici, hors ligne, ne sont pas encore au serveur :
      // on les garde.
      setEffectif((e) => [
        ...fiches,
        ...e.filter((x) => x.isGuest && !fiches.some((f) => f.id === x.id)),
      ]);

      // La soirée : celle qu'on nous donne, sinon celle du jour — le serveur
      // y range le match de toute façon, et sa compo préparée doit suivre.
      let sid = soireeId ?? null;
      if (!sid && !saisieApresCoup) {
        const liste = await avecDelai(chargerSoirees(clubId), 5000).catch(() => null);
        sid =
          liste?.prochaines
            .flatMap((g) => g.soirees)
            .find((so) => !so.annulee && joursEntre(so.date) === 0)?.id ?? null;
      }
      const soiree = sid
        ? await avecDelai(chargerSoiree(clubId, sid), 6000).catch(() => null)
        : null;
      if (sid) setSoireeCible(sid);
      preselectionner(fiches, soiree);
    } catch (e) {
      if (e instanceof SessionExpiree) return router.replace("/connexion");
      // Hors réseau : on garde le miroir. Il ne porte ni les abonnements ni
      // la compo préparée — personne n'est présélectionné, et on le dit.
      if (cache.length === 0) setErreurChargement(e);
      else setHorsLigne(true);
    } finally {
      setOccupe(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId, local, soireeId, saisieApresCoup]);

  useEffect(() => {
    void charger();
  }, [charger]);

  // Les adversaires se chargent quand on en a besoin, pas avant.
  useEffect(() => {
    if (mode !== "EXTERNAL" || adversaires || !clubId) return;
    chargerAdversaires(clubId)
      .then((r) => {
        setAdversaires(r.adversaires);
        setPeutCreerAdversaire(r.peutCreer);
        setAdversaireId((id) => id || r.adversaires[0]?.id || "");
      })
      .catch((e) => setErreur(`Les adversaires ne se chargent pas. ${messageErreur(e)}`));
  }, [mode, adversaires, clubId]);

  const externe = mode === "EXTERNAL";
  const gardien = (f: Fiche) => (f.id in gardienDuSoir ? gardienDuSoir[f.id] : f.isGk);
  const listeTriee = useMemo(
    () =>
      [...effectif].sort(
        (a, b) => Number(a.isGuest) - Number(b.isGuest) || a.name.localeCompare(b.name),
      ),
    [effectif],
  );
  const retenus = listeTriee.filter((f) => (choix[f.id] ?? "aucun") !== "aucun");
  // Contre un adversaire, une seule équipe : la nôtre. Un joueur resté en B
  // d'un premier essai « entre nous » joue quand même.
  const equipeA = externe ? retenus : retenus.filter((f) => choix[f.id] === "A");
  const equipeB = externe ? [] : retenus.filter((f) => choix[f.id] === "B");
  const force = (eq: Fiche[]) => eq.reduce((s, f) => s + f.skill, 0);

  const laisserPartir = useGarderBrouillon({
    modifie: touche && retenus.length > 0 && !envoi,
    titre: "Quitter la compo ?",
    message: "Les équipes que tu as faites ici seront perdues.",
  });

  const toucher = () => {
    setTouche(true);
    setErreur(null);
  };

  /// Stable, et c'est la condition du reste : c'est la prop `onTourner` des
  /// vingt rangées mémoïsées. Refaite à chaque rendu, elle les réveillerait
  /// toutes à chaque tap, et le `memo` n'aurait servi à rien.
  ///
  /// `setChoix` prend la forme fonctionnelle et `setTouche`/`setErreur` sont
  /// des poseurs d'état — stables eux aussi : il ne reste que `externe` en
  /// dépendance.
  const tourner = useCallback(
    (id: string) => {
      setTouche(true);
      setErreur(null);
      retourChoix();
      setChoix((c) => {
        const actuel = c[id] ?? "aucun";
        const suivant: Choix = externe
          ? actuel === "aucun"
            ? "A"
            : "aucun"
          : actuel === "aucun"
            ? "A"
            : actuel === "A"
              ? "B"
              : "aucun";
        return { ...c, [id]: suivant };
      });
    },
    [externe],
  );

  function tousOuAucun() {
    toucher();
    retourChoix();
    const toutLeMonde = retenus.length === effectif.length;
    setChoix(toutLeMonde ? {} : Object.fromEntries(effectif.map((f) => [f.id, "A" as Choix])));
    setTire(false);
  }

  function equilibrer() {
    if (retenus.length < 2) return;
    toucher();
    retourChoix();
    const r = balanceTeams(
      retenus.map((f) => ({ id: f.id, name: f.name, skill: f.skill, isGk: gardien(f) })),
      { seed: graine },
    );
    setChoix((c) => {
      const neuf = { ...c };
      for (const p of r.teamA) neuf[p.id] = "A";
      for (const p of r.teamB) neuf[p.id] = "B";
      return neuf;
    });
    setGraine((g) => g + 1);
    setTire(true);
  }

  async function ajouterInvite() {
    const nom = nomInvite.trim();
    if (!nom || !clubId) return;
    try {
      const id = await local.addLocalGuest(clubId, nom);
      toucher();
      retourChoix();
      setEffectif((e) => [
        ...e,
        { id, name: nom, skill: 3, isGk: false, photo: null, isGuest: true, abonne: false },
      ]);
      setChoix((c) => ({ ...c, [id]: "A" }));
      setNomInvite("");
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  async function ajouterAdversaire() {
    const nom = nouvelAdversaire.trim();
    if (!nom || !clubId) return;
    try {
      const r = await creerAdversaire(clubId, nom);
      retourChoix();
      setAdversaires((l) => [
        ...(l ?? []).filter((a) => a.id !== r.adversaire.id),
        r.adversaire,
      ]);
      setAdversaireId(r.adversaire.id);
      setNouvelAdversaire("");
    } catch (e) {
      avertissement();
      setErreur(messageErreur(e));
    }
  }

  async function coupDEnvoi() {
    if (!clubId || envoi) return;
    if (equipeA.length === 0) return setErreur("Sélectionne au moins un joueur.");
    if (!externe && equipeB.length === 0) {
      return setErreur("Il faut au moins un joueur dans chaque équipe.");
    }
    if (externe && !adversaireId) return setErreur("Choisis l'équipe adverse.");
    if (quand === "deja" && date.getTime() > Date.now()) {
      return setErreur("Cette date est dans le futur — programme la soirée plutôt.");
    }
    setEnvoi(true);
    setErreur(null);
    try {
      const adversaire = adversaires?.find((a) => a.id === adversaireId);
      const matchId = await local.createMatch({
        clubId,
        kind: mode,
        opponentId: externe ? adversaireId : null,
        teamAName: externe ? "Nous" : nomA.trim() || "A",
        teamBName: externe ? (adversaire?.nom ?? "Adversaire") : nomB.trim() || "B",
        teamA: equipeA.map((p) => ({ playerId: p.id, isGk: gardien(p) })),
        teamB: equipeB.map((p) => ({ playerId: p.id, isGk: gardien(p) })),
        playedAt: quand === "deja" ? date.toISOString() : null,
        // Rattacher le match à sa soirée : sans ça, il n'apparaît sur aucun
        // lundi et laisse le bilan de la soirée vide.
        matchDayId: soireeCible,
      });
      succes();
      // Le match existe déjà sur l'appareil : on part à la feuille sans
      // attendre le serveur. La file s'en charge.
      void drain.relancer();
      laisserPartir();
      router.replace({ pathname: "/match/[id]", params: { id: matchId } });
    } catch (e) {
      avertissement();
      setErreur(messageErreur(e));
      setEnvoi(false);
    }
  }

  const pret = externe
    ? equipeA.length > 0 && Boolean(adversaireId)
    : equipeA.length > 0 && equipeB.length > 0;

  /// Ce qui manque pour partir, en une ligne, SOUS LES YEUX du bouton éteint.
  /// Un bouton à moitié effacé sans un mot, c'est une impasse : on le tape,
  /// il ne répond pas, et on remonte la page au hasard.
  const manque = externe
    ? equipeA.length === 0
      ? "Tape les joueurs qui viennent"
      : "Choisis l'équipe adverse"
    : equipeA.length === 0 && equipeB.length === 0
      ? `Tape un joueur : une fois pour ${nomA || "A"}, deux pour ${nomB || "B"}`
      : equipeB.length === 0
        ? `Personne en ${nomB || "B"}`
        : `Personne en ${nomA || "A"}`;

  return (
    <Ecran t={t} chasubles={c || couleursLocales ? { a: couleurA, b: couleurB } : undefined}>
      <ScrollView contentContainerStyle={s.defile} keyboardShouldPersistTaps="handled">
        <EnTeteClub t={t} club={c} clubId={clubId} />
        <TitreEcran t={t} titre={saisieApresCoup ? "Saisir un match joué" : "Nouveau match"} />

        <View style={s.contenu}>
          <Segment
            t={t}
            variante="compact"
            valeur={mode}
            onChange={(m) => {
              if (m !== mode) retourChoix();
              setMode(m);
              setErreur(null);
            }}
            choix={[
              { valeur: "INTERNAL", libelle: "Entre nous" },
              { valeur: "EXTERNAL", libelle: "Vs adversaire" },
            ]}
          />

          {horsLigne && (
            <Text style={[s.avis, { color: jeton(t, "or") }]}>
              Hors ligne : voici l&apos;effectif gardé sur le téléphone. Personne n&apos;est
              présélectionné.
            </Text>
          )}
          {reprise && !horsLigne && (
            <Text style={[s.avis, { color: jeton(t, "i2") }]}>{reprise}</Text>
          )}

          {erreurChargement != null && (
            <ErreurChargement t={t} erreur={erreurChargement} onReessayer={charger} />
          )}

          {occupe && effectif.length === 0 && erreurChargement == null && (
            <SqueletteVestiaire t={t} />
          )}

          {effectif.length > 0 && (
            <>
              <CarteVerre t={t} style={s.carte}>
                <Text style={[s.carteTitre, { color: t.ink }]}>Quand ?</Text>
                <Text style={[s.aide, { color: jeton(t, "i2") }]}>
                  {quand === "maintenant"
                    ? "La feuille s'ouvre en direct, chrono lancé."
                    : "Feuille sans chrono : tu tapes les buts, tu enregistres."}
                </Text>
                <Segment
                  t={t}
                  valeur={quand}
                  onChange={(q) => {
                    if (q !== quand) retourChoix();
                    setQuand(q);
                  }}
                  choix={[
                    { valeur: "maintenant", libelle: "Maintenant" },
                    { valeur: "deja", libelle: "Déjà joué" },
                  ]}
                  style={{ marginTop: 12 }}
                />
                {quand === "deja" && (
                  <View style={{ marginTop: 10 }}>
                    <ChampDate
                      t={t}
                      valeur={date}
                      maximum={new Date()}
                      etiquette="Date et heure du match"
                      onChange={setDate}
                    />
                  </View>
                )}
              </CarteVerre>

              {externe ? (
                <CarteVerre t={t} style={s.carte}>
                  <Text style={[s.kicker, { color: jeton(t, "i2") }]}>Adversaire</Text>
                  {adversaires == null ? (
                    <Text style={[s.aide, { color: jeton(t, "i2"), marginTop: 8 }]}>
                      On va chercher les adversaires du club…
                    </Text>
                  ) : adversaires.length === 0 ? (
                    <Text style={[s.aide, { color: jeton(t, "i2"), marginTop: 8 }]}>
                      Aucun adversaire enregistré. Ajoute le premier ci-dessous.
                    </Text>
                  ) : (
                    <View style={s.puces}>
                      {adversaires.map((a) => {
                        const actif = a.id === adversaireId;
                        return (
                          <Pressable
                            key={a.id}
                            onPress={() => {
                              retourChoix();
                              setAdversaireId(a.id);
                            }}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: actif }}
                            style={({ pressed }) => [
                              s.puce,
                              actif
                                ? { backgroundColor: jeton(t, "bt") }
                                : {
                                    backgroundColor: jeton(t, "gl"),
                                    borderWidth: 1,
                                    borderColor: jeton(t, "gb"),
                                  },
                              pressed && { opacity: 0.8 },
                            ]}
                          >
                            <Text
                              style={[s.puceTexte, { color: actif ? jeton(t, "bf") : t.ink }]}
                              numberOfLines={1}
                            >
                              {a.nom}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                  {peutCreerAdversaire && (
                    <View style={s.ligneAjout}>
                      <Saisie
                        t={t}
                        value={nouvelAdversaire}
                        onChangeText={setNouvelAdversaire}
                        placeholder="Nouvelle équipe adverse…"
                        autoCapitalize="words"
                        returnKeyType="done"
                        onSubmitEditing={() => void ajouterAdversaire()}
                        accessibilityLabel="Nom de la nouvelle équipe adverse"
                        style={{ flex: 1, minWidth: 0 }}
                      />
                      <BoutonVerre
                        t={t}
                        titre="Ajouter"
                        icone={<IconePlus couleur={t.ink} taille={14} />}
                        onPress={() => void ajouterAdversaire()}
                        disabled={!nouvelAdversaire.trim()}
                      />
                    </View>
                  )}
                </CarteVerre>
              ) : (
                <CarteVerre t={t} style={s.carteScore}>
                  {/* La ligne de score du site : les deux chasubles, les
                      effectifs face à face. C'est là qu'on voit d'un coup si
                      les équipes sont équilibrées. */}
                  <LigneScore
                    t={t}
                    nomA={nomA || "A"}
                    nomB={nomB || "B"}
                    couleurA={couleurA}
                    couleurB={couleurB}
                    scoreA={equipeA.length}
                    scoreB={equipeB.length}
                    etat="Effectif"
                    heure="par équipe"
                  />
                  <View style={s.noms}>
                    <Saisie
                      t={t}
                      value={nomA}
                      onChangeText={(v) => {
                        nomsTouches.current = true;
                        setNomA(v);
                      }}
                      maxLength={40}
                      accessibilityLabel="Nom de la première équipe"
                      style={{ flex: 1, minWidth: 0 }}
                    />
                    <Saisie
                      t={t}
                      value={nomB}
                      onChangeText={(v) => {
                        nomsTouches.current = true;
                        setNomB(v);
                      }}
                      maxLength={40}
                      accessibilityLabel="Nom de la seconde équipe"
                      style={{ flex: 1, minWidth: 0 }}
                    />
                  </View>
                </CarteVerre>
              )}

              <CarteVerre t={t} style={s.carteListe}>
                <View style={s.enteteListe}>
                  <Text style={[s.enteteTexte, { color: t.ink }]}>
                    {externe ? "Qui joue ? — tape pour sélectionner" : "Qui joue ? — tape : aucun → A → B"}
                  </Text>
                  <Text style={[s.compteur, { color: jeton(t, "i2") }]}>{retenus.length}</Text>
                </View>
                <Pressable
                  onPress={tousOuAucun}
                  accessibilityRole="button"
                  style={({ pressed }) => [s.tous, pressed && { opacity: 0.6 }]}
                >
                  <Text style={[s.tousTexte, { color: jeton(t, "i2") }]}>
                    {retenus.length === effectif.length
                      ? "Personne"
                      : externe
                        ? "Tout le monde"
                        : `Tout le monde en ${nomA || "A"}`}
                  </Text>
                </Pressable>
                {/* La rangée vit dans composants/compo/Rangee.tsx, mémoïsée.
                    Écrite ici, en ligne, elle se refaisait vingt fois à
                    chaque tap et à chaque frappe. Compté au banc (20 joueurs,
                    20 taps) : 400 rangées re-rendues, 20 maintenant — une
                    seule par tap. Et taper le nom d'un invité, qui ne
                    concerne aucune rangée : 140 re-rendues, 0 maintenant.
                    On ne lui passe que des valeurs simples — dont `valeur`,
                    déjà calculée : taper le nom de l'équipe ne réveille ainsi
                    que les rangées qui l'affichent, pas les vingt. */}
                {listeTriee.map((f, i) => {
                  const cc = choix[f.id] ?? "aucun";
                  const pris = cc !== "aucun";
                  return (
                    <RangeeCompo
                      key={f.id}
                      t={t}
                      id={f.id}
                      nom={f.name}
                      photo={f.photo}
                      note={f.skill}
                      invite={f.isGuest}
                      gardien={gardien(f)}
                      // Contre un adversaire extérieur, il n'y a qu'une
                      // équipe : un joueur resté en « B » d'un premier essai
                      // « entre nous » joue quand même, et du bon côté.
                      choix={externe ? (pris ? "A" : "aucun") : cc}
                      valeur={!pris ? "—" : externe ? "Joue" : cc === "A" ? nomA : nomB}
                      separateur={i > 0}
                      onTourner={tourner}
                    />
                  );
                })}
              </CarteVerre>

              {!externe && retenus.length >= 2 && (
                <CarteVerre t={t} style={s.carte}>
                  <Text style={[s.carteTitre, { color: t.ink }]}>Équipes équilibrées</Text>
                  <Text style={[s.aide, { color: jeton(t, "i2") }]}>
                    Répartit les {retenus.length} sélectionnés selon leur note, gardiens séparés.
                  </Text>
                  <BoutonVerre
                    t={t}
                    titre={tire ? "Autre tirage" : "Équilibrer"}
                    onPress={equilibrer}
                    style={{ alignSelf: "flex-start", marginTop: 12 }}
                  />
                  {equipeA.length > 0 && equipeB.length > 0 && (
                    <Text style={[s.force, { color: jeton(t, "i2") }]}>
                      <Text style={{ color: t.taInk ?? t.ink }}>
                        {nomA} {force(equipeA)}
                      </Text>
                      {"   vs   "}
                      <Text style={{ color: t.tbInk ?? t.ink }}>
                        {nomB} {force(equipeB)}
                      </Text>
                      {`   · écart ${Math.abs(force(equipeA) - force(equipeB))}`}
                    </Text>
                  )}
                </CarteVerre>
              )}

              <CarteVerre t={t} style={s.carte}>
                <Text style={[s.kicker, { color: jeton(t, "i2"), marginBottom: 8 }]}>
                  Ajouter un invité
                </Text>
                <View style={s.ligneAjout}>
                  <Saisie
                    t={t}
                    value={nomInvite}
                    onChangeText={setNomInvite}
                    placeholder="Nom de l'invité"
                    autoCapitalize="words"
                    returnKeyType="done"
                    onSubmitEditing={() => void ajouterInvite()}
                    accessibilityLabel="Nom de l'invité"
                    style={{ flex: 1, minWidth: 0 }}
                  />
                  <BoutonVerre
                    t={t}
                    titre="Invité"
                    etiquette="Ajouter l'invité"
                    icone={<IconePlus couleur={t.ink} taille={14} />}
                    onPress={() => void ajouterInvite()}
                    disabled={!nomInvite.trim()}
                  />
                </View>
              </CarteVerre>

              {/* La place que la barre du bas occupe : sans elle, la dernière
                  rangée de joueur se cache derrière. */}
              <View style={{ height: 8 }} />
            </>
          )}
        </View>
      </ScrollView>

      {/* Le coup d'envoi, posé sur l'écran et non au bout de la page.
          Avec vingt joueurs au vestiaire, cette page mesure environ 2 200
          points pour une fenêtre de 760 : le bouton était à 1 450 points sous
          le pli — deux écrans de défilement, au pouce, debout, pour lancer le
          match qui commence. Il ne bouge plus, et il dit ce qui manque quand
          il ne peut pas partir. */}
      {effectif.length > 0 && (
        <BarreCoupDEnvoi
          t={t}
          etat={
            erreur
              ? { texte: erreur, ton: "erreur" }
              : pret
                ? {
                    texte: externe
                      ? `${equipeA.length} joueur${equipeA.length > 1 ? "s" : ""}`
                      : `${nomA} ${equipeA.length} · ${equipeB.length} ${nomB}`,
                    ton: "ok",
                  }
                : { texte: manque, ton: "attente" }
          }
          titre={envoi ? "Création…" : quand === "deja" ? "Ouvrir la feuille" : "Coup d'envoi"}
          occupe={envoi}
          pret={pret}
          onPress={() => void coupDEnvoi()}
        />
      )}
    </Ecran>
  );
}

/// La barre d'action du bas de la compo : ce qu'on a sous les yeux (les
/// effectifs, ou ce qui manque) et le bouton qui lance.
///
/// Même matière que la barre d'onglets (verre sombre, rayon large, ombre
/// portée) : c'est le même objet flottant, à un autre étage de l'app. Pas de
/// `expo-blur` — l'app se livre par mise à jour à chaud, aucun module natif
/// nouveau.
function BarreCoupDEnvoi({
  t,
  etat,
  titre,
  occupe,
  pret,
  onPress,
}: {
  t: Jetons;
  etat: { texte: string; ton: "ok" | "attente" | "erreur" };
  titre: string;
  occupe: boolean;
  pret: boolean;
  onPress: () => void;
}) {
  const couleur =
    etat.ton === "erreur" ? jeton(t, "bad") : etat.ton === "ok" ? t.ink : jeton(t, "i2");
  // Pas de marge de sécurité ici : `Ecran` enveloppe déjà ses enfants dans
  // une `SafeAreaView`, le bas de cette barre EST le haut de la barre
  // d'accueil de l'appareil. L'ajouter une seconde fois laissait un vide.
  return (
    <View style={s.barreBas} pointerEvents="box-none">
      <View
        style={[
          s.barreVerre,
          { backgroundColor: t.mn ?? "rgba(24,24,28,0.92)", borderColor: jeton(t, "cb") },
        ]}
      >
        <Text
          style={[s.barreEtat, { color: couleur }]}
          numberOfLines={2}
          accessibilityLiveRegion="polite"
        >
          {etat.texte}
        </Text>
        <BoutonPlein
          t={t}
          grand
          titre={titre}
          occupe={occupe}
          onPress={onPress}
          disabled={!pret}
          style={s.barreBouton}
        />
      </View>
    </View>
  );
}

/// Hier 20 h — l'heure du five, et le défaut du site pour une feuille saisie
/// après coup.
function veille(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(20, 0, 0, 0);
  return d;
}

/// L'attente du vestiaire, à la forme de la page qui arrive : la carte
/// « Quand ? », la ligne de score des deux équipes, puis les rangées de
/// joueurs qu'on va taper.
///
/// Mesuré le 22 septembre 2026 sur le serveur de développement (machine
/// chargée) : médiane 751 ms pour `/roster`, et c'est le premier appel de la
/// page, jamais servi par le cache local au tout premier lancement. Un pavé
/// gris de 420 points ne disait pas combien de joueurs allaient tomber, ni
/// où : à l'arrivée, la page changeait de hauteur sous le pouce.
function SqueletteVestiaire({ t }: { t: Jetons }) {
  return (
    <Squelette etiquette="On ouvre le vestiaire" style={sq.cadre}>
      <CarteVerre t={t} style={sq.carte}>
        <Bloc t={t} l="32%" h={17} />
        <Bloc t={t} l="72%" h={13} />
        <Bloc t={t} l="100%" h={44} r={14} style={sq.pleine} />
      </CarteVerre>

      <CarteVerre t={t} style={sq.carteScore}>
        <View style={sq.score}>
          <Bloc t={t} l={54} h={54} r={16} />
          <Bloc t={t} l={72} h={30} r={10} />
          <Bloc t={t} l={54} h={54} r={16} />
        </View>
      </CarteVerre>

      <CarteVerre t={t} style={sq.carte}>
        <View style={sq.entete}>
          <Bloc t={t} l="66%" h={15} />
          <Bloc t={t} l={22} h={15} />
        </View>
        {/* Huit rangées : l'effectif d'un lundi tient entre huit et vingt, et
            huit remplissent déjà l'écran. */}
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <View key={i} style={sq.rangee}>
            <Bloc t={t} l={34} h={34} r={17} />
            <Bloc t={t} l={["56%", "42%", "64%", "48%", "60%", "44%", "52%", "58%"][i] as `${number}%`} h={15} />
            <View style={sq.pousse} />
            <Bloc t={t} l={38} h={15} />
          </View>
        ))}
      </CarteVerre>
    </Squelette>
  );
}

const sq = StyleSheet.create({
  cadre: { gap: 16 },
  carte: { paddingVertical: 16, paddingHorizontal: 18, gap: 10 },
  carteScore: { paddingVertical: 16, paddingHorizontal: 18 },
  pleine: { alignSelf: "stretch", marginTop: 4 },
  score: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 20 },
  entete: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  rangee: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 },
  pousse: { flex: 1 },
});

const s = StyleSheet.create({
  // La barre d'action flotte au-dessus : 6 + 56 + 6 de barre, 10 de marge,
  // plus 14 pour que la dernière rangée ne la frôle pas.
  defile: { paddingBottom: 92 },
  contenu: { paddingHorizontal: 14, paddingTop: 16, gap: 16 },
  avis: { fontSize: 13, lineHeight: 18, paddingHorizontal: 4 },
  carte: { paddingVertical: 16, paddingHorizontal: 18 },
  carteScore: { paddingTop: 6, paddingBottom: 14 },
  carteListe: { paddingHorizontal: 18, paddingBottom: 6 },
  carteTitre: { fontSize: 17, fontWeight: "600" },
  kicker: { fontSize: 15, fontWeight: "600", letterSpacing: -0.1 },
  aide: { fontSize: 13, lineHeight: 18, marginTop: 2 },

  puces: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  puce: {
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    maxWidth: "100%",
  },
  puceTexte: { fontSize: 17, fontWeight: "600" },
  ligneAjout: { flexDirection: "row", gap: 8, alignItems: "center", marginTop: 12 },

  noms: { flexDirection: "row", gap: 10, paddingHorizontal: 14 },

  enteteListe: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 10,
    paddingTop: 16,
  },
  enteteTexte: { flex: 1, fontSize: 15, fontWeight: "600" },
  compteur: { fontSize: 15, fontVariant: ["tabular-nums"] },
  // 44 : la cible tactile minimale, comme partout ailleurs dans l'app. À 36,
  // collée sous l'en-tête et juste au-dessus de la première rangée de joueur,
  // un pouce qui vise « Tout le monde » debout au bord du terrain tombait une
  // fois sur deux sur la rangée — et faisait changer ce joueur d'équipe.
  tous: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
  tousTexte: { fontSize: 15, fontWeight: "600" },
  // Les styles de la rangée de joueur sont partis avec elle, dans
  // composants/compo/Rangee.tsx.

  force: { fontSize: 12, marginTop: 12, fontVariant: ["tabular-nums"] },
  // La barre d'action, sur le modèle de la barre d'onglets : posée sur le
  // contenu, pas collée au bord.
  barreBas: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  barreVerre: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 30,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: 18,
    paddingRight: 6,
    paddingVertical: 6,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.45,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
      },
      android: { elevation: 12 },
      default: {},
    }),
  },
  barreEtat: { flex: 1, minWidth: 0, fontSize: 14, lineHeight: 18, fontVariant: ["tabular-nums"] },
  // Le bouton ne s'étire pas sur toute la barre : le compte des deux équipes
  // doit rester lisible à côté, c'est lui qu'on relit avant de lancer.
  barreBouton: { paddingHorizontal: 22 },
});
