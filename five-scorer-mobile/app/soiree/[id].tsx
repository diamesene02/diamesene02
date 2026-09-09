import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useGlobalSearchParams, useLocalSearchParams } from "expo-router";
import Ecran from "../../composants/Ecran";
import { Avatar, BoutonRond, EcussonChasuble } from "../../composants/base";
import { JETONS_NEUTRES, type Jetons } from "../../lib/couleurs";
import { themeTokens } from "../../lib/noyau/theme";
import {
  chargerSoiree,
  repondrePresence,
  SessionExpiree,
  type FicheSoiree,
  type StatutReponse,
} from "../../lib/api";

/// La fiche d'une soirée — l'écran-pivot du lundi.
///
/// Avant : qui vient, quelles équipes, qui a payé le terrain. Après : le
/// bilan, le mot à coller dans le groupe, les matchs, les cracks du soir.
///
/// L'ORDRE des cartes bascule : dès qu'un match existe, les résultats passent
/// devant la préparation. Avant le coup d'envoi la question est « qui vient » ;
/// après, c'est « qu'est-ce qui s'est passé ».
///
/// Tout arrive fait du serveur — libellés, comptes, listes de buteurs, et le
/// mot lui-même. L'app ne formate rien : le moteur JavaScript de React Native
/// n'embarque pas les fuseaux horaires.
export default function Soiree() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { clubId } = useGlobalSearchParams<{ clubId?: string }>();
  const [fiche, setFiche] = useState<FicheSoiree | null>(null);
  const [club, setClub] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    if (!id) return;
    setErreur(null);
    try {
      // Le club vient du paramètre quand on arrive depuis la liste ; sinon on
      // le retrouve par /api/me — un lien partagé n'a pas de contexte.
      const { chargerMoi } = await import("../../lib/api");
      const cid = clubId ?? (await chargerMoi()).clubs[0]?.id;
      if (!cid) throw new Error("Aucun club.");
      setClub(cid);
      setFiche(await chargerSoiree(cid, id));
    } catch (e) {
      if (e instanceof SessionExpiree) return router.replace("/connexion");
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setOccupe(false);
    }
  }, [id, clubId]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const couleurA = fiche?.chasubles.a.couleur ?? "#ffffff";
  const couleurB = fiche?.chasubles.b.couleur ?? "#111111";
  const t: Jetons = fiche ? themeTokens(couleurA, couleurB, "dark") : JETONS_NEUTRES;

  async function repondre(statut: StatutReponse) {
    if (!fiche?.presences.monPlayerId || !club || !id) return;
    setEnvoi(true);
    try {
      await repondrePresence(club, id, fiche.presences.monPlayerId, statut);
      await charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setEnvoi(false);
    }
  }

  async function partagerLeMot() {
    if (!fiche?.mot) return;
    // Le partage natif ouvre WhatsApp directement — c'est là que le mot va,
    // tous les mardis matin.
    await Share.share({ message: fiche.mot }).catch(() => {});
  }

  const presences = fiche && (
    <View style={[s.carte, { borderColor: t.cb, backgroundColor: t.cdSolid }]}>
      <Text style={[s.carteTitre, { color: t.ink }]}>{fiche.presences.titre}</Text>
      <Text style={[s.phrase, { color: t.i2 }]}>{fiche.presences.phrase}</Text>

      {fiche.presences.monPlayerId && !fiche.passee && (
        <View style={s.reponses}>
          {(
            [
              ["IN", "Je viens"],
              ["MAYBE", "Peut-être"],
              ["OUT", "Pas là"],
            ] as const
          ).map(([v, l]) => {
            const actif = fiche.presences.maReponse === v;
            return (
              <Pressable
                key={v}
                onPress={() => void repondre(v)}
                disabled={envoi}
                style={[
                  s.reponse,
                  actif
                    ? { backgroundColor: t.bt ?? "#fff", borderColor: "transparent" }
                    : { borderColor: t.cb, backgroundColor: t.seg },
                ]}
              >
                <Text
                  style={[s.reponseTexte, { color: actif ? (t.bf ?? "#111") : t.ink }]}
                  numberOfLines={1}
                >
                  {l}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {fiche.terrain.resume && (
        <Text style={[s.phrase, { color: t.i2, paddingTop: 10 }]}>{fiche.terrain.resume}</Text>
      )}

      {fiche.presences.lignes.map((l, i) => (
        <View
          key={l.playerId}
          style={[s.rangee, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.sep }]}
        >
          <Avatar
            nom={l.nom}
            photo={l.photo}
            t={t}
            anneau={l.camp === "A" ? (t.taR ?? couleurA) : l.camp === "B" ? (t.tbR ?? couleurB) : undefined}
            taille={32}
          />
          <Text style={[s.nomLigne, { color: l.moi ? t.ink : t.i2 }]} numberOfLines={1}>
            {l.nom}
            {l.moi ? " · moi" : ""}
            {l.viaAbonnement ? " · abonné" : ""}
          </Text>
          <Text style={[s.statut, { color: tonCouleur(l.ton, t) }]}>{l.libelle}</Text>
        </View>
      ))}
    </View>
  );

  const resultats = fiche?.bilan && (
    <View style={[s.carte, { borderColor: t.cb, backgroundColor: t.cdSolid }]}>
      <Text style={[s.carteTitre, { color: t.ink }]}>
        Bilan{fiche.bilan.enCours ? " · en cours" : ""}
      </Text>
      <View style={s.bilan}>
        <View style={s.bilanCote}>
          <EcussonChasuble couleur={couleurA} lettre={fiche.chasubles.a.lettre} taille={56} />
          <Text style={[s.bilanChiffre, { color: t.ink }]}>{fiche.bilan.victoiresA}</Text>
          <Text style={[s.bilanUnite, { color: t.i3 }]}>{fiche.bilan.uniteA}</Text>
        </View>
        <View style={s.bilanCote}>
          <EcussonChasuble couleur={couleurB} lettre={fiche.chasubles.b.lettre} taille={56} />
          <Text style={[s.bilanChiffre, { color: t.ink }]}>{fiche.bilan.victoiresB}</Text>
          <Text style={[s.bilanUnite, { color: t.i3 }]}>{fiche.bilan.uniteB}</Text>
        </View>
      </View>
      <Text style={[s.phrase, { color: t.i2, textAlign: "center" }]}>{fiche.bilan.resume}</Text>
      {(fiche.bilan.buteur || fiche.bilan.mvp) && (
        <Text style={[s.phrase, { color: t.i3, textAlign: "center", paddingTop: 4 }]}>
          {fiche.bilan.buteur ? `Buteur : ${fiche.bilan.buteur.nom} (${fiche.bilan.buteur.buts})` : ""}
          {fiche.bilan.buteur && fiche.bilan.mvp ? " · " : ""}
          {fiche.bilan.mvp ? `Homme du match : ${fiche.bilan.mvp.nom}` : ""}
        </Text>
      )}
    </View>
  );

  return (
    <Ecran t={t} chasubles={{ a: couleurA, b: couleurB }}>
      <View style={s.barre}>
        <BoutonRond t={t} symbole="‹" etiquette="Retour" onPress={() => router.back()} />
      </View>

      <ScrollView
        contentContainerStyle={s.contenu}
        refreshControl={
          <RefreshControl refreshing={occupe && fiche != null} onRefresh={charger} tintColor={t.i2} />
        }
      >
        {occupe && !fiche && (
          <View style={s.centre}>
            <ActivityIndicator color={t.ink} />
            <Text style={[s.phrase, { color: t.i2 }]}>Un instant…</Text>
          </View>
        )}
        {erreur && <Text style={[s.erreur, { color: "#ff453a" }]}>{erreur}</Text>}

        {fiche && (
          <>
            <View>
              <Text style={[s.titre, { color: t.ink }]}>{fiche.dateLabel}</Text>
              <Text style={[s.phrase, { color: t.i2, paddingTop: 4 }]}>{fiche.sousTitre}</Text>
              {fiche.notes && (
                <Text style={[s.phrase, { color: t.i3, paddingTop: 6 }]}>{fiche.notes}</Text>
              )}
              {fiche.annulee && <Text style={[s.annulee]}>Soirée annulée</Text>}
            </View>

            {/* Dès qu'un match existe, les résultats passent devant la
                préparation : la question n'est plus « qui vient » mais
                « qu'est-ce qui s'est passé ». */}
            {fiche.commencee ? (
              <>
                {resultats}
                {presences}
              </>
            ) : (
              presences
            )}

            {fiche.mot && (
              <View style={[s.carte, { borderColor: t.cb, backgroundColor: t.cdSolid }]}>
                <Text style={[s.carteTitre, { color: t.ink }]}>Le mot de la soirée</Text>
                <Text style={[s.mot, { color: t.i2 }]}>{fiche.mot}</Text>
                <Pressable
                  onPress={partagerLeMot}
                  style={[s.partager, { borderColor: t.cb, backgroundColor: t.seg }]}
                >
                  <Text style={{ color: t.ink, fontSize: 15, fontWeight: "600" }}>Partager</Text>
                </Pressable>
              </View>
            )}

            {fiche.matchs.length > 0 && (
              <View style={[s.carte, { borderColor: t.cb, backgroundColor: t.cdSolid }]}>
                <Text style={[s.carteTitre, { color: t.ink }]}>Les matchs</Text>
                {fiche.matchs.map((m, i) => (
                  <Pressable
                    key={m.id}
                    onPress={() =>
                      router.push(
                        m.direct
                          ? { pathname: "/match/[id]", params: { id: m.id } }
                          : { pathname: "/recap/[id]", params: { id: m.id, clubId: club ?? "" } },
                      )
                    }
                    style={({ pressed }) => [
                      s.match,
                      i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.sep },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <View style={s.matchTete}>
                      <Text style={[s.matchHeure, { color: t.i2 }]}>{m.heure}</Text>
                      <Text style={[s.matchScore, { color: t.ink }]}>
                        {m.nomA} {m.aVenir ? "·" : m.scoreA} – {m.aVenir ? "·" : m.scoreB} {m.nomB}
                      </Text>
                      <Text style={[s.matchEtat, { color: m.direct ? "#ff453a" : t.i3 }]}>
                        {m.etat}
                      </Text>
                    </View>
                    {m.pied && (
                      <Text style={[s.matchPied, { color: t.i3 }]} numberOfLines={2}>
                        {m.pied}
                      </Text>
                    )}
                  </Pressable>
                ))}
              </View>
            )}

            {fiche.cracks.length > 0 && (
              <View style={[s.carte, { borderColor: t.cb, backgroundColor: t.cdSolid }]}>
                <Text style={[s.carteTitre, { color: t.ink }]}>Les cracks du soir</Text>
                {fiche.cracks.map((c, i) => (
                  <View
                    key={c.playerId}
                    style={[s.rangee, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.sep }]}
                  >
                    <Text style={[s.rang, { color: t.i3 }]}>{c.rang}</Text>
                    <Avatar nom={c.nom} photo={c.photo} t={t} taille={28} />
                    <Text style={[s.nomLigne, { color: t.ink }]} numberOfLines={1}>
                      {c.nom}
                      {c.invite ? " (inv.)" : ""}
                    </Text>
                    <Text style={[s.chiffre, { color: t.i2 }]}>{c.buts} b</Text>
                    <Text style={[s.chiffre, { color: t.ink, fontWeight: "700" }]}>{c.points}</Text>
                  </View>
                ))}
              </View>
            )}

            {fiche.terrain.visible && fiche.terrain.prix && (
              <View style={[s.carte, { borderColor: t.cb, backgroundColor: t.cdSolid }]}>
                <Text style={[s.carteTitre, { color: t.ink }]}>Le terrain</Text>
                <Text style={[s.phrase, { color: t.i2, textAlign: "center" }]}>
                  {fiche.terrain.encaisse} encaissés sur {fiche.terrain.prix}
                  {fiche.terrain.part ? ` · ${fiche.terrain.part} chacun` : ""}
                </Text>
                <View style={[s.jauge, { backgroundColor: t.seg }]}>
                  <View
                    style={[
                      s.jaugePleine,
                      { width: `${fiche.terrain.pourcentage}%`, backgroundColor: "#ffd60a" },
                    ]}
                  />
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </Ecran>
  );
}

function tonCouleur(ton: string, t: Jetons): string {
  if (ton === "in") return t.ink;
  if (ton === "maybe") return "#ffd60a";
  if (ton === "out") return "#ff453a";
  if (ton === "attente") return t.i2;
  return t.i3;
}

const s = StyleSheet.create({
  barre: { paddingHorizontal: 14, paddingTop: 8 },
  contenu: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 40, gap: 18 },
  centre: { paddingTop: 60, alignItems: "center", gap: 12 },
  titre: { fontSize: 28, fontWeight: "700", letterSpacing: -0.4 },
  phrase: { fontSize: 15 },
  erreur: { fontSize: 15, textAlign: "center" },
  annulee: { fontSize: 15, fontWeight: "600", color: "#ff453a", paddingTop: 6 },

  carte: {
    borderRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
  },
  carteTitre: { fontSize: 22, fontWeight: "600", textAlign: "center", paddingBottom: 10 },

  reponses: { flexDirection: "row", gap: 8, paddingTop: 4, paddingBottom: 4 },
  reponse: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  reponseTexte: { fontSize: 15, fontWeight: "600" },

  rangee: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52 },
  rang: { width: 18, fontSize: 13 },
  nomLigne: { flex: 1, fontSize: 16 },
  statut: { fontSize: 14, fontWeight: "600" },
  chiffre: { width: 40, fontSize: 14, textAlign: "right" },

  bilan: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 6 },
  bilanCote: { alignItems: "center", gap: 6 },
  bilanChiffre: { fontSize: 40, fontWeight: "800", letterSpacing: -1.5 },
  bilanUnite: { fontSize: 13 },

  mot: { fontSize: 14, lineHeight: 20, paddingBottom: 12 },
  partager: {
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  match: { paddingVertical: 12, gap: 4 },
  matchTete: { flexDirection: "row", alignItems: "center", gap: 10 },
  matchHeure: { fontSize: 14, width: 46 },
  matchScore: { flex: 1, fontSize: 16, fontWeight: "600" },
  matchEtat: { fontSize: 13, fontWeight: "600" },
  matchPied: { fontSize: 13, paddingLeft: 56 },

  jauge: { height: 8, borderRadius: 4, overflow: "hidden", marginTop: 10 },
  jaugePleine: { height: 8, borderRadius: 4 },
});
