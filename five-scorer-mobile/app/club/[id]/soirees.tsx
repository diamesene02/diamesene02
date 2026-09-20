import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { chargerMoiMemorise, useClubId, useClubMemorise } from "../../../composants/ClubCourant";
import Ecran from "../../../composants/Ecran";
import EnTeteClub from "../../../composants/EnTeteClub";
import ErreurChargement from "../../../composants/ErreurChargement";
import { BoutonPlein, CarteVerre } from "../../../composants/base";
import { IconeCalendrier, IconeJeu, IconePlus } from "../../../composants/Icones";
import { quandRelatif } from "../../../composants/soiree/logique";
import { jeton, JETONS_NEUTRES, type Jetons } from "../../../lib/couleurs";
import {
  chargerSoirees,
  SessionExpiree,
  type ClubDeMoi,
  type EcranSoirees,
  type GroupeMois,
  type LigneSoiree,
} from "../../../lib/api";

/// « Les soirées » — le calendrier du club, repris de la page du site.
///
/// Les six prochaines, puis les soirées déjà jouées, et le reste de la
/// saison replié EN BAS : un club qui pose sa saison d'un coup a quarante
/// lundis devant lui, et la soirée qu'on vient de jouer — celle dont on
/// cherche le résultat — ne doit pas se retrouver sous quarante rangées.
///
/// Une rangée à venir dit ce qu'il faut savoir avant de venir — quand, à
/// quelle heure, combien on est, où. Une rangée passée dit ce qu'il en
/// reste — les matchs, les buts, et ce qu'il y a à encaisser.
export default function Soirees() {
  const id = useClubId();
  const memo = useClubMemorise();
  const [club, setClub] = useState<ClubDeMoi | null>(null);
  const [donnees, setDonnees] = useState<EcranSoirees | null>(null);
  const [resteOuvert, setResteOuvert] = useState(false);
  const [occupe, setOccupe] = useState(true);
  const [rafraichit, setRafraichit] = useState(false);
  const [erreur, setErreur] = useState<unknown>(null);

  // Les couleurs du dernier `/api/me` dès la première image : l'écran ne
  // passe plus du gris au dégradé du club à chaque ouverture.
  const c = club ?? memo;
  const t: Jetons = c?.theme.sombre ?? JETONS_NEUTRES;

  const charger = useCallback(async () => {
    if (!id) return;
    try {
      const [moi, s] = await Promise.all([
        chargerMoiMemorise().catch(() => null),
        chargerSoirees(id),
      ]);
      if (moi) setClub(moi.clubs.find((x) => x.id === id) ?? null);
      setDonnees(s);
      setErreur(null);
    } catch (e) {
      if (e instanceof SessionExpiree) return router.replace("/connexion");
      setErreur(e);
    } finally {
      setOccupe(false);
    }
  }, [id]);

  // À chaque retour : une réponse donnée ou une soirée créée change la liste.
  useFocusEffect(
    useCallback(() => {
      void charger();
    }, [charger]),
  );

  const peutMarquer = donnees?.club.peutMarquer ?? c?.peutScorer ?? false;
  const peutGerer = donnees?.club.peutGerer ?? c?.peutGerer ?? false;
  const programmer = () =>
    router.push({ pathname: "/soiree/nouvelle", params: { clubId: id } });

  return (
    <Ecran t={t} chasubles={c ? { a: c.couleurA, b: c.couleurB } : undefined}>
      <ScrollView
        contentContainerStyle={s.defile}
        refreshControl={
          <RefreshControl
            refreshing={rafraichit}
            onRefresh={async () => {
              setRafraichit(true);
              await charger();
              setRafraichit(false);
            }}
            tintColor={t.i2}
          />
        }
      >
        <EnTeteClub t={t} club={c} />

        <View style={s.contenu}>
          <View style={s.tete}>
            <Text style={[s.kicker, { color: jeton(t, "i2") }]}>Le calendrier</Text>
            <Text style={[s.titre, { color: t.ink }]} accessibilityRole="header">
              Les soirées
            </Text>
            <Text style={[s.chapeau, { color: jeton(t, "i2") }]}>
              Un créneau réservé : une date, un terrain, qui vient.{" "}
              <Text style={{ color: t.ink }}>Les matchs se jouent dedans.</Text>
            </Text>
          </View>

          {peutMarquer && !donnees?.vide && (
            <Pressable
              onPress={programmer}
              accessibilityRole="button"
              style={({ pressed }) => [
                s.programmer,
                { borderColor: jeton(t, "gb"), backgroundColor: jeton(t, "seg") },
                pressed && { opacity: 0.7 },
              ]}
            >
              <IconePlus couleur={t.ink} taille={16} />
              <Text style={[s.programmerTexte, { color: t.ink }]}>Programmer une soirée</Text>
            </Pressable>
          )}
          {peutGerer && (
            // Poser toute la saison d'un coup : la voie normale pour un club
            // qui joue toutes les semaines. Créer les soirées une par une reste
            // possible juste au-dessus, pour les dates hors calendrier.
            <Pressable
              onPress={() => router.push({ pathname: "/calendrier", params: { clubId: id } })}
              accessibilityRole="button"
              style={({ pressed }) => [s.saison, pressed && { opacity: 0.6 }]}
            >
              <IconeCalendrier couleur={jeton(t, "i2")} taille={15} />
              <Text style={[s.saisonTexte, { color: jeton(t, "i2") }]}>Poser toute la saison</Text>
              <IconeJeu nom="chevron" couleur={jeton(t, "i2")} taille={14} />
            </Pressable>
          )}

          {erreur != null && (
            <ErreurChargement t={t} erreur={erreur} onReessayer={charger} style={s.section} />
          )}

          {occupe && !donnees && (
            // La forme de la page, pour que rien ne saute quand elle arrive.
            <View style={s.section}>
              <CarteVerre t={t} style={[s.squelette, { height: 150 }]} />
              <CarteVerre t={t} style={[s.squelette, { height: 110, marginTop: 18 }]} />
            </View>
          )}

          {donnees?.vide && (
            <CarteVerre t={t} style={[s.vide, s.section]}>
              <Text style={[s.videTitre, { color: t.ink }]}>Aucune soirée pour l&apos;instant.</Text>
              <Text style={[s.videTexte, { color: t.ink }]}>
                Une soirée, c&apos;est le créneau : jeudi 19 h, terrain 2. Tu la programmes, chacun
                dit s&apos;il vient, et tu répartis le prix du terrain entre les présents.
              </Text>
              <Text style={[s.videTexte, { color: jeton(t, "i2"), marginTop: 12 }]}>
                Les matchs, eux, se jouent dedans — et souvent plusieurs dans la même soirée. Ce
                sont eux qui portent les scores et les statistiques.
              </Text>
              {peutMarquer && (
                <BoutonPlein
                  t={t}
                  titre="Programmer une soirée"
                  icone={<IconePlus couleur={jeton(t, "bf")} taille={18} />}
                  onPress={programmer}
                  style={{ marginTop: 20, alignSelf: "stretch" }}
                />
              )}
            </CarteVerre>
          )}

          {donnees && donnees.prochaines.length > 0 && (
            <View style={s.section}>
              <Text style={[s.kicker, s.kickerSection, { color: jeton(t, "i2") }]}>À venir</Text>
              {donnees.prochaines.map((g) => (
                <CarteMois key={"p" + g.cle} g={g} t={t} clubId={id} />
              ))}
            </View>
          )}

          {donnees && donnees.passees.length > 0 && (
            <View style={s.section}>
              <Text style={[s.kicker, s.kickerSection, { color: jeton(t, "i2") }]}>
                Déjà jouées
              </Text>
              {donnees.passees.map((g) => (
                <CarteMois key={"j" + g.cle} g={g} t={t} clubId={id} />
              ))}
            </View>
          )}

          {donnees && donnees.resteTotal > 0 && (
            <View style={s.section}>
              <Pressable
                onPress={() => setResteOuvert((o) => !o)}
                accessibilityRole="button"
                accessibilityState={{ expanded: resteOuvert }}
                style={s.deplier}
              >
                <Text style={[s.kicker, { color: jeton(t, "i2") }]}>
                  {resteOuvert ? "▾" : "▸"} Le reste de la saison ({donnees.resteTotal})
                </Text>
              </Pressable>
              {resteOuvert &&
                donnees.reste.map((g) => <CarteMois key={"r" + g.cle} g={g} t={t} clubId={id} />)}
            </View>
          )}
        </View>
      </ScrollView>
    </Ecran>
  );
}

function CarteMois({ g, t, clubId }: { g: GroupeMois; t: Jetons; clubId: string }) {
  return (
    <CarteVerre t={t} style={s.carte}>
      <View style={s.carteTete}>
        <Text style={[s.mois, { color: t.ink }]}>{capitale(g.titre)}</Text>
        <Text style={[s.petitCompte, { color: jeton(t, "i3") }]}>{g.compte}</Text>
      </View>
      {g.soirees.map((so) => (
        <Rangee key={so.id} so={so} t={t} clubId={clubId} />
      ))}
    </CarteVerre>
  );
}

function Rangee({ so, t, clubId }: { so: LigneSoiree; t: Jetons; clubId: string }) {
  const ouvrir = () => router.push({ pathname: "/soiree/[id]", params: { id: so.id, clubId } });
  const i2 = jeton(t, "i2");

  // Une soirée annulée se présentait comme les autres, et le joueur passé
  // par le menu venait pour rien.
  if (so.annulee) {
    return (
      <Pressable
        onPress={ouvrir}
        accessibilityRole="button"
        accessibilityLabel={`${so.jour}, annulée${so.motifAnnulation ? ` : ${so.motifAnnulation}` : ""}`}
        style={({ pressed }) => [s.rangee, { opacity: pressed ? 0.4 : 0.55 }]}
      >
        <Text style={[s.jour, { color: i2, textDecorationLine: "line-through" }]} numberOfLines={1}>
          {so.jour}
        </Text>
        <Text style={[s.milieu, { color: i2 }]}>Annulée</Text>
        <Text style={[s.reste, { color: i2 }]} numberOfLines={1}>
          {so.motifAnnulation ?? so.lieu ?? ""}
        </Text>
      </Pressable>
    );
  }

  if (so.aVenir) {
    // Le plus utile d'abord, le lieu en dernier : c'est toujours le même, et
    // c'est lui que l'ellipse doit manger.
    const relatif = quandRelatif(so.date);
    const lieu = so.lieu ?? so.libelle;
    const morceaux = [
      relatif ? (
        <Text key="q" style={{ color: t.ink }}>
          {relatif}
        </Text>
      ) : null,
      so.presents > 0 ? (
        <Text key="p" style={{ color: t.taInk ?? i2 }}>
          {so.presents} présent{so.presents > 1 ? "s" : ""}
        </Text>
      ) : null,
      lieu ? <Text key="l">{lieu}</Text> : null,
    ].filter(Boolean);
    return (
      <Pressable
        onPress={ouvrir}
        accessibilityRole="button"
        style={({ pressed }) => [s.rangee, pressed && { opacity: 0.7 }]}
      >
        <Text style={[s.jour, { color: i2 }]} numberOfLines={1}>
          {so.jour}
        </Text>
        <Text style={[s.milieu, { color: t.ink }]}>{so.heure}</Text>
        <Text style={[s.reste, { color: i2 }]} numberOfLines={1}>
          {morceaux.flatMap((m, i) => (i === 0 ? [m] : [" · ", m]))}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={ouvrir}
      accessibilityRole="button"
      style={({ pressed }) => [s.rangee, pressed && { opacity: 0.7 }]}
    >
      <Text style={[s.jour, { color: i2 }]} numberOfLines={1}>
        {so.jour}
      </Text>
      <Text style={[s.milieu, { color: t.ink }]}>
        {so.matchs}
        <Text style={[s.unite, { color: jeton(t, "i3") }]}> match{so.matchs > 1 ? "s" : ""}</Text>
      </Text>
      <Text style={[s.reste, { color: i2 }]} numberOfLines={1}>
        {so.buts > 0 ? `${so.buts} but${so.buts > 1 ? "s" : ""}` : ""}
        {so.buts > 0 && so.prix ? " · " : ""}
        {so.prix ? (
          <Text style={{ color: so.toutRegle ? jeton(t, "i3") : jeton(t, "or") }}>
            {so.prix} {so.toutRegle ? "réglé" : "à encaisser"}
          </Text>
        ) : null}
      </Text>
    </Pressable>
  );
}

/// « septembre 2026 » → « Septembre 2026 ». Le serveur rend le mois en
/// minuscule ; un titre de carte commence par une capitale.
function capitale(x: string): string {
  return x.charAt(0).toUpperCase() + x.slice(1);
}

const s = StyleSheet.create({
  defile: { paddingBottom: 48 },
  contenu: { paddingHorizontal: 14 },
  tete: { paddingHorizontal: 4, paddingTop: 16 },
  kicker: { fontSize: 15, fontWeight: "600", letterSpacing: -0.1 },
  kickerSection: { marginBottom: 0, paddingHorizontal: 4 },
  titre: { fontSize: 28, fontWeight: "700", letterSpacing: -0.4, lineHeight: 31, marginTop: 4 },
  chapeau: { fontSize: 14, lineHeight: 20, marginTop: 6, maxWidth: 384 },
  programmer: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 20,
    marginTop: 14,
    marginLeft: 4,
  },
  programmerTexte: { fontSize: 14, fontWeight: "700" },
  saison: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    minHeight: 44,
    marginTop: 2,
    marginLeft: 4,
  },
  saisonTexte: { fontSize: 14, fontWeight: "700" },

  section: { marginTop: 32 },
  squelette: { opacity: 0.6 },

  vide: { padding: 32, alignItems: "center" },
  videTitre: { fontSize: 18, fontWeight: "900", textAlign: "center" },
  videTexte: { fontSize: 14, lineHeight: 20, textAlign: "center", marginTop: 8, maxWidth: 384 },

  carte: { marginTop: 18, paddingTop: 18, paddingHorizontal: 20, paddingBottom: 20 },
  carteTete: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10,
  },
  mois: { fontSize: 13, fontWeight: "600" },
  petitCompte: { fontSize: 13, fontVariant: ["tabular-nums"] },
  rangee: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56 },
  jour: { width: 64, fontSize: 15, fontVariant: ["tabular-nums"] },
  milieu: { fontSize: 17, fontWeight: "600", fontVariant: ["tabular-nums"] },
  unite: { fontSize: 13, fontWeight: "400" },
  reste: { flex: 1, minWidth: 0, fontSize: 15 },

  deplier: { minHeight: 44, justifyContent: "center", paddingHorizontal: 4 },
});
