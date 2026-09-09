import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import Ecran from "../../composants/Ecran";
import { BoutonPlein, BoutonRond, Carte, Champ } from "../../composants/base";
import { JETONS_NEUTRES, type Jetons } from "../../lib/couleurs";
import {
  chargerMoi,
  creerSoiree,
  SessionExpiree,
  type ClubDeMoi,
} from "../../lib/api";

/// « Ajouter une soirée » — un lundi de plus au calendrier.
///
/// Le geste courant n'est pas celui-ci : un club qui joue toutes les semaines
/// pose sa saison entière d'un coup (« Poser toute la saison »). Cet écran
/// sert au lundi en trop — un tournoi, un rattrapage, un vendredi de fin
/// d'année. D'où sa brièveté : la date, le lieu, un titre facultatif.
export default function NouvelleSoiree() {
  const { clubId, lieu: lieuInitial } = useLocalSearchParams<{
    clubId?: string;
    lieu?: string;
  }>();
  const [club, setClub] = useState<ClubDeMoi | null>(null);
  const [date, setDate] = useState(prochainLundi);
  const [ouvrePicker, setOuvrePicker] = useState(false);
  const [lieu, setLieu] = useState(lieuInitial ?? "");
  const [titre, setTitre] = useState("");
  const [occupe, setOccupe] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const t: Jetons = club?.theme.sombre ?? JETONS_NEUTRES;

  const charger = useCallback(async () => {
    if (!clubId) return;
    try {
      const moi = await chargerMoi();
      setClub(moi.clubs.find((c) => c.id === clubId) ?? null);
    } catch (e) {
      if (e instanceof SessionExpiree) return router.replace("/connexion");
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setOccupe(false);
    }
  }, [clubId]);

  useEffect(() => {
    void charger();
  }, [charger]);

  async function creer() {
    if (!clubId) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await creerSoiree(clubId, {
        date: date.toISOString(),
        lieu: lieu.trim() || undefined,
        titre: titre.trim() || undefined,
      });
      // On part droit sur la soirée créée : c'est là qu'on répond présent et
      // qu'on prépare la compo, et c'est pour ça qu'on vient de la créer.
      router.replace({ pathname: "/soiree/[id]", params: { id: r.soireeId, clubId } });
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
      setEnvoi(false);
    }
  }

  const couleurA = club?.couleurA ?? "#ffffff";
  const couleurB = club?.couleurB ?? "#111111";

  return (
    <Ecran t={t} chasubles={{ a: couleurA, b: couleurB }}>
      <ScrollView contentContainerStyle={s.contenu} keyboardShouldPersistTaps="handled">
        <View style={s.barre}>
          <BoutonRond t={t} symbole="‹" etiquette="Retour" onPress={() => router.back()} />
        </View>

        <Text style={[s.titre, { color: t.ink }]}>Ajouter une soirée</Text>

        {occupe && (
          <View style={s.centre}>
            <ActivityIndicator color={t.ink} />
          </View>
        )}

        {!occupe && (
          <>
            <Carte t={t} style={{ marginTop: 18 }}>
              <Text style={[s.libelle, { color: t.i2 }]}>QUAND</Text>
              <Pressable onPress={() => setOuvrePicker(true)}>
                <Text style={[s.dateChoisie, { color: t.ink, borderColor: t.cb }]}>
                  {date.toLocaleDateString("fr-FR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                  {" · "}
                  {date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </Pressable>
              {(ouvrePicker || Platform.OS === "ios") && (
                <DateTimePicker
                  value={date}
                  mode="datetime"
                  display={Platform.OS === "ios" ? "compact" : "default"}
                  themeVariant="dark"
                  locale="fr-FR"
                  onChange={(_, d) => {
                    setOuvrePicker(Platform.OS === "ios");
                    if (d) setDate(d);
                  }}
                />
              )}
            </Carte>

            <Carte t={t} style={{ marginTop: 14 }}>
              <Champ
                t={t}
                libelle="OÙ"
                value={lieu}
                onChangeText={setLieu}
                placeholder="Urban Soccer, terrain 3…"
                autoCapitalize="sentences"
              />
              <View style={{ height: 14 }} />
              <Champ
                t={t}
                libelle="TITRE (FACULTATIF)"
                value={titre}
                onChangeText={setTitre}
                placeholder="Tournoi de fin d'année…"
                autoCapitalize="sentences"
              />
            </Carte>

            {erreur && <Text style={[s.erreur, { color: t.bad }]}>{erreur}</Text>}

            <View style={{ height: 18 }} />
            <BoutonPlein
              t={t}
              titre={envoi ? "On ajoute…" : "Ajouter au calendrier"}
              onPress={creer}
              disabled={envoi}
            />
          </>
        )}
      </ScrollView>
    </Ecran>
  );
}

/// Le prochain lundi à 20 h — le modèle du club. Si on est déjà lundi mais
/// avant l'heure, c'est aujourd'hui ; sinon la semaine prochaine.
function prochainLundi(): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  const jours = (1 - d.getDay() + 7) % 7;
  const cible = new Date(d);
  cible.setDate(d.getDate() + jours);
  cible.setHours(20, 0, 0, 0);
  if (cible.getTime() <= Date.now()) cible.setDate(cible.getDate() + 7);
  return cible;
}

const s = StyleSheet.create({
  contenu: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 60 },
  barre: { flexDirection: "row", paddingBottom: 12 },
  titre: { fontSize: 34, fontWeight: "700", letterSpacing: -0.5, paddingHorizontal: 4 },
  centre: { paddingTop: 60, alignItems: "center" },
  libelle: { fontSize: 13, fontWeight: "600", letterSpacing: 0.4, paddingBottom: 8 },
  dateChoisie: {
    fontSize: 17,
    fontWeight: "600",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textTransform: "capitalize",
  },
  erreur: { fontSize: 15, textAlign: "center", paddingTop: 16 },
});
