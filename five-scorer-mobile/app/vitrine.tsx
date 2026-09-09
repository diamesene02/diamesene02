import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import Ecran from "../composants/Ecran";
import { Avatar, BoutonPlein, BoutonVerre, Carte, Ecusson } from "../composants/base";
import { JETONS_NEUTRES, type Jetons } from "../lib/couleurs";
import { chargerVitrine, type Vitrine } from "../lib/api";

/// La vitrine publique : ce qu'on voit sans compte.
///
/// Elle existe pour une raison précise — une app qu'on ouvre dans Expo Go
/// doit montrer quelque chose de vrai avant qu'on ait porté la connexion.
/// Elle garde son utilité maintenant que la connexion existe : c'est ce
/// qu'on montre à quelqu'un qui n'est pas du club.
export default function VitrineEcran() {
  const [vitrine, setVitrine] = useState<Vitrine | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(true);

  const charger = useCallback(async () => {
    setErreur(null);
    setOccupe(true);
    try {
      setVitrine(await chargerVitrine());
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setOccupe(false);
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  const t: Jetons = vitrine?.club.theme.sombre ?? JETONS_NEUTRES;

  return (
    <Ecran
      t={t}
      chasubles={
        vitrine ? { a: vitrine.club.couleurA, b: vitrine.club.couleurB } : undefined
      }
    >
      <ScrollView
        contentContainerStyle={s.contenu}
        refreshControl={
          <RefreshControl refreshing={occupe && vitrine != null} onRefresh={charger} tintColor={t.i2} />
        }
      >
        {occupe && !vitrine && !erreur && (
          <View style={s.centre}>
            <ActivityIndicator color={t.ink} />
            <Text style={[s.aide, { color: t.i2 }]}>On va chercher le club…</Text>
          </View>
        )}

        {erreur && (
          <Carte t={t} titre="Ça n'a pas marché">
            <Text style={[s.aide, { color: t.i2 }]}>{erreur}</Text>
            <View style={{ height: 12 }} />
            <BoutonVerre t={t} titre="Réessayer" onPress={charger} />
            {/* Sans ça, l'écran est un cul-de-sac : la vitrine échoue — club
                passé en privé, réseau coupé, mauvais slug — et il n'existe
                plus aucun chemin vers son propre compte. Or celui qui a un
                compte n'a pas besoin de la vitrine. */}
            <View style={{ height: 10 }} />
            <BoutonPlein t={t} titre="Se connecter" onPress={() => router.push("/connexion")} />
          </Carte>
        )}

        {vitrine && (
          <>
            <View style={s.entete}>
              <Ecusson couleur={vitrine.club.couleurA} lettre={vitrine.club.nom[0] ?? "F"} />
              <Text style={[s.nomClub, { color: t.ink }]}>{vitrine.club.nom}</Text>
              {vitrine.saison && (
                <Text style={[s.aide, { color: t.i2 }]}>{vitrine.saison.nom}</Text>
              )}
            </View>

            {vitrine.derniersMatchs.length > 0 && (
              <Carte t={t} titre="Derniers résultats">
                {vitrine.derniersMatchs.map((m, i) => (
                  <View
                    key={m.id}
                    style={[
                      s.ligneMatch,
                      i > 0 && {
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderTopColor: t.sep,
                      },
                    ]}
                  >
                    <Text style={[s.date, { color: t.i2 }]}>{m.quandCourt}</Text>
                    <Text style={[s.score, { color: t.ink }]} numberOfLines={1}>
                      <Text style={m.scoreA > m.scoreB ? s.gagnant : undefined}>
                        {m.nomA} {m.scoreA}
                      </Text>
                      <Text style={{ color: t.i2 }}> – </Text>
                      <Text style={m.scoreB > m.scoreA ? s.gagnant : undefined}>
                        {m.scoreB} {m.nomB}
                      </Text>
                    </Text>
                    {m.hommeDuMatch && (
                      <Text style={[s.mvp, { color: t.or }]} numberOfLines={1}>
                        ★ {m.hommeDuMatch}
                      </Text>
                    )}
                  </View>
                ))}
              </Carte>
            )}

            <Carte t={t} titre="Tableau">
              <View style={s.tete}>
                <View style={s.rang} />
                <Text style={[s.joueurTete, { color: t.i3 }]}>Joueur</Text>
                <Text style={[s.chiffre, { color: t.i3 }]}>MJ</Text>
                <Text style={[s.chiffre, { color: t.i3 }]}>B</Text>
                <Text style={[s.chiffre, { color: t.i3 }]}>PTS</Text>
              </View>
              {vitrine.classement.map((r, i) => (
                <View
                  key={r.playerId}
                  style={[
                    s.ligne,
                    { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.sep },
                  ]}
                >
                  <Text style={[s.rang, { color: t.i2 }]}>{i + 1}</Text>
                  <View style={s.joueur}>
                    <Avatar nom={r.nom} photo={r.photo} t={t} anneau={t.taR ?? t.ta} />
                    <Text style={[s.nom, { color: t.ink }]} numberOfLines={1}>
                      {r.nom}
                    </Text>
                  </View>
                  <Text style={[s.chiffre, { color: t.i2 }]}>{r.matchs}</Text>
                  <Text style={[s.chiffre, { color: t.i2 }]}>{r.buts}</Text>
                  <Text style={[s.chiffre, s.points, { color: t.ink }]}>
                    {r.victoires * 3 + r.nuls}
                  </Text>
                </View>
              ))}
            </Carte>

            <BoutonPlein t={t} titre="Se connecter" onPress={() => router.push("/connexion")} />
            <BoutonVerre
              t={t}
              titre="Créer un compte"
              onPress={() => router.push({ pathname: "/connexion", params: { mode: "inscription" } })}
            />
          </>
        )}
      </ScrollView>
    </Ecran>
  );
}

const s = StyleSheet.create({
  contenu: { padding: 14, paddingBottom: 40, gap: 14 },
  centre: { paddingTop: 120, alignItems: "center", gap: 12 },
  entete: { alignItems: "center", paddingTop: 10, paddingBottom: 4, gap: 8 },
  nomClub: { fontSize: 26, fontWeight: "700", letterSpacing: -0.4, textAlign: "center" },
  aide: { fontSize: 15, textAlign: "center" },
  ligneMatch: { paddingVertical: 10, gap: 2 },
  date: { fontSize: 13 },
  score: { fontSize: 17 },
  gagnant: { fontWeight: "700" },
  mvp: { fontSize: 13 },
  tete: { flexDirection: "row", alignItems: "center", paddingBottom: 6 },
  ligne: { flexDirection: "row", alignItems: "center", paddingVertical: 9 },
  rang: { width: 22, fontSize: 15 },
  joueurTete: { flex: 1, fontSize: 13, paddingLeft: 40 },
  joueur: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  nom: { fontSize: 17, fontWeight: "600", flexShrink: 1 },
  chiffre: { width: 34, textAlign: "right", fontSize: 15 },
  points: { fontWeight: "700" },
});
