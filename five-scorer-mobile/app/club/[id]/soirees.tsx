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
import { JETONS_NEUTRES, type Jetons } from "../../../lib/couleurs";
import {
  chargerMoi,
  chargerSoirees,
  SessionExpiree,
  type ClubDeMoi,
  type EcranSoirees,
  type GroupeMois,
  type LigneSoiree,
} from "../../../lib/api";

/// « Les soirées » — le calendrier du club, repris de la page du site.
///
/// Trois blocs : les six prochaines, le reste de la saison sous un dépliant,
/// et les soirées déjà jouées. Chacun groupé par mois dans une carte de verre.
///
/// Une rangée à venir dit ce qu'il faut savoir avant de venir — le jour,
/// l'heure, le lieu, combien on est. Une rangée passée dit ce qu'il en reste —
/// le nombre de matchs, les buts, et ce qu'il y a à encaisser.
export default function Soirees() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const [club, setClub] = useState<ClubDeMoi | null>(null);
  const [donnees, setDonnees] = useState<EcranSoirees | null>(null);
  const [resteOuvert, setResteOuvert] = useState(false);
  const [occupe, setOccupe] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const t: Jetons = club?.theme.sombre ?? JETONS_NEUTRES;
  const couleurA = club?.couleurA ?? "#ffffff";
  const couleurB = club?.couleurB ?? "#111111";

  const charger = useCallback(async () => {
    if (!id) return;
    setErreur(null);
    try {
      const [moi, s] = await Promise.all([chargerMoi(), chargerSoirees(id)]);
      setClub(moi.clubs.find((c) => c.id === id) ?? null);
      setDonnees(s);
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
        <View>
          <Text style={[s.kicker, { color: t.i2 }]}>Calendrier</Text>
          <Text style={[s.titre, { color: t.ink }]}>Les soirées</Text>
          <Text style={[s.chapeau, { color: t.i2 }]}>
            Un créneau de terrain, les présents, et les matchs qui en sortent.
          </Text>
        </View>

        {occupe && !donnees && (
          <View style={s.centre}>
            <ActivityIndicator color={t.ink} />
            <Text style={[s.aide, { color: t.i2 }]}>On va chercher le calendrier…</Text>
          </View>
        )}
        {erreur && <Text style={[s.erreur, { color: "#ff453a" }]}>{erreur}</Text>}

        {donnees?.vide && (
          <View style={s.centre}>
            <Text style={[s.aide, { color: t.ink, fontSize: 17 }]}>
              Aucune soirée pour l'instant.
            </Text>
            <Text style={[s.aide, { color: t.i2, textAlign: "center" }]}>
              Une soirée, c'est un créneau de terrain : la date, le lieu, et qui vient.
              Les matchs se rangent dessous.
            </Text>
          </View>
        )}

        {/* « À venir » ne coiffe que la première carte : les suivantes portent
            leur mois, sinon trois cartes de suite répètent le même mot et on
            ne sait plus ce qu'on regarde. */}
        {donnees?.prochaines.map((g, i) => (
          <CarteMois
            key={"p" + g.cle}
            g={g}
            t={t}
            titre={i === 0 ? "À venir" : undefined}
            clubId={id}
          />
        ))}

        {donnees && donnees.resteTotal > 0 && (
          <>
            <Pressable onPress={() => setResteOuvert((o) => !o)} style={s.deplier}>
              <Text style={[s.deplierTexte, { color: t.i2 }]}>
                {resteOuvert ? "Masquer" : "Le reste de la saison"} ({donnees.resteTotal})
              </Text>
            </Pressable>
            {resteOuvert &&
              donnees.reste.map((g) => <CarteMois key={"r" + g.cle} g={g} t={t} clubId={id} />)}
          </>
        )}

        {donnees && donnees.passees.length > 0 && (
          <Text style={[s.section, { color: t.i2 }]}>Déjà jouées</Text>
        )}
        {donnees?.passees.map((g) => (
          <CarteMois key={"j" + g.cle} g={g} t={t} clubId={id} />
        ))}
      </ScrollView>
    </Ecran>
  );
}

function CarteMois({
  g,
  t,
  titre,
  clubId,
}: {
  g: GroupeMois;
  t: Jetons;
  titre?: string;
  clubId: string;
}) {
  return (
    <View style={[s.carte, { borderColor: t.cb, backgroundColor: t.cdSolid }]}>
      <View style={s.carteTete}>
        <Text style={[s.kicker, { color: t.i2 }]}>{titre ?? capitale(g.titre)}</Text>
        <Text style={[s.petitCompte, { color: t.i3 }]}>{g.compte}</Text>
      </View>
      {g.soirees.map((so, i) => (
        <Rangee key={so.id} so={so} t={t} premiere={i === 0} clubId={clubId} />
      ))}
    </View>
  );
}

function Rangee({
  so,
  t,
  premiere,
  clubId,
}: {
  so: LigneSoiree;
  t: Jetons;
  premiere: boolean;
  clubId: string;
}) {
  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: "/soiree/[id]", params: { id: so.id, clubId } })
      }
      style={({ pressed }) => [
        s.rangee,
        !premiere && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.sep },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text
        style={[
          s.jour,
          { color: t.i2 },
          so.annulee && { textDecorationLine: "line-through" },
        ]}
        numberOfLines={1}
      >
        {so.jour}
      </Text>

      {so.aVenir ? (
        <>
          <Text style={[s.milieu, { color: t.ink }]}>{so.heure}</Text>
          <Text style={[s.reste, { color: t.i2 }]} numberOfLines={1}>
            {so.annulee
              ? `Annulée${so.motifAnnulation ? ` · ${so.motifAnnulation}` : ""}`
              : [so.lieu ?? so.libelle, so.presents > 0 ? `${so.presents} présent${so.presents > 1 ? "s" : ""}` : null]
                  .filter(Boolean)
                  .join(" · ")}
          </Text>
        </>
      ) : (
        <>
          <Text style={[s.milieu, { color: t.ink }]}>
            {so.matchs} match{so.matchs > 1 ? "s" : ""}
          </Text>
          <Text style={[s.reste, { color: t.i2 }]} numberOfLines={1}>
            {so.buts > 0 ? `${so.buts} but${so.buts > 1 ? "s" : ""}` : ""}
            {so.buts > 0 && so.prix ? " · " : ""}
            {so.prix ? (
              <Text style={{ color: so.toutRegle ? t.i3 : "#ffd60a" }}>
                {so.prix} {so.toutRegle ? "réglé" : "à encaisser"}
              </Text>
            ) : null}
          </Text>
        </>
      )}
    </Pressable>
  );
}

/// « septembre 2026 » → « Septembre 2026 ». Intl rend le mois en minuscule en
/// français ; un titre de carte commence par une capitale.
function capitale(x: string): string {
  return x.charAt(0).toUpperCase() + x.slice(1);
}

const s = StyleSheet.create({
  contenu: { paddingHorizontal: 14, paddingTop: 16, paddingBottom: 40, gap: 18 },
  kicker: { fontSize: 15, fontWeight: "600" },
  titre: { fontSize: 28, fontWeight: "700", letterSpacing: -0.4, marginTop: 4 },
  chapeau: { fontSize: 14, lineHeight: 20, marginTop: 6 },
  section: { fontSize: 15, fontWeight: "600", marginTop: 4 },

  centre: { paddingTop: 60, alignItems: "center", gap: 12, paddingHorizontal: 20 },
  aide: { fontSize: 15 },
  erreur: { fontSize: 15, textAlign: "center" },

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
  rangee: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56 },
  jour: { width: 72, fontSize: 15 },
  milieu: { fontSize: 17, fontWeight: "600", minWidth: 72 },
  reste: { flex: 1, fontSize: 15 },

  deplier: { paddingVertical: 6, alignItems: "center" },
  deplierTexte: { fontSize: 15, fontWeight: "600" },
});
