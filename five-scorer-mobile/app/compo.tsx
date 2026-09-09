import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import Ecran from "../composants/Ecran";
import {
  Avatar,
  BoutonPlein,
  BoutonRond,
  BoutonVerre,
  Carte,
  EcussonChasuble,
  Segment,
} from "../composants/base";
import { useNoyau } from "../composants/Noyau";
import { JETONS_NEUTRES, type Jetons } from "../lib/couleurs";
import { chargerEffectif, chargerMoi, type ClubDeMoi } from "../lib/api";
import { balanceTeams, type BalanceInput } from "../lib/noyau/balance";

/// « Nouveau match » — reprise de l'écran du site.
///
/// Même déroulé, mêmes cartes : quand, la ligne de score avec les deux
/// écussons de chasuble et les noms d'équipe, la liste complète où un tap fait
/// tourner un joueur aucun → A → B, l'équilibrage, l'invité, le coup d'envoi.
///
/// Rien ne touche le réseau au coup d'envoi : `createMatch` écrit sur
/// l'appareil et enfile l'opération. Au gymnase, le réseau est une chance, pas
/// une condition.
///
/// **Deux écarts assumés au site.**
///
/// 1. Le segment « Entre nous / Vs adversaire » n'est pas porté : le club joue
///    entre lui tous les lundis, et un écran de terrain ne doit montrer que ce
///    qu'on y fait. À reprendre le jour où un match contre une autre équipe
///    sera au programme.
/// 2. Les abonnés arrivent présélectionnés, et « Tous / Personne » double la
///    liste. Sur le web personne n'est coché et il faut taper les quatorze
///    joueurs un par un : debout au bord du terrain, c'est le geste le plus
///    coûteux de la soirée.

type Choix = "aucun" | "A" | "B";

type Fiche = BalanceInput & {
  photo: string | null;
  isGuest: boolean;
  abonne: boolean;
};

export default function Compo() {
  const { clubId } = useLocalSearchParams<{ clubId?: string }>();
  const { local, drain } = useNoyau();

  const [club, setClub] = useState<ClubDeMoi | null>(null);
  const [effectif, setEffectif] = useState<Fiche[]>([]);
  const [choix, setChoix] = useState<Record<string, Choix>>({});
  const [quand, setQuand] = useState<"maintenant" | "deja">("maintenant");
  const [date, setDate] = useState(veille);
  const [ouvrePicker, setOuvrePicker] = useState(false);
  const [nomA, setNomA] = useState("");
  const [nomB, setNomB] = useState("");
  const [graine, setGraine] = useState(1);
  const [tire, setTire] = useState(false);
  const [nomInvite, setNomInvite] = useState("");
  const [occupe, setOccupe] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const t: Jetons = club?.theme.sombre ?? JETONS_NEUTRES;

  const charger = useCallback(async () => {
    if (!clubId) return;
    setOccupe(true);
    setErreur(null);
    try {
      const moi = await chargerMoi();
      const c = moi.clubs.find((x) => x.id === clubId) ?? null;
      setClub(c);
      if (c) {
        setNomA((n) => n || c.nomChasubleA);
        setNomB((n) => n || c.nomChasubleB);
        // Le miroir local, pour que la soirée suivante s'ouvre sans réseau.
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
      const serveur = await chargerEffectif(clubId);
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
      setEffectif(fiches);
      // Les abonnés sont présumés là : c'est la règle du club, et c'est ce que
      // `lib/presences.ts` fait déjà côté serveur.
      setChoix(
        Object.fromEntries(fiches.filter((f) => f.abonne).map((f) => [f.id, "A" as Choix])),
      );
    } catch (e) {
      // Hors réseau, on se rabat sur le miroir. Il ne porte pas les
      // abonnements — ils ne sont pas dans le schéma local — donc personne
      // n'est présélectionné, et « Tous » est à un tap.
      try {
        const cache = await local.effectifDuClub(clubId);
        if (cache.length === 0) throw e;
        setEffectif(
          cache.map((p) => ({
            id: p.id,
            name: p.name,
            skill: p.skill,
            isGk: p.isGk,
            photo: p.photo ?? null,
            isGuest: p.isGuest,
            abonne: false,
          })),
        );
        const c = await local.getLocalClub(clubId);
        if (c) {
          setNomA((n) => n || "A");
          setNomB((n) => n || "B");
        }
      } catch {
        setErreur(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setOccupe(false);
    }
  }, [clubId, local]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const couleurA = club?.couleurA ?? "#ffffff";
  const couleurB = club?.couleurB ?? "#111111";

  const retenus = useMemo(
    () => effectif.filter((f) => (choix[f.id] ?? "aucun") !== "aucun"),
    [effectif, choix],
  );
  const equipeA = retenus.filter((f) => choix[f.id] === "A");
  const equipeB = retenus.filter((f) => choix[f.id] === "B");

  function tourner(id: string) {
    setChoix((c) => {
      const actuel = c[id] ?? "aucun";
      return {
        ...c,
        [id]: actuel === "aucun" ? "A" : actuel === "A" ? "B" : "aucun",
      };
    });
  }

  function tousOuAucun() {
    const toutLeMonde = retenus.length === effectif.length;
    setChoix(
      toutLeMonde ? {} : Object.fromEntries(effectif.map((f) => [f.id, "A" as Choix])),
    );
    setTire(false);
  }

  function equilibrer() {
    if (retenus.length < 2) return;
    const r = balanceTeams(retenus, { seed: graine });
    const neuf: Record<string, Choix> = { ...choix };
    for (const p of r.teamA) neuf[p.id] = "A";
    for (const p of r.teamB) neuf[p.id] = "B";
    setChoix(neuf);
    setGraine((g) => g + 1);
    setTire(true);
  }

  async function ajouterInvite() {
    const nom = nomInvite.trim();
    if (!nom || !clubId) return;
    const id = await local.addLocalGuest(clubId, nom);
    setEffectif((e) => [
      ...e,
      { id, name: nom, skill: 3, isGk: false, photo: null, isGuest: true, abonne: false },
    ]);
    setChoix((c) => ({ ...c, [id]: "A" }));
    setNomInvite("");
  }

  async function coupDEnvoi() {
    if (!clubId) return;
    if (equipeA.length === 0 || equipeB.length === 0) {
      return setErreur("Il faut au moins un joueur dans chaque équipe.");
    }
    setEnvoi(true);
    setErreur(null);
    try {
      const matchId = await local.createMatch({
        clubId,
        kind: "INTERNAL",
        teamAName: nomA.trim() || "A",
        teamBName: nomB.trim() || "B",
        teamA: equipeA.map((p) => ({ playerId: p.id, isGk: p.isGk })),
        teamB: equipeB.map((p) => ({ playerId: p.id, isGk: p.isGk })),
        playedAt: quand === "deja" ? date.toISOString() : null,
      });
      // Le match existe déjà sur l'appareil : on part à la feuille sans
      // attendre le serveur. La file s'en charge.
      void drain.relancer();
      router.replace({ pathname: "/match/[id]", params: { id: matchId } });
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
      setEnvoi(false);
    }
  }

  return (
    <Ecran t={t} chasubles={{ a: couleurA, b: couleurB }}>
      <ScrollView contentContainerStyle={s.contenu} keyboardShouldPersistTaps="handled">
        <View style={s.barre}>
          <BoutonRond t={t} symbole="‹" etiquette="Retour" onPress={() => router.back()} />
          {club && (
            <View style={[s.pilule, { borderColor: t.cb, backgroundColor: t.cdSolid }]}>
              <EcussonChasuble couleur={couleurA} lettre={club.nom[0] ?? "F"} taille={26} />
              <Text style={[s.pilulTexte, { color: t.ink }]} numberOfLines={1}>
                {club.nom}
              </Text>
            </View>
          )}
        </View>

        <Text style={[s.titre, { color: t.ink }]}>Nouveau match</Text>

        {occupe && effectif.length === 0 && (
          <View style={s.centre}>
            <ActivityIndicator color={t.ink} />
            <Text style={[s.aide, { color: t.i2 }]}>On va chercher l'effectif…</Text>
          </View>
        )}

        {erreur && <Text style={[s.erreur, { color: "#ff453a" }]}>{erreur}</Text>}

        {effectif.length > 0 && (
          <>
            <Carte t={t}>
              <Text style={[s.carteTitreGauche, { color: t.ink }]}>Quand ?</Text>
              <Text style={[s.aide, { color: t.i2 }]}>
                {quand === "maintenant"
                  ? "La feuille s'ouvre en direct, chrono lancé."
                  : "Feuille sans chrono : tu tapes les buts, tu enregistres."}
              </Text>
              <View style={{ height: 12 }} />
              <Segment
                t={t}
                valeur={quand}
                onChange={setQuand}
                choix={[
                  { valeur: "maintenant", libelle: "Maintenant" },
                  { valeur: "deja", libelle: "Déjà joué" },
                ]}
              />
              {quand === "deja" && (
                <>
                  <View style={{ height: 12 }} />
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
                      maximumDate={new Date()}
                      themeVariant="dark"
                      locale="fr-FR"
                      onChange={(_, d) => {
                        setOuvrePicker(false);
                        if (d) setDate(d);
                      }}
                    />
                  )}
                </>
              )}
            </Carte>

            {/* La ligne de score du site : les deux chasubles, les effectifs,
                et les noms modifiables en dessous. C'est le seul endroit où
                l'on voit d'un coup si les équipes sont équilibrées. */}
            <Carte t={t}>
              <View style={s.ligneScore}>
                <EcussonChasuble couleur={couleurA} lettre={nomA[0] ?? "A"} taille={56} />
                <Text style={[s.compte, { color: t.ink }]}>{equipeA.length}</Text>
                <View style={s.ligneMilieu}>
                  <Text style={[s.ligneTitre, { color: t.ink }]}>Effectif</Text>
                  <Text style={[s.ligneAide, { color: t.i3 }]}>joueurs par équipe</Text>
                </View>
                <Text style={[s.compte, { color: t.ink }]}>{equipeB.length}</Text>
                <EcussonChasuble couleur={couleurB} lettre={nomB[0] ?? "B"} taille={56} />
              </View>
              <View style={s.nomsEquipes}>
                <TextInput
                  value={nomA}
                  onChangeText={setNomA}
                  style={[s.saisieNom, { color: t.ink, borderColor: t.cb, backgroundColor: t.seg }]}
                  placeholderTextColor={t.i3}
                  accessibilityLabel="Nom de la première équipe"
                />
                <TextInput
                  value={nomB}
                  onChangeText={setNomB}
                  style={[s.saisieNom, { color: t.ink, borderColor: t.cb, backgroundColor: t.seg }]}
                  placeholderTextColor={t.i3}
                  accessibilityLabel="Nom de la seconde équipe"
                />
              </View>
            </Carte>

            <Carte t={t} style={{ paddingVertical: 6 }}>
              <View style={s.enteteListe}>
                <Text style={[s.enteteTexte, { color: t.ink }]} numberOfLines={1}>
                  Qui joue ? — tape : aucun → {nomA} → {nomB}
                </Text>
                <Pressable onPress={tousOuAucun} hitSlop={10}>
                  <Text style={[s.lien, { color: t.i2 }]}>
                    {retenus.length === effectif.length ? "Personne" : "Tous"}
                  </Text>
                </Pressable>
              </View>
              {effectif.map((f, i) => {
                const c = choix[f.id] ?? "aucun";
                const anneau =
                  c === "A" ? (t.taR ?? couleurA) : c === "B" ? (t.tbR ?? couleurB) : undefined;
                return (
                  <Pressable
                    key={f.id}
                    onPress={() => tourner(f.id)}
                    style={[s.rangee, i > 0 && { borderTopWidth: 1, borderTopColor: t.sep }]}
                  >
                    <Avatar nom={f.name} photo={f.photo} t={t} anneau={anneau} taille={36} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={[
                          s.nom,
                          {
                            color: c === "aucun" ? t.i2 : t.ink,
                            fontWeight: c === "aucun" ? "400" : "700",
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {f.name}
                        {f.isGuest ? " (inv.)" : ""}
                        {f.isGk ? " · gardien" : ""}
                      </Text>
                      <Text style={[s.sousNom, { color: t.i3 }]}>Niveau {f.skill}</Text>
                    </View>
                    <Text style={[s.valeur, { color: c === "aucun" ? t.i3 : t.ink }]}>
                      {c === "aucun" ? "—" : c === "A" ? nomA : nomB}
                    </Text>
                  </Pressable>
                );
              })}
            </Carte>

            {retenus.length >= 2 && (
              <Carte t={t}>
                <Text style={[s.carteTitreGauche, { color: t.ink }]}>Équipes équilibrées</Text>
                <Text style={[s.aide, { color: t.i2 }]}>
                  Répartit les {retenus.length} sélectionnés selon leur niveau, gardiens séparés.
                </Text>
                <View style={{ height: 12 }} />
                <BoutonVerre
                  t={t}
                  titre={tire ? "Retirer au sort" : "Équilibrer"}
                  onPress={equilibrer}
                />
              </Carte>
            )}

            <Carte t={t}>
              <Text style={[s.carteTitreGauche, { color: t.ink }]}>Ajouter un invité</Text>
              <View style={s.ligneInvite}>
                <TextInput
                  value={nomInvite}
                  onChangeText={setNomInvite}
                  placeholder="Nom de l'invité"
                  placeholderTextColor={t.i3}
                  autoCapitalize="words"
                  returnKeyType="done"
                  onSubmitEditing={ajouterInvite}
                  style={[
                    s.saisieInvite,
                    { color: t.ink, borderColor: t.cb, backgroundColor: t.seg },
                  ]}
                />
                <Pressable
                  onPress={ajouterInvite}
                  style={[s.boutonInvite, { borderColor: t.cb, backgroundColor: t.seg }]}
                >
                  <Text style={{ color: t.ink, fontSize: 15, fontWeight: "600" }}>+ Invité</Text>
                </Pressable>
              </View>
            </Carte>

            <Text style={[s.recap, { color: t.i2 }]}>
              {nomA} : {equipeA.length} · {nomB} : {equipeB.length}
            </Text>

            {envoi ? (
              <View style={s.attente}>
                <ActivityIndicator color={t.ink} />
              </View>
            ) : (
              <BoutonPlein
                t={t}
                titre="Coup d'envoi"
                onPress={coupDEnvoi}
                disabled={equipeA.length === 0 || equipeB.length === 0}
              />
            )}
          </>
        )}
      </ScrollView>
    </Ecran>
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

const s = StyleSheet.create({
  contenu: { padding: 14, paddingTop: 8, paddingBottom: 40, gap: 14 },
  barre: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  pilule: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 44,
    paddingLeft: 6,
    paddingRight: 16,
    borderRadius: 22,
    borderWidth: 1,
    maxWidth: 220,
  },
  pilulTexte: { fontSize: 15, fontWeight: "600", flexShrink: 1 },
  titre: { fontSize: 30, fontWeight: "700", letterSpacing: -0.5 },
  centre: { paddingTop: 60, alignItems: "center", gap: 12 },
  aide: { fontSize: 13 },
  erreur: { fontSize: 15, textAlign: "center" },
  carteTitreGauche: { fontSize: 17, fontWeight: "600", paddingBottom: 4 },
  dateChoisie: {
    fontSize: 17,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    overflow: "hidden",
  },

  ligneScore: { flexDirection: "row", alignItems: "center", gap: 6 },
  compte: { fontSize: 34, fontWeight: "700", minWidth: 28, textAlign: "center" },
  ligneMilieu: { flex: 1, alignItems: "center" },
  ligneTitre: { fontSize: 15, fontWeight: "700" },
  ligneAide: { fontSize: 12 },
  nomsEquipes: { flexDirection: "row", gap: 10, paddingTop: 12 },
  saisieNom: { flex: 1, height: 46, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, fontSize: 15 },

  enteteListe: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 8,
  },
  enteteTexte: { flex: 1, fontSize: 15, fontWeight: "600" },
  lien: { fontSize: 15, fontWeight: "600" },
  rangee: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingVertical: 8 },
  nom: { fontSize: 17 },
  sousNom: { fontSize: 13 },
  valeur: { fontSize: 15, fontWeight: "600" },

  ligneInvite: { flexDirection: "row", gap: 10, alignItems: "center", paddingTop: 8 },
  saisieInvite: { flex: 1, height: 46, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, fontSize: 15 },
  boutonInvite: {
    height: 46,
    paddingHorizontal: 16,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  recap: { fontSize: 15, textAlign: "center" },
  attente: { height: 52, alignItems: "center", justifyContent: "center" },
});
