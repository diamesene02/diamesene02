import { useCallback, useEffect, useMemo, useState } from "react";
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
import Ecran from "../composants/Ecran";
import { BoutonPlein, BoutonRond, Carte, Champ, Segment } from "../composants/base";
import { JETONS_NEUTRES, type Jetons } from "../lib/couleurs";
import {
  cle,
  genererCalendrier,
  saisonParDefaut,
  type JourSemaine,
  type Occurrence,
} from "../lib/calendrier";
import {
  chargerMoi,
  poserCalendrier,
  SessionExpiree,
  type ClubDeMoi,
} from "../lib/api";

/// « Poser toute la saison » — quarante-quatre lundis d'un coup.
///
/// C'est le geste qui manque le plus à un club qui joue toutes les semaines :
/// sans lui, les soirées se créent une par une, donc pas du tout, donc la
/// feuille de match se fait debout au bord du terrain pendant que dix
/// personnes attendent.
///
/// Les dates sont calculées ICI, sur le téléphone, par le même module que le
/// site (`lib/calendrier.ts`, copie vérifiée octet pour octet) : la personne
/// qui prépare le calendrier est celle qui joue, c'est son fuseau qui fait foi.
/// Et la liste est MONTRÉE avant d'être écrite, chaque date pouvant être
/// retirée ou rétablie — une règle ne prévoit ni le terrain fermé, ni les
/// vacances, ni le tournoi.
const JOURS: { valeur: string; libelle: string; jour: JourSemaine }[] = [
  { valeur: "1", libelle: "Lundi", jour: 1 },
  { valeur: "2", libelle: "Mardi", jour: 2 },
  { valeur: "3", libelle: "Mercredi", jour: 3 },
  { valeur: "4", libelle: "Jeudi", jour: 4 },
  { valeur: "5", libelle: "Vendredi", jour: 5 },
  { valeur: "6", libelle: "Samedi", jour: 6 },
  { valeur: "0", libelle: "Dimanche", jour: 0 },
];

export default function Calendrier() {
  const { clubId, lieu: lieuInitial } = useLocalSearchParams<{
    clubId?: string;
    lieu?: string;
  }>();
  const [club, setClub] = useState<ClubDeMoi | null>(null);
  const [occupe, setOccupe] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const defauts = useMemo(() => saisonParDefaut(new Date()), []);
  const [nom, setNom] = useState(defauts.nom);
  const [debut, setDebut] = useState(defauts.debut);
  const [fin, setFin] = useState(defauts.fin);
  const [quelPicker, setQuelPicker] = useState<"debut" | "fin" | "heure" | null>(null);
  const [jour, setJour] = useState<JourSemaine>(1);
  const [heure, setHeure] = useState(() => {
    const h = new Date();
    h.setHours(20, 0, 0, 0);
    return h;
  });
  const [lieu, setLieu] = useState(lieuInitial ?? "");
  const [titre, setTitre] = useState("");
  // Ce que la personne a retiré ou rétabli à la main, par-dessus les
  // exclusions automatiques. La liste doit rester la sienne.
  const [bascules, setBascules] = useState<Record<string, boolean>>({});

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

  const occurrences = useMemo(
    () =>
      genererCalendrier({
        debut,
        fin,
        jourSemaine: jour,
        heures: heure.getHours(),
        minutes: heure.getMinutes(),
      }),
    [debut, fin, jour, heure],
  );

  const retenue = (o: Occurrence) => {
    const k = cle(o.date);
    return bascules[k] !== undefined ? bascules[k] : o.exclu === null;
  };
  const retenues = occurrences.filter(retenue);

  const parMois = useMemo(() => {
    const m = new Map<string, Occurrence[]>();
    for (const o of occurrences) {
      const k = o.date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
      m.set(k, [...(m.get(k) ?? []), o]);
    }
    return [...m.entries()];
  }, [occurrences]);

  async function soumettre() {
    if (!clubId) return;
    if (retenues.length === 0) return setErreur("Aucune date retenue.");
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await poserCalendrier(clubId, {
        nomSaison: nom,
        dates: retenues.map((o) => o.date.toISOString()),
        titre: titre.trim() || undefined,
        lieu: lieu.trim() || undefined,
      });
      if (!r.ok) {
        setErreur(r.error ?? "Erreur");
        setEnvoi(false);
        return;
      }
      router.back();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
      setEnvoi(false);
    }
  }

  const couleurA = club?.couleurA ?? "#ffffff";
  const couleurB = club?.couleurB ?? "#111111";
  const dateLongue = (d: Date) =>
    d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  return (
    <Ecran t={t} chasubles={{ a: couleurA, b: couleurB }}>
      <ScrollView contentContainerStyle={s.contenu} keyboardShouldPersistTaps="handled">
        <View style={s.barre}>
          <BoutonRond t={t} symbole="‹" etiquette="Retour" onPress={() => router.back()} />
        </View>

        <Text style={[s.titre, { color: t.ink }]}>Poser toute la saison</Text>
        <Text style={[s.sousTitre, { color: t.i2 }]}>
          Les fériés et la trêve de Noël sont écartés d&apos;office. Tu peux
          rétablir ou retirer n&apos;importe quelle date.
        </Text>

        {occupe && (
          <View style={s.centre}>
            <ActivityIndicator color={t.ink} />
          </View>
        )}

        {!occupe && (
          <>
            <Carte t={t} style={{ marginTop: 18 }}>
              <Champ
                t={t}
                libelle="NOM DE LA SAISON"
                value={nom}
                onChangeText={setNom}
                autoCapitalize="sentences"
              />
              <View style={{ height: 14 }} />
              <Text style={[s.libelle, { color: t.i2 }]}>ON JOUE LE</Text>
              <View style={s.jours}>
                {JOURS.map((j) => {
                  const actif = j.jour === jour;
                  return (
                    <Pressable
                      key={j.valeur}
                      onPress={() => setJour(j.jour)}
                      style={[
                        s.jourPastille,
                        { borderColor: t.cb, backgroundColor: actif ? t.bt : "transparent" },
                      ]}
                    >
                      <Text style={{ color: actif ? t.bf : t.i2, fontWeight: "600", fontSize: 15 }}>
                        {j.libelle}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Carte>

            <Carte t={t} style={{ marginTop: 14 }}>
              <Ligne
                t={t}
                libelle="Du"
                valeur={dateLongue(debut)}
                onPress={() => setQuelPicker("debut")}
                premiere
              />
              <Ligne
                t={t}
                libelle="Au"
                valeur={dateLongue(fin)}
                onPress={() => setQuelPicker("fin")}
              />
              <Ligne
                t={t}
                libelle="À"
                valeur={heure.toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                onPress={() => setQuelPicker("heure")}
              />
              {quelPicker && (
                <DateTimePicker
                  value={quelPicker === "debut" ? debut : quelPicker === "fin" ? fin : heure}
                  mode={quelPicker === "heure" ? "time" : "date"}
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  themeVariant="dark"
                  locale="fr-FR"
                  onChange={(_, d) => {
                    if (Platform.OS !== "ios") setQuelPicker(null);
                    if (!d) return;
                    if (quelPicker === "debut") setDebut(d);
                    else if (quelPicker === "fin") setFin(d);
                    else setHeure(d);
                  }}
                />
              )}
              {quelPicker && Platform.OS === "ios" && (
                <Pressable onPress={() => setQuelPicker(null)} style={s.fermerPicker}>
                  <Text style={{ color: t.i2, fontSize: 15, fontWeight: "600" }}>OK</Text>
                </Pressable>
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
                libelle="TITRE DE CHAQUE SOIRÉE (FACULTATIF)"
                value={titre}
                onChangeText={setTitre}
                placeholder="Le five du lundi…"
                autoCapitalize="sentences"
              />
            </Carte>

            <Text style={[s.compte, { color: t.ink }]}>
              {retenues.length} date{retenues.length > 1 ? "s" : ""} retenue
              {retenues.length > 1 ? "s" : ""}
              {occurrences.length !== retenues.length
                ? ` sur ${occurrences.length}`
                : ""}
            </Text>

            {parMois.map(([mois, liste]) => (
              <View key={mois} style={{ marginTop: 10 }}>
                <Text style={[s.mois, { color: t.i2 }]}>{mois.toUpperCase()}</Text>
                <View style={[s.carteListe, { borderColor: t.cb, backgroundColor: t.cdSolid }]}>
                  {liste.map((o, i) => {
                    const k = cle(o.date);
                    const prise = retenue(o);
                    return (
                      <Pressable
                        key={k}
                        onPress={() => setBascules((b) => ({ ...b, [k]: !prise }))}
                        style={({ pressed }) => [
                          s.rangee,
                          i > 0 && {
                            borderTopWidth: StyleSheet.hairlineWidth,
                            borderTopColor: t.sep,
                          },
                          pressed && { opacity: 0.6 },
                        ]}
                      >
                        <View
                          style={[
                            s.coche,
                            {
                              borderColor: prise ? t.ok : t.i3,
                              backgroundColor: prise ? t.ok : "transparent",
                            },
                          ]}
                        >
                          {prise && <Text style={s.cocheTexte}>✓</Text>}
                        </View>
                        <Text
                          style={[
                            s.rangeeDate,
                            { color: prise ? t.ink : t.i3 },
                            !prise && s.rature,
                          ]}
                        >
                          {o.date.toLocaleDateString("fr-FR", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })}
                        </Text>
                        {o.exclu && (
                          <Text style={[s.motif, { color: t.i3 }]} numberOfLines={1}>
                            {o.exclu}
                          </Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}

            {erreur && <Text style={[s.erreur, { color: t.bad }]}>{erreur}</Text>}

            <View style={{ height: 18 }} />
            <BoutonPlein
              t={t}
              titre={
                envoi
                  ? "On pose la saison…"
                  : `Créer ${retenues.length} soirée${retenues.length > 1 ? "s" : ""}`
              }
              onPress={soumettre}
              disabled={envoi || retenues.length === 0}
            />
            <Text style={[s.note, { color: t.i3 }]}>
              Les lundis déjà au calendrier ne sont pas recréés, et les compos
              déjà préparées ne sont pas touchées.
            </Text>
          </>
        )}
      </ScrollView>
    </Ecran>
  );
}

function Ligne({
  t,
  libelle,
  valeur,
  onPress,
  premiere,
}: {
  t: Jetons;
  libelle: string;
  valeur: string;
  onPress: () => void;
  premiere?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.ligne,
        !premiere && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.sep },
        pressed && { opacity: 0.6 },
      ]}
    >
      <Text style={[s.ligneLibelle, { color: t.ink }]}>{libelle}</Text>
      <Text style={[s.ligneValeur, { color: t.i2 }]} numberOfLines={1}>
        {valeur}
      </Text>
      <Text style={[s.chevron, { color: t.i3 }]}>›</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  contenu: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 60 },
  barre: { flexDirection: "row", paddingBottom: 12 },
  titre: { fontSize: 34, fontWeight: "700", letterSpacing: -0.5, paddingHorizontal: 4 },
  sousTitre: { fontSize: 15, lineHeight: 21, paddingHorizontal: 4, paddingTop: 6 },
  centre: { paddingTop: 60, alignItems: "center" },
  libelle: { fontSize: 13, fontWeight: "600", letterSpacing: 0.4, paddingBottom: 8 },

  jours: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  jourPastille: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },

  ligne: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52 },
  ligneLibelle: { fontSize: 17, fontWeight: "600", width: 40 },
  ligneValeur: { fontSize: 17, flex: 1, textAlign: "right" },
  chevron: { fontSize: 20 },
  fermerPicker: { alignItems: "flex-end", paddingTop: 4 },

  compte: { fontSize: 17, fontWeight: "700", paddingTop: 20, paddingHorizontal: 4 },
  mois: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.4,
    paddingHorizontal: 8,
    paddingBottom: 6,
  },
  carteListe: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14 },
  rangee: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 46 },
  coche: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  cocheTexte: { color: "#04230d", fontSize: 13, fontWeight: "800" },
  rangeeDate: { fontSize: 15, fontWeight: "600", flex: 1, textTransform: "capitalize" },
  rature: { textDecorationLine: "line-through" },
  motif: { fontSize: 13, maxWidth: "45%" },

  erreur: { fontSize: 15, textAlign: "center", paddingTop: 16 },
  note: { fontSize: 13, textAlign: "center", paddingTop: 12, lineHeight: 18 },
});
