import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { chargerVitrine, type Vitrine } from "./lib/api";

// Le premier écran de Five Scorer en React Native.
//
// Il ne demande pas de compte : il lit la vitrine publique du club. C'est
// volontaire — une app qu'on ouvre dans Expo Go doit montrer quelque chose de
// VRAI avant qu'on ait porté l'authentification, sinon on ne sait pas si le
// reste tient debout.
//
// Les couleurs ne sont pas écrites ici. Elles viennent des jetons calculés par
// lib/theme.ts côté serveur à partir des deux chasubles du club : le mobile
// porte donc exactement les mêmes que le web, et les suivra sans qu'on y
// touche le jour où le club change de couleurs.

export default function App() {
  const [vitrine, setVitrine] = useState<Vitrine | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargeEnCours, setChargeEnCours] = useState(true);

  const charger = useCallback(async () => {
    setErreur(null);
    setChargeEnCours(true);
    try {
      setVitrine(await chargerVitrine());
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setChargeEnCours(false);
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  const t = vitrine?.club.theme.sombre;
  // Tant que la vitrine n'est pas là, un fond neutre : afficher les couleurs
  // d'un club au hasard puis les remplacer ferait clignoter l'écran.
  const fond = t?.bgSolid ?? "#0b0b0e";
  const encre = t?.ink ?? "#fff";
  const encre2 = t?.i2 ?? "rgba(255,255,255,0.62)";
  const encre3 = t?.i3 ?? "rgba(255,255,255,0.4)";

  return (
    <View style={[styles.racine, { backgroundColor: fond }]}>
      <StatusBar style="light" />
      {vitrine && (
        <LinearGradient
          colors={[
            melange(vitrine.club.couleurA, "#000000", 0.72),
            melange(vitrine.club.couleurA, "#000000", 0.85),
            melange(vitrine.club.couleurB, "#000000", 0.9),
            melange(vitrine.club.couleurB, "#000000", 0.95),
          ]}
          locations={[0, 0.38, 0.74, 1]}
          style={StyleSheet.absoluteFill}
        />
      )}

      <SafeAreaView style={styles.racine}>
        <ScrollView
          contentContainerStyle={styles.contenu}
          refreshControl={
            <RefreshControl
              refreshing={chargeEnCours && vitrine != null}
              onRefresh={charger}
              tintColor={encre2}
            />
          }
        >
          {chargeEnCours && !vitrine && !erreur && (
            <View style={styles.centre}>
              <ActivityIndicator color={encre} />
              <Text style={[styles.aide, { color: encre2 }]}>
                On va chercher le club…
              </Text>
            </View>
          )}

          {erreur && (
            <View style={[styles.carte, carteStyle(t)]}>
              <Text style={[styles.titreCarte, { color: encre }]}>
                Ça n&apos;a pas marché
              </Text>
              <Text style={[styles.aide, { color: encre2 }]}>{erreur}</Text>
              <Pressable
                onPress={charger}
                style={[styles.bouton, { backgroundColor: t?.bt ?? "#fff" }]}
              >
                <Text style={[styles.boutonTexte, { color: t?.bf ?? "#111" }]}>
                  Réessayer
                </Text>
              </Pressable>
            </View>
          )}

          {vitrine && (
            <>
              <View style={styles.entete}>
                <Ecusson
                  couleur={vitrine.club.couleurA}
                  lettre={vitrine.club.nom[0] ?? "F"}
                />
                <Text style={[styles.nomClub, { color: encre }]}>
                  {vitrine.club.nom}
                </Text>
                {vitrine.saison && (
                  <Text style={[styles.aide, { color: encre2 }]}>
                    {vitrine.saison.nom}
                  </Text>
                )}
              </View>

              {vitrine.derniersMatchs.length > 0 && (
                <View style={[styles.carte, carteStyle(t)]}>
                  <Text style={[styles.titreCarte, { color: encre }]}>
                    Derniers résultats
                  </Text>
                  {vitrine.derniersMatchs.map((m, i) => (
                    <View
                      key={m.id}
                      style={[
                        styles.ligneMatch,
                        i > 0 && {
                          borderTopWidth: StyleSheet.hairlineWidth,
                          borderTopColor: t?.sep ?? "#222",
                        },
                      ]}
                    >
                      <Text style={[styles.date, { color: encre2 }]}>
                        {m.quandCourt}
                      </Text>
                      <Text style={[styles.score, { color: encre }]} numberOfLines={1}>
                        <Text style={m.scoreA > m.scoreB ? styles.gagnant : undefined}>
                          {m.nomA} {m.scoreA}
                        </Text>
                        <Text style={{ color: encre2 }}> – </Text>
                        <Text style={m.scoreB > m.scoreA ? styles.gagnant : undefined}>
                          {m.scoreB} {m.nomB}
                        </Text>
                      </Text>
                      {m.hommeDuMatch && (
                        <Text
                          style={[styles.mvp, { color: t?.or ?? "#ffd60a" }]}
                          numberOfLines={1}
                        >
                          ★ {m.hommeDuMatch}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              )}

              <View style={[styles.carte, carteStyle(t)]}>
                <Text style={[styles.titreCarte, { color: encre }]}>Tableau</Text>
                <View style={styles.tete}>
                  <View style={styles.rang} />
                  <Text style={[styles.joueurTete, { color: encre3 }]}>Joueur</Text>
                  <Text style={[styles.chiffre, { color: encre3 }]}>MJ</Text>
                  <Text style={[styles.chiffre, { color: encre3 }]}>B</Text>
                  <Text style={[styles.chiffre, { color: encre3 }]}>PTS</Text>
                </View>
                {vitrine.classement.map((r, i) => (
                  <View
                    key={r.playerId}
                    style={[
                      styles.ligne,
                      {
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderTopColor: t?.sep ?? "#222",
                      },
                    ]}
                  >
                    <Text style={[styles.rang, { color: encre2 }]}>{i + 1}</Text>
                    <View style={styles.joueur}>
                      <Avatar
                        nom={r.nom}
                        photo={r.photo}
                        anneau={t?.taR ?? t?.ta}
                        fond={t?.seg}
                      />
                      <Text style={[styles.nom, { color: encre }]} numberOfLines={1}>
                        {r.nom}
                      </Text>
                    </View>
                    <Text style={[styles.chiffre, { color: encre2 }]}>{r.matchs}</Text>
                    <Text style={[styles.chiffre, { color: encre2 }]}>{r.buts}</Text>
                    <Text style={[styles.chiffre, styles.points, { color: encre }]}>
                      {r.victoires * 3 + r.nuls}
                    </Text>
                  </View>
                ))}
              </View>

              <Text style={[styles.pied, { color: encre3 }]}>
                Five Scorer · {Platform.OS} · vitrine publique
              </Text>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Avatar({
  nom,
  photo,
  anneau,
  fond,
}: {
  nom: string;
  photo: string | null;
  anneau?: string;
  fond?: string;
}) {
  const initiales = nom
    .split(/\s+/)
    .slice(0, 2)
    .map((m) => m[0] ?? "")
    .join("")
    .toUpperCase();
  return (
    <View
      style={[
        styles.avatar,
        {
          backgroundColor: fond ?? "rgba(255,255,255,0.08)",
          borderColor: anneau ?? "#555",
        },
      ]}
    >
      {photo ? (
        <Image source={{ uri: photo }} style={styles.avatarImage} />
      ) : (
        <Text style={styles.initiales}>{initiales}</Text>
      )}
    </View>
  );
}

function Ecusson({ couleur, lettre }: { couleur: string; lettre: string }) {
  return (
    <View style={[styles.ecusson, { backgroundColor: couleur }]}>
      <Text style={[styles.ecussonLettre, { color: lisible(couleur) }]}>
        {lettre.toUpperCase()}
      </Text>
    </View>
  );
}

// --- Couleurs ---------------------------------------------------------------
// Deux fonctions seulement, reprises de lib/color.ts côté web : le mélange
// pour le dégradé de fond, et le contraste de l'écusson. Tout le reste des
// jetons arrive déjà calculé par l'API — on ne duplique pas la règle.

function hex(c: string): [number, number, number] {
  const v = c.replace("#", "");
  const n =
    v.length === 3
      ? v
          .split("")
          .map((x) => x + x)
          .join("")
      : v;
  return [
    parseInt(n.slice(0, 2), 16),
    parseInt(n.slice(2, 4), 16),
    parseInt(n.slice(4, 6), 16),
  ];
}

function melange(a: string, b: string, part: number): string {
  const [r1, g1, b1] = hex(a);
  const [r2, g2, b2] = hex(b);
  const m = (x: number, y: number) => Math.round(x + (y - x) * part);
  return `rgb(${m(r1, r2)}, ${m(g1, g2)}, ${m(b1, b2)})`;
}

function lisible(c: string): string {
  const [r, g, b] = hex(c);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.72 ? "#111" : "#fff";
}

function carteStyle(t?: Record<string, string>) {
  return {
    backgroundColor: t?.cdSolid ?? "rgba(255,255,255,0.085)",
    borderColor: t?.cb ?? "rgba(255,255,255,0.14)",
  };
}

const styles = StyleSheet.create({
  racine: { flex: 1 },
  contenu: { padding: 14, paddingBottom: 40, gap: 14 },
  centre: { paddingTop: 120, alignItems: "center", gap: 12 },
  entete: { alignItems: "center", paddingTop: 10, paddingBottom: 4, gap: 8 },
  ecusson: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  ecussonLettre: { fontSize: 24, fontWeight: "800" },
  nomClub: {
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -0.4,
    textAlign: "center",
  },
  aide: { fontSize: 15, textAlign: "center" },
  carte: { borderRadius: 26, borderWidth: 1, padding: 16 },
  titreCarte: {
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
    paddingBottom: 8,
  },
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
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: { width: "100%", height: "100%" },
  initiales: { fontSize: 10, fontWeight: "700", color: "#fff" },
  bouton: {
    marginTop: 12,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  boutonTexte: { fontSize: 17, fontWeight: "600" },
  pied: { textAlign: "center", fontSize: 13, paddingTop: 6 },
});
