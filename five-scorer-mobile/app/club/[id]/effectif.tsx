import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Alert } from "react-native";
import { router, useFocusEffect, useGlobalSearchParams } from "expo-router";
import Ecran from "../../../composants/Ecran";
import { Avatar, BoutonRond, BoutonVerre } from "../../../composants/base";
import Etoiles from "../../../composants/Etoiles";
import { JETONS_NEUTRES, type Jetons } from "../../../lib/couleurs";
import {
  chargerEcranEffectif,
  chargerMoi,
  modifierJoueur,
  revendiquerJoueur,
  SessionExpiree,
  type ClubDeMoi,
  type EcranEffectif,
} from "../../../lib/api";

/// « Effectif » — le vestiaire du club.
///
/// Une carte, une rangée par joueur : l'avatar, le nom, les cinq étoiles du
/// niveau, ses matchs et ses buts. Les chiffres sont ceux de TOUTES les
/// saisons — le vestiaire raconte une carrière, pas un exercice.
///
/// Les archivés vivent sous un repli, avec leurs rangées plus basses et leur
/// encre atténuée : ce sont ceux qui ne jouent plus, ils ne doivent pas
/// encombrer la liste de ceux qui viennent lundi.
export default function Effectif() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const [club, setClub] = useState<ClubDeMoi | null>(null);
  const [donnees, setDonnees] = useState<EcranEffectif | null>(null);
  const [archivesOuverts, setArchivesOuverts] = useState(false);
  const [occupe, setOccupe] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const t: Jetons = club?.theme.sombre ?? JETONS_NEUTRES;

  const charger = useCallback(async () => {
    if (!id) return;
    setErreur(null);
    try {
      const [moi, e] = await Promise.all([chargerMoi(), chargerEcranEffectif(id)]);
      setClub(moi.clubs.find((c) => c.id === id) ?? null);
      setDonnees(e);
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

  /// « C'est moi » : je récupère mon historique de joueur.
  ///
  /// Le geste du nouveau membre. Il rejoint le club par un lien, et sa fiche
  /// est déjà là — quinze matchs sous son prénom, créés par le capitaine avant
  /// qu'il n'ait un compte. Sans ce bouton il repart de zéro à côté de sa
  /// propre histoire.
  const revendiquer = (joueurId: string, nom: string) => {
    if (!id) return;
    Alert.alert(
      `${nom}, c'est toi ?`,
      "Ta fiche et tout son historique — matchs, buts, votes — seront rattachés à ton compte.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Oui, c'est moi",
          onPress: () => {
            void revendiquerJoueur(id, joueurId)
              .then(charger)
              .catch((e: Error) => setErreur(e.message));
          },
        },
      ],
    );
  };

  const reactiver = (joueurId: string, nom: string) => {
    if (!id) return;
    Alert.alert(
      `Réactiver ${nom} ?`,
      "Il revient dans la liste de ceux qui viennent lundi.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Réactiver",
          onPress: () => {
            void modifierJoueur(id, joueurId, { archive: false })
              .then(charger)
              .catch((e: Error) => setErreur(e.message));
          },
        },
      ],
    );
  };

  const actifs = (donnees?.joueurs ?? []).filter((j) => !j.archive);
  const archives = (donnees?.joueurs ?? []).filter((j) => j.archive);

  return (
    <Ecran t={t} chasubles={{ a: club?.couleurA ?? "#fff", b: club?.couleurB ?? "#111" }}>
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
        {/* Le retour, comme sur la barre du site : cet écran s'atteint par le
            menu, pas par un onglet — sans lui on ne saurait pas d'où on vient
            ni comment revenir. */}
        <View style={s.retour}>
          <BoutonRond
            t={t}
            symbole="‹"
            etiquette="Retour"
            onPress={() =>
              router.canGoBack()
                ? router.back()
                : router.replace({ pathname: "/club/[id]", params: { id } })
            }
          />
        </View>
        <Text style={[s.titre, { color: t.ink }]}>Effectif</Text>
        {donnees && <Text style={[s.sousTitre, { color: t.i2 }]}>{donnees.sousTitre}</Text>}

        {occupe && !donnees && (
          <View style={s.centre}>
            <ActivityIndicator color={t.ink} />
            <Text style={[s.aide, { color: t.i2 }]}>On va chercher le vestiaire…</Text>
          </View>
        )}
        {erreur && <Text style={[s.erreur, { color: "#ff453a" }]}>{erreur}</Text>}

        {donnees?.peutGerer && (
          <View style={{ paddingTop: 4 }}>
            <BoutonVerre
              t={t}
              titre="Ajouter un joueur"
              onPress={() =>
                router.push({ pathname: "/joueur/fiche", params: { clubId: id } })
              }
            />
          </View>
        )}

        {actifs.length > 0 && (
          <View style={[s.carte, { borderColor: t.cb, backgroundColor: t.cdSolid }]}>
            {actifs.map((j, i) => (
              <Rangee
                key={j.id}
                j={j}
                t={t}
                premiere={i === 0}
                clubId={id}
                // « C'est moi » ne s'affiche que sur une fiche revendiquable :
                // libre, pas un invité, et seulement si je n'ai pas déjà la
                // mienne. Ces trois conditions sont le SEUL garde-fou côté
                // site aussi — la règle serveur, elle, laisse passer un
                // gérant. On les reproduit exactement.
                revendiquable={
                  !donnees?.aDejaUnProfil && !j.compteLie && !j.invite
                }
                onRevendiquer={() => revendiquer(j.id, j.nom)}
              />
            ))}
          </View>
        )}

        {archives.length > 0 && (
          <>
            <Pressable onPress={() => setArchivesOuverts((o) => !o)} style={s.deplier}>
              <Text style={[s.deplierTexte, { color: t.i2 }]}>
                {archivesOuverts ? "Masquer les archivés" : `Archivés (${archives.length})`}
              </Text>
            </Pressable>
            {archivesOuverts && (
              <View style={[s.carte, { borderColor: t.cb, backgroundColor: t.cdSolid }]}>
                {archives.map((j, i) => (
                  <Rangee
                    key={j.id}
                    j={j}
                    t={t}
                    premiere={i === 0}
                    clubId={id}
                    petite
                    onReactiver={
                      donnees?.peutGerer ? () => reactiver(j.id, j.nom) : undefined
                    }
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </Ecran>
  );
}

function Rangee({
  j,
  t,
  premiere,
  clubId,
  petite,
  revendiquable,
  onRevendiquer,
  onReactiver,
}: {
  j: EcranEffectif["joueurs"][number];
  t: Jetons;
  premiere: boolean;
  clubId: string;
  petite?: boolean;
  revendiquable?: boolean;
  onRevendiquer?: () => void;
  onReactiver?: () => void;
}) {
  const encre = petite ? t.i2 : t.ink;
  return (
    <View
      style={[
        !premiere && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.sep },
      ]}
    >
      <Pressable
        onPress={() => router.push({ pathname: "/joueur/[id]", params: { id: j.id, clubId } })}
        style={({ pressed }) => [s.rangee, petite && s.rangeePetite, pressed && { opacity: 0.7 }]}
      >
        <Avatar nom={j.nom} photo={j.photo} t={t} taille={petite ? 34 : 44} />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <View style={s.ligneNom}>
            <Text style={[s.nom, { color: encre }]} numberOfLines={1}>
              {j.nom}
            </Text>
            {/* Un archivé ne montre ni son poste, ni son niveau, ni ses
                chiffres, ni de chevron : il ne joue plus. Le site le dépouille
                pareil — une rangée archivée qui garde tout n'est qu'une
                rangée grisée, et l'œil la relit comme les autres. */}
            {!petite && j.gardien && <Text style={[s.gant, { color: t.i3 }]}>· gardien</Text>}
            {!petite && j.compteLie && <View style={s.pointLie} />}
          </View>
          {!petite && (
            <View style={s.sousLigne}>
              <Etoiles niveau={j.niveau} couleur={t.i2} />
              <Text style={[s.chiffres, { color: t.i2 }]} numberOfLines={1}>
                {j.matchs} match{j.matchs > 1 ? "s" : ""} · {j.buts} but
                {j.buts > 1 ? "s" : ""}
                {j.invite ? " · invité" : ""}
              </Text>
            </View>
          )}
        </View>
        {!petite && <Text style={[s.chevron, { color: t.i3 }]}>›</Text>}
      </Pressable>

      {/* Les outils sous la rangée, alignés sur le texte : ce sont des gestes
          rares — deux fois par saison — et ils n'ont pas à disputer la place
          au nom, qu'on lit toutes les semaines. */}
      {(revendiquable || onReactiver) && (
        <View style={[s.outils, petite && { paddingLeft: 46 }]}>
          {revendiquable && onRevendiquer && (
            <Pressable
              onPress={onRevendiquer}
              style={({ pressed }) => [s.outil, { borderColor: t.cb }, pressed && { opacity: 0.6 }]}
            >
              <Text style={[s.outilTexte, { color: t.ink }]}>C&apos;est moi</Text>
            </Pressable>
          )}
          {onReactiver && (
            <Pressable
              onPress={onReactiver}
              style={({ pressed }) => [s.outil, { borderColor: t.cb }, pressed && { opacity: 0.6 }]}
            >
              <Text style={[s.outilTexte, { color: t.ink }]}>Réactiver</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  contenu: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 40 },
  retour: { flexDirection: "row", paddingBottom: 12 },
  titre: { fontSize: 34, fontWeight: "700", letterSpacing: -0.5, paddingHorizontal: 4 },
  sousTitre: { fontSize: 17, marginTop: 6, paddingHorizontal: 4, paddingBottom: 14 },
  centre: { paddingTop: 60, alignItems: "center", gap: 12 },
  aide: { fontSize: 15 },
  erreur: { fontSize: 15, textAlign: "center" },

  carte: { borderRadius: 28, borderWidth: 1, paddingHorizontal: 16, marginTop: 16 },
  rangee: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64 },
  rangeePetite: { minHeight: 52 },
  outils: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingLeft: 56, paddingBottom: 12 },
  outil: { height: 34, borderRadius: 17, borderWidth: 1, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" },
  outilTexte: { fontSize: 15, fontWeight: "600" },
  ligneNom: { flexDirection: "row", alignItems: "center", gap: 6 },
  nom: { fontSize: 17, fontWeight: "600", flexShrink: 1 },
  gant: { fontSize: 13 },
  pointLie: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#30d158" },
  sousLigne: { flexDirection: "row", alignItems: "center", gap: 10 },
  chiffres: { fontSize: 13, flexShrink: 1 },
  chevron: { fontSize: 20 },

  deplier: { paddingVertical: 14, alignItems: "center" },
  deplierTexte: { fontSize: 15, fontWeight: "600" },
});
