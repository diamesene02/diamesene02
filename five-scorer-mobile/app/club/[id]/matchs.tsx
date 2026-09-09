import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect, useGlobalSearchParams } from "expo-router";
import Ecran from "../../../composants/Ecran";
import { EcussonChasuble } from "../../../composants/base";
import { JETONS_NEUTRES, type Jetons } from "../../../lib/couleurs";
import {
  chargerMatchs,
  chargerMoi,
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
  const { id } = useGlobalSearchParams<{ id: string }>();
  const [club, setClub] = useState<ClubDeMoi | null>(null);
  const [donnees, setDonnees] = useState<EcranMatchs | null>(null);
  const [saison, setSaison] = useState<string>("toutes");
  const [genre, setGenre] = useState<FiltreGenre>("tous");
  const [occupe, setOccupe] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const t: Jetons = club?.theme.sombre ?? JETONS_NEUTRES;
  const couleurA = club?.couleurA ?? "#ffffff";
  const couleurB = club?.couleurB ?? "#111111";

  const charger = useCallback(async () => {
    if (!id) return;
    setErreur(null);
    try {
      const [moi, m] = await Promise.all([chargerMoi(), chargerMatchs(id)]);
      setClub(moi.clubs.find((c) => c.id === id) ?? null);
      setDonnees(m);
      setSaison((s) => (s === "toutes" ? m.saisonParDefaut : s));
    } catch (e) {
      if (e instanceof SessionExpiree) return router.replace("/connexion");
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setOccupe(false);
    }
  }, [id]);

  useEffect(() => {
    void charger();
  }, [charger]);

  useFocusEffect(
    useCallback(() => {
      void charger();
    }, [charger]),
  );

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
    return Array.from(par.entries()).map(([cle, g]) => ({ cle, ...g }));
  }, [joues]);

  return (
    <Ecran t={t} chasubles={{ a: couleurA, b: couleurB }}>
      <ScrollView
        contentContainerStyle={s.contenu}
        refreshControl={
          <RefreshControl
            refreshing={occupe && donnees != null}
            onRefresh={charger}
            tintColor={t.i2}
          />
        }
      >
        <View style={s.entete}>
          <View style={{ flex: 1 }}>
            <Text style={[s.kicker, { color: t.i2 }]}>Historique</Text>
            <Text style={[s.titre, { color: t.ink }]}>Les matchs</Text>
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
        {erreur && <Text style={[s.erreur, { color: "#ff453a" }]}>{erreur}</Text>}

        {direct.map((m) => (
          <View key={m.id} style={s.blocDirect}>
            <View style={s.bandeTitre}>
              <View style={s.etatLigne}>
                <View style={s.point} />
                <Text style={[s.kicker, { color: t.i2 }]}>En direct</Text>
              </View>
              <Text style={[s.lienDroite, { color: t.i2 }]}>Reprendre →</Text>
            </View>
            <Pressable
              onPress={() => router.push({ pathname: "/match/[id]", params: { id: m.id } })}
              style={({ pressed }) => [s.panneau, pressed && { opacity: 0.7 }]}
            >
              <Cote couleur={couleurA} camp={m.a} t={t} />
              <Text style={[s.gros, { color: t.ink }]}>{m.scoreA}</Text>
              <View style={s.milieu}>
                <View style={s.point} />
                <Text style={s.enDirect}>En direct</Text>
              </View>
              <Text style={[s.gros, { color: t.ink }]}>{m.scoreB}</Text>
              <Cote couleur={couleurB} camp={m.b} t={t} />
            </Pressable>
          </View>
        ))}

        {programmes.length > 0 && (
          <View style={[s.carte, { borderColor: t.cb, backgroundColor: t.cdSolid }]}>
            <View style={s.carteTete}>
              <Text style={[s.kicker, { color: t.i2 }]}>Programmés</Text>
              <Text style={[s.petitCompte, { color: t.i3 }]}>{programmes.length}</Text>
            </View>
            {programmes.map((m) => (
              <View key={m.id} style={s.ticker}>
                <Text style={[s.tickerJour, { color: t.i2 }]} numberOfLines={1}>
                  {m.jour}
                </Text>
                <Text style={[s.tickerHeure, { color: t.ink }]}>{m.heure}</Text>
                <Text style={[s.tickerReste, { color: t.i2 }]} numberOfLines={1}>
                  {m.a.nom} <Text style={{ color: t.i3 }}>vs</Text> {m.b.nom}
                  {m.lieu ? ` · ${m.lieu}` : ""}
                </Text>
              </View>
            ))}
          </View>
        )}

        {groupes.map((g) => (
          <View key={g.cle} style={[s.carte, { borderColor: t.cb, backgroundColor: t.cdSolid }]}>
            <View style={s.carteTete}>
              <Text style={[s.kicker, { color: t.i2 }]} numberOfLines={1}>
                {g.titre}
                {g.sousTitre ? ` · ${g.sousTitre}` : ""}
              </Text>
              <Text style={[s.petitCompte, { color: t.i3 }]}>{g.lignes.length}</Text>
            </View>
            {g.lignes.map((m) => (
              <Pressable
                key={m.id}
                onPress={() => router.push({ pathname: "/match/[id]", params: { id: m.id } })}
                style={({ pressed }) => [s.ticker, pressed && { opacity: 0.7 }]}
              >
                <Text style={[s.tickerJour, { color: t.i2 }]}>{m.heure}</Text>
                <Text style={[s.tickerHeure, { color: t.ink }]}>
                  <Text style={m.vainqueur === "B" ? { color: t.i3 } : undefined}>{m.scoreA}</Text>
                  {" – "}
                  <Text style={m.vainqueur === "A" ? { color: t.i3 } : undefined}>{m.scoreB}</Text>
                </Text>
                <Text style={[s.tickerReste, { color: t.i2 }]} numberOfLines={1}>
                  {m.adversaire ? `vs ${m.adversaire}` : ""}
                  {m.adversaire && m.hommeDuMatch ? " · " : ""}
                  {m.hommeDuMatch ? `★ ${m.hommeDuMatch}` : ""}
                </Text>
              </Pressable>
            ))}
          </View>
        ))}

        {donnees && direct.length === 0 && programmes.length === 0 && groupes.length === 0 && (
          <Text style={[s.vide, { color: t.i2 }]}>Aucun match pour ce filtre.</Text>
        )}
      </ScrollView>
    </Ecran>
  );
}

function Cote({
  couleur,
  camp,
  t,
}: {
  couleur: string;
  camp: { nom: string; lettre: string };
  t: Jetons;
}) {
  return (
    <View style={s.cote}>
      <EcussonChasuble couleur={couleur} lettre={camp.lettre} taille={60} />
      <Text style={[s.nomCote, { color: t.i2 }]} numberOfLines={1}>
        {camp.nom}
      </Text>
    </View>
  );
}

function Pilule({
  t,
  libelle,
  actif,
  onPress,
}: {
  t: Jetons;
  libelle: string;
  actif: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        s.pilule,
        actif
          ? { backgroundColor: t.bt ?? "#ffffff", borderColor: "transparent" }
          : { backgroundColor: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.16)" },
      ]}
    >
      <Text style={[s.piluleTexte, { color: actif ? (t.bf ?? "#111111") : t.ink }]}>{libelle}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  contenu: { paddingHorizontal: 14, paddingTop: 16, paddingBottom: 40, gap: 18 },
  entete: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  kicker: { fontSize: 15, fontWeight: "600" },
  titre: { fontSize: 28, fontWeight: "700", letterSpacing: -0.4, marginTop: 4 },
  chapeau: { fontSize: 14, lineHeight: 20, marginTop: 6, maxWidth: 293 },
  compteur: { fontSize: 14, fontWeight: "700" },

  filtres: { gap: 8 },
  rangeeFiltres: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pilule: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  piluleTexte: { fontSize: 13, fontWeight: "600" },

  centre: { paddingTop: 60, alignItems: "center", gap: 12 },
  aide: { fontSize: 15 },
  erreur: { fontSize: 15, textAlign: "center" },
  vide: { fontSize: 15, textAlign: "center", paddingVertical: 40 },

  blocDirect: { gap: 10 },
  bandeTitre: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  etatLigne: { flexDirection: "row", alignItems: "center", gap: 8 },
  point: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#ff453a" },
  lienDroite: { fontSize: 13, fontWeight: "600" },
  panneau: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 4,
  },
  cote: { width: 88, alignItems: "center", gap: 8 },
  nomCote: { fontSize: 16, fontWeight: "500" },
  gros: { flex: 1, fontSize: 52, fontWeight: "800", letterSpacing: -2.6, textAlign: "center" },
  milieu: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 18 },
  enDirect: { fontSize: 17, fontWeight: "600", color: "#ff453a" },

  carte: {
    borderRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
  },
  carteTete: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 10,
  },
  petitCompte: { fontSize: 13 },
  ticker: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56 },
  tickerJour: { width: 64, fontSize: 15 },
  tickerHeure: { fontSize: 17, fontWeight: "600" },
  tickerReste: { flex: 1, fontSize: 15 },
});
