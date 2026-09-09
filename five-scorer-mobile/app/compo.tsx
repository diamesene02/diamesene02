import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import Ecran from "../composants/Ecran";
import { Avatar, BoutonPlein, BoutonVerre, Carte, Champ } from "../composants/base";
import { useNoyau } from "../composants/Noyau";
import { JETONS_NEUTRES, type Jetons } from "../lib/couleurs";
import { chargerEffectif, chargerMoi, type ClubDeMoi } from "../lib/api";
import { balanceTeams, type BalanceInput } from "../lib/noyau/balance";

/// Composer les équipes et donner le coup d'envoi.
///
/// L'écran ne parle au réseau que pour rafraîchir l'effectif ; tout le reste —
/// la sélection, l'équilibrage, la création du match — se passe sur
/// l'appareil. Au gymnase, le réseau est une chance, pas une condition.
///
/// **Écart assumé au site.** Sur le web, personne n'est présélectionné : il
/// faut taper les quatorze joueurs un par un dans une liste sans filtre. Debout
/// au bord du terrain, c'est le geste le plus coûteux de la soirée. Ici les
/// abonnés — ceux qui ont dit « je viens tous les lundis », le modèle réel du
/// club — arrivent déjà cochés, et deux boutons font le reste.

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
      const fiches = versFiches(serveur);
      setEffectif(fiches);
      // Les abonnés sont présumés là : c'est la règle du club, et c'est
      // exactement ce que `lib/presences.ts` fait côté serveur.
      setChoix(Object.fromEntries(fiches.filter((f) => f.abonne).map((f) => [f.id, "A" as Choix])));
    } catch (e) {
      // Hors réseau, on se rabat sur le miroir. Il n'a pas les abonnements —
      // ils ne sont pas dans le schéma local — donc personne n'est
      // présélectionné, et « Tous » est à un tap.
      try {
        const cache = await local.effectifDuClub(clubId);
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
        if (!c) setErreur(e instanceof Error ? e.message : String(e));
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

  const nomA = club?.nomChasubleA ?? "A";
  const nomB = club?.nomChasubleB ?? "B";
  const couleurA = club?.couleurA ?? "#ffffff";
  const couleurB = club?.couleurB ?? "#111111";

  const retenus = useMemo(
    () => effectif.filter((f) => choix[f.id] && choix[f.id] !== "aucun"),
    [effectif, choix],
  );
  const equipeA = retenus.filter((f) => choix[f.id] === "A");
  const equipeB = retenus.filter((f) => choix[f.id] === "B");

  function tourner(id: string) {
    setChoix((c) => {
      const actuel = c[id] ?? "aucun";
      const suivant: Choix = actuel === "aucun" ? "A" : actuel === "A" ? "B" : "aucun";
      return { ...c, [id]: suivant };
    });
  }

  function tousOuAucun() {
    const toutLeMonde = retenus.length === effectif.length;
    setChoix(
      toutLeMonde
        ? {}
        : Object.fromEntries(effectif.map((f) => [f.id, "A" as Choix])),
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
    if (!clubId || !club) return;
    if (equipeA.length === 0 || equipeB.length === 0) {
      return setErreur("Il faut au moins un joueur dans chaque équipe.");
    }
    setEnvoi(true);
    setErreur(null);
    try {
      const matchId = await local.createMatch({
        clubId,
        kind: "INTERNAL",
        teamAName: nomA,
        teamBName: nomB,
        teamA: equipeA.map((p) => ({ playerId: p.id, isGk: p.isGk })),
        teamB: equipeB.map((p) => ({ playerId: p.id, isGk: p.isGk })),
      });
      // Le match existe déjà sur l'appareil : on part à l'écran de jeu sans
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
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={[s.retour, { color: t.i2 }]}>‹ Retour</Text>
          </Pressable>
        </View>

        <Text style={[s.titre, { color: t.ink }]}>Qui joue ?</Text>

        {occupe && effectif.length === 0 && (
          <View style={s.centre}>
            <ActivityIndicator color={t.ink} />
            <Text style={[s.aide, { color: t.i2 }]}>On va chercher l'effectif…</Text>
          </View>
        )}

        {erreur && <Text style={[s.erreur, { color: t.bad ?? "#ff453a" }]}>{erreur}</Text>}

        {effectif.length > 0 && (
          <>
            <Carte t={t} style={{ gap: 0, paddingVertical: 6 }}>
              <View style={s.enteteListe}>
                <Text style={[s.aide, { color: t.i2 }]}>
                  {retenus.length} sur {effectif.length} · tape : aucun → {nomA} → {nomB}
                </Text>
                <Pressable onPress={tousOuAucun} hitSlop={10}>
                  <Text style={[s.lien, { color: t.ink }]}>
                    {retenus.length === effectif.length ? "Personne" : "Tous"}
                  </Text>
                </Pressable>
              </View>
              {effectif.map((f, i) => {
                const c = choix[f.id] ?? "aucun";
                const couleur = c === "A" ? couleurA : c === "B" ? couleurB : undefined;
                const anneau =
                  c === "A" ? (t.taR ?? couleurA) : c === "B" ? (t.tbR ?? couleurB) : undefined;
                return (
                  <Pressable
                    key={f.id}
                    onPress={() => tourner(f.id)}
                    style={[
                      s.rangee,
                      i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.sep },
                    ]}
                  >
                    <Avatar nom={f.name} photo={f.photo} t={t} anneau={anneau} taille={36} />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          s.nom,
                          { color: c === "aucun" ? t.i2 : t.ink, fontWeight: c === "aucun" ? "400" : "700" },
                        ]}
                        numberOfLines={1}
                      >
                        {f.name}
                        {f.isGuest ? " (inv.)" : ""}
                        {f.isGk ? " · gardien" : ""}
                      </Text>
                      <Text style={[s.sousNom, { color: t.i3 }]}>Niveau {f.skill}</Text>
                    </View>
                    <Text style={[s.valeur, { color: couleur ? t.ink : t.i3 }]}>
                      {c === "aucun" ? "—" : c === "A" ? nomA : nomB}
                    </Text>
                  </Pressable>
                );
              })}
            </Carte>

            {retenus.length >= 2 && (
              <Carte t={t} titre="Équipes équilibrées">
                <Text style={[s.aide, { color: t.i2, textAlign: "center" }]}>
                  Répartit les {retenus.length} sélectionnés selon leur niveau, gardiens séparés.
                </Text>
                <View style={{ height: 12 }} />
                <BoutonVerre
                  t={t}
                  titre={tire ? "Retirer au sort" : "Équilibrer"}
                  onPress={equilibrer}
                />
                {equipeA.length > 0 && equipeB.length > 0 && (
                  <Text style={[s.recap, { color: t.i2 }]}>
                    {nomA} {equipeA.length} · vs · {nomB} {equipeB.length}
                  </Text>
                )}
              </Carte>
            )}

            <Carte t={t} titre="Ajouter un invité">
              <Champ
                t={t}
                libelle="Nom de l'invité"
                value={nomInvite}
                onChangeText={setNomInvite}
                placeholder="Le cousin de Bakary"
                autoCapitalize="words"
                onSubmitEditing={ajouterInvite}
                returnKeyType="done"
              />
              <View style={{ height: 12 }} />
              <BoutonVerre t={t} titre="+ Invité" onPress={ajouterInvite} />
            </Carte>

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

function versFiches(
  serveur: {
    id: string;
    name: string;
    skill: number;
    isGk: boolean;
    photo: string | null;
    isGuest: boolean;
    abonne: boolean;
  }[],
): Fiche[] {
  return serveur.map((p) => ({
    id: p.id,
    name: p.name,
    skill: p.skill,
    isGk: p.isGk,
    photo: p.photo,
    isGuest: p.isGuest,
    abonne: p.abonne,
  }));
}

const s = StyleSheet.create({
  contenu: { padding: 14, paddingTop: 10, paddingBottom: 40, gap: 14 },
  barre: { flexDirection: "row", alignItems: "center" },
  retour: { fontSize: 17 },
  titre: { fontSize: 28, fontWeight: "700", letterSpacing: -0.4 },
  centre: { paddingTop: 80, alignItems: "center", gap: 12 },
  aide: { fontSize: 15 },
  erreur: { fontSize: 15, textAlign: "center" },
  lien: { fontSize: 15, fontWeight: "600" },
  enteteListe: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  rangee: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    paddingVertical: 8,
  },
  nom: { fontSize: 17 },
  sousNom: { fontSize: 13 },
  valeur: { fontSize: 15, fontWeight: "600" },
  recap: { fontSize: 15, textAlign: "center", paddingTop: 10 },
  attente: { height: 52, alignItems: "center", justifyContent: "center" },
});
