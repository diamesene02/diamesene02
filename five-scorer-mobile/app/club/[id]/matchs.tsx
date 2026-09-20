import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { chargerMoiMemorise, useClubId, useClubMemorise } from "../../../composants/ClubCourant";
import Ecran from "../../../composants/Ecran";
import EnTeteClub from "../../../composants/EnTeteClub";
import ErreurChargement from "../../../composants/ErreurChargement";
import LigneScore from "../../../composants/LigneScore";
import { useNoyau } from "../../../composants/Noyau";
import { CarteGroupe, CarteProgrammes, Pilule } from "../../../composants/match/Liste";
import { JETONS_NEUTRES, jeton, type Jetons } from "../../../lib/couleurs";
import {
  chargerMatchs,
  SessionExpiree,
  type ClubDeMoi,
  type EcranMatchs,
} from "../../../lib/api";

/// « Les matchs » — l'historique du club, repris de la page du site.
///
/// Trois étages : en direct, programmés, joués. Les joués ne forment pas une
/// liste plate — ils se rangent sous la soirée qui les a produits. Le club
/// joue six à huit matchs par lundi avec les deux mêmes chasubles ; une liste
/// plate répéterait deux cents fois « Blanc contre Noir ».
///
/// **Écart assumé au site** : les filtres ne repassent pas par le serveur.
/// Chaque ligne porte sa saison et son genre, et le tri se fait sur place. Sur
/// le web, chaque pilule tapée est un aller-retour ; au bord d'un terrain,
/// c'est une seconde et un peu de batterie pour changer un mot.

type FiltreGenre = "tous" | "INTERNAL" | "EXTERNAL";

export default function Matchs() {
  // `useLocalSearchParams` ne rend que les paramètres du segment courant :
  // depuis un enfant de `Tabs`, le `[id]` du dossier parent n'y est pas, et
  // l'écran restait bloqué sur son indicateur de chargement sans rien dire.
  const id = useClubId();
  const { local } = useNoyau();
  const memo = useClubMemorise(id);
  const [club, setClub] = useState<ClubDeMoi | null>(null);
  const [donnees, setDonnees] = useState<EcranMatchs | null>(null);
  const [saison, setSaison] = useState<string>("toutes");
  const [genre, setGenre] = useState<FiltreGenre>("tous");
  const [occupe, setOccupe] = useState(true);
  const [rafraichit, setRafraichit] = useState(false);
  const [erreur, setErreur] = useState<unknown>(null);
  // Le match en direct que CE téléphone tient. Les autres se suivent : la
  // feuille n'existe que là où elle a été lancée.
  const [feuilleIci, setFeuilleIci] = useState<string | null>(null);

  const c = club ?? memo;
  const t: Jetons = c?.theme.sombre ?? JETONS_NEUTRES;
  const couleurA = c?.couleurA ?? "#ffffff";
  const couleurB = c?.couleurB ?? "#111111";

  const charger = useCallback(async () => {
    if (!id) return;
    try {
      const [moi, m] = await Promise.all([chargerMoiMemorise(), chargerMatchs(id)]);
      setClub(moi.clubs.find((x) => x.id === id) ?? null);
      setDonnees(m);
      setErreur(null);
      setSaison((s) => (s === "toutes" ? m.saisonParDefaut : s));
    } catch (e) {
      if (e instanceof SessionExpiree) return router.replace("/connexion");
      setErreur(e);
    } finally {
      setOccupe(false);
    }
  }, [id]);

  // Au focus seulement : il tombe aussi à la première ouverture. Un
  // `useEffect` en plus faisait partir la même requête deux fois.
  useFocusEffect(
    useCallback(() => {
      void charger();
      if (!id) return;
      let vivant = true;
      void local.getLiveMatchOfClub(id).then((m) => {
        if (vivant) setFeuilleIci(m?.id ?? null);
      });
      return () => {
        vivant = false;
      };
    }, [charger, id, local]),
  );

  async function rafraichir() {
    setRafraichit(true);
    await charger();
    setRafraichit(false);
  }

  const garde = useCallback(
    (m: { saisonId: string | null; genre: "INTERNAL" | "EXTERNAL" }) =>
      (saison === "toutes" || m.saisonId === saison) &&
      (genre === "tous" || m.genre === genre),
    [saison, genre],
  );

  const direct = (donnees?.direct ?? []).filter(garde);
  const programmes = (donnees?.programmes ?? []).filter(garde);
  const joues = useMemo(() => (donnees?.joues ?? []).filter(garde), [donnees, garde]);

  // Le regroupement se fait APRÈS le filtre : un arbre construit côté serveur
  // redeviendrait faux dès la première pilule.
  //
  // Le serveur rend les matchs du plus récent au plus ancien : les soirées
  // sortent dans le bon ordre, mais DANS une soirée, le premier match joué
  // doit venir en haut — c'est ainsi qu'on raconte un lundi. On retourne donc
  // chaque groupe.
  const groupes = useMemo(() => {
    const par = new Map<
      string,
      { titre: string; sousTitre: string | null; lignes: typeof joues }
    >();
    for (const m of joues) {
      const g = par.get(m.groupe.cle);
      if (g) g.lignes.push(m);
      else
        par.set(m.groupe.cle, {
          titre: m.groupe.titreJour,
          sousTitre: m.groupe.sousTitre,
          lignes: [m],
        });
    }
    return Array.from(par.entries()).map(([cle, g]) => ({
      cle,
      ...g,
      lignes: [...g.lignes].reverse(),
    }));
  }, [joues]);

  function ouvrirDirect(matchId: string) {
    // La feuille si elle est sur ce téléphone ; sinon le récap, qui suit le
    // score au serveur. La feuille sait aussi s'y renvoyer toute seule, mais
    // passer par elle, c'est un écran d'attente de plus.
    if (feuilleIci === matchId) {
      router.push({ pathname: "/match/[id]", params: { id: matchId, clubId: id } });
    } else {
      router.push({ pathname: "/recap/[id]", params: { id: matchId, clubId: id } });
    }
  }

  const ouvrirRecap = (matchId: string) =>
    router.push({ pathname: "/recap/[id]", params: { id: matchId, clubId: id } });

  const rien = donnees && direct.length === 0 && programmes.length === 0 && groupes.length === 0;

  return (
    <Ecran t={t} chasubles={{ a: couleurA, b: couleurB }}>
      <ScrollView
        contentContainerStyle={s.contenu}
        refreshControl={
          <RefreshControl refreshing={rafraichit} onRefresh={() => void rafraichir()} tintColor={t.i2} />
        }
      >
        {/* La barre du club : il n'y a plus de barre d'onglets, c'est la
            pilule qui mène aux autres écrans. Elle porte ses marges. */}
        <EnTeteClub t={t} club={c} style={s.barre} />

        <View style={s.entete}>
          <View style={{ flex: 1 }}>
            <Text style={[s.kicker, { color: t.i2 }]}>Historique</Text>
            <Text style={[s.titre, { color: t.ink }]} accessibilityRole="header">
              Les matchs
            </Text>
            <Text style={[s.chapeau, { color: t.i2 }]}>
              Une rencontre jouée : un score, des buteurs, un chrono.{" "}
              <Text style={{ color: t.ink }}>Dans une soirée, ou toute seule.</Text>
            </Text>
          </View>
          <Text style={[s.compteur, { color: t.i2 }]}>
            {joues.length} joué{joues.length > 1 ? "s" : ""}
          </Text>
        </View>

        {donnees && (
          <View style={s.filtres}>
            <View style={s.rangeeFiltres}>
              <Pilule
                t={t}
                libelle="Toutes saisons"
                actif={saison === "toutes"}
                onPress={() => setSaison("toutes")}
              />
              {donnees.saisons.map((sa) => (
                <Pilule
                  key={sa.id}
                  t={t}
                  libelle={sa.nom + (sa.active ? " ●" : "")}
                  actif={saison === sa.id}
                  onPress={() => setSaison(sa.id)}
                />
              ))}
            </View>
            <View style={s.rangeeFiltres}>
              {(
                [
                  ["tous", "Tous"],
                  ["INTERNAL", "Entre nous"],
                  ["EXTERNAL", "Vs adversaires"],
                ] as const
              ).map(([v, l]) => (
                <Pilule key={v} t={t} libelle={l} actif={genre === v} onPress={() => setGenre(v)} />
              ))}
            </View>
          </View>
        )}

        {occupe && !donnees && (
          <View style={s.centre}>
            <ActivityIndicator color={t.ink} />
            <Text style={[s.aide, { color: t.i2 }]}>On va chercher les matchs…</Text>
          </View>
        )}
        {erreur != null && <ErreurChargement t={t} erreur={erreur} onReessayer={charger} />}

        {direct.length > 0 && (
          <View style={s.etage}>
            {direct.map((m) => {
              const ici = feuilleIci === m.id;
              return (
                <View key={m.id} style={s.blocDirect}>
                  <View style={s.bandeTitre}>
                    <View style={s.etatLigne}>
                      <View style={[s.point, { backgroundColor: jeton(t, "bad") }]} />
                      <Text style={[s.kicker, { color: t.i2 }]}>En direct</Text>
                    </View>
                    <Text style={[s.lienDroite, { color: t.i2 }]}>{ici ? "Reprendre →" : "Suivre →"}</Text>
                  </View>
                  <LigneScore
                    t={t}
                    nomA={m.a.nom}
                    nomB={m.b.nom}
                    lettreA={m.a.lettre}
                    lettreB={m.b.lettre}
                    couleurA={couleurA}
                    couleurB={couleurB}
                    scoreA={m.scoreA}
                    scoreB={m.scoreB}
                    etat="En direct"
                    direct
                    onPress={() => ouvrirDirect(m.id)}
                  />
                </View>
              );
            })}
          </View>
        )}

        {programmes.length > 0 && (
          <CarteProgrammes t={t} programmes={programmes} onOuvrir={ouvrirRecap} style={s.etage} />
        )}

        {groupes.length > 0 && (
          <Text style={[s.kicker, s.etage, { color: t.i2 }]} accessibilityRole="header">
            Joués
          </Text>
        )}
        {groupes.map((g) => (
          // Un match terminé n'est pas sur l'appareil : son récap se lit au
          // serveur. La feuille en direct, elle, lit la base locale.
          <CarteGroupe
            key={g.cle}
            t={t}
            titre={g.titre}
            sousTitre={g.sousTitre}
            lignes={g.lignes}
            onOuvrir={ouvrirRecap}
          />
        ))}

        {rien && (
          <Text style={[s.vide, { color: t.ink }]}>
            Aucun match pour ces filtres. Le terrain attend.
          </Text>
        )}
      </ScrollView>
    </Ecran>
  );
}

const s = StyleSheet.create({
  contenu: { paddingHorizontal: 14, paddingBottom: 40, gap: 18 },
  // La barre porte ses 14 de marge : on les lui rend.
  barre: { marginHorizontal: -14 },
  entete: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
    paddingTop: 4,
  },
  kicker: { fontSize: 15, fontWeight: "600" },
  titre: { fontSize: 28, fontWeight: "700", letterSpacing: -0.4, marginTop: 4 },
  chapeau: { fontSize: 14, lineHeight: 20, marginTop: 6, maxWidth: 293 },
  compteur: { fontSize: 14, fontWeight: "700" },

  // 24 sous l'en-tête (`mt-6`), 32 avant chaque étage (`mt-8`) : le gap de
  // 18 plus ce qui manque.
  filtres: { gap: 8, marginTop: 6 },
  etage: { marginTop: 14 },
  rangeeFiltres: { flexDirection: "row", flexWrap: "wrap", gap: 8 },

  centre: { paddingTop: 60, alignItems: "center", gap: 12 },
  aide: { fontSize: 15 },
  vide: { fontSize: 14, marginTop: 22 },

  blocDirect: { gap: 10 },
  bandeTitre: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  etatLigne: { flexDirection: "row", alignItems: "center", gap: 8 },
  point: { width: 8, height: 8, borderRadius: 4 },
  lienDroite: { fontSize: 13, fontWeight: "600" },
});
