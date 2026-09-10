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
import { router, useFocusEffect, useGlobalSearchParams } from "expo-router";
import Ecran from "../../../composants/Ecran";
import { Avatar, BoutonRond } from "../../../composants/base";
import Etoiles from "../../../composants/Etoiles";
import { JETONS_NEUTRES, type Jetons } from "../../../lib/couleurs";
import {
  chargerEcranEffectif,
  chargerMoi,
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

        {actifs.length > 0 && (
          <View style={[s.carte, { borderColor: t.cb, backgroundColor: t.cdSolid }]}>
            {actifs.map((j, i) => (
              <Rangee key={j.id} j={j} t={t} premiere={i === 0} clubId={id} />
            ))}
          </View>
        )}

        {/* « + Ajouter un joueur » vit SOUS la liste, pas dans la barre du
            haut : le geste courant ici est de consulter, et un nouveau arrive
            deux ou trois fois par saison. Réservé aux gérants — c'est le
            serveur qui tranche, l'écran ne fait que ne pas mentir. */}
        {donnees?.peutGerer && (
          <Pressable
            onPress={() =>
              router.push({ pathname: "/joueur/edition", params: { clubId: id } })
            }
            style={({ pressed }) => [
              s.ajouter,
              { borderColor: t.cb },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[s.ajouterTexte, { color: t.ink }]}>+ Ajouter un joueur</Text>
          </Pressable>
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
                  <Rangee key={j.id} j={j} t={t} premiere={i === 0} clubId={id} petite />
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
}: {
  j: EcranEffectif["joueurs"][number];
  t: Jetons;
  premiere: boolean;
  clubId: string;
  petite?: boolean;
}) {
  const encre = petite ? t.i2 : t.ink;
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/joueur/[id]", params: { id: j.id, clubId } })}
      style={({ pressed }) => [
        s.rangee,
        petite && { minHeight: 54 },
        !premiere && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.sep },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Avatar nom={j.nom} photo={j.photo} t={t} taille={petite ? 34 : 44} />
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <View style={s.ligneNom}>
          <Text style={[s.nom, { color: encre }]} numberOfLines={1}>
            {j.nom}
          </Text>
          {j.gardien && <Text style={[s.gant, { color: t.i3 }]}>· gardien</Text>}
          {/* Le point vert dit que quelqu'un a revendiqué ce profil : c'est ce
              qui lui permet de répondre présent depuis son téléphone. */}
          {j.compteLie && <View style={s.pointLie} />}
        </View>
        <View style={s.sousLigne}>
          <Etoiles niveau={j.niveau} couleur={t.i2} />
          <Text style={[s.chiffres, { color: t.i2 }]} numberOfLines={1}>
            {j.matchs} match{j.matchs > 1 ? "s" : ""} · {j.buts} but{j.buts > 1 ? "s" : ""}
            {j.invite ? " · invité" : ""}
          </Text>
        </View>
      </View>
      <Text style={[s.chevron, { color: t.i3 }]}>›</Text>
    </Pressable>
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
  ligneNom: { flexDirection: "row", alignItems: "center", gap: 6 },
  nom: { fontSize: 17, fontWeight: "600", flexShrink: 1 },
  gant: { fontSize: 13 },
  pointLie: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#30d158" },
  sousLigne: { flexDirection: "row", alignItems: "center", gap: 10 },
  chiffres: { fontSize: 13, flexShrink: 1 },
  chevron: { fontSize: 20 },

  ajouter: {
    marginTop: 16,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  ajouterTexte: { fontSize: 16, fontWeight: "600" },

  deplier: { paddingVertical: 14, alignItems: "center" },
  deplierTexte: { fontSize: 15, fontWeight: "600" },
});
