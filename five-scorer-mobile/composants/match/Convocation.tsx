import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar, BoutonPlein, Carte } from "../base";
import { jeton, type Jetons } from "../../lib/couleurs";
import { choix as vibrerChoix } from "../../lib/haptique";
import { messageErreur } from "../../lib/erreurs";
import { repondreConvocation, type FicheMatch, type StatutReponse } from "../../lib/api";

type Convoc = NonNullable<FicheMatch["convocation"]>;

const LIBELLES: Record<StatutReponse, string> = { IN: "Présent", MAYBE: "Peut-être", OUT: "Absent" };
/// Les mots des trois boutons : ceux de la soirée (« Je viens »), l'app
/// tutoie et répond à la première personne.
const REPONSES: [StatutReponse, string][] = [
  ["IN", "Je viens"],
  ["MAYBE", "Peut-être"],
  ["OUT", "Pas là"],
];

/// Un match PROGRAMMÉ (contre un adversaire, un soir qui n'est pas un lundi) :
/// qui est là ? La vue « convocation » du site (matches/[id]/page.tsx), avec
/// la réponse en tête et la liste dessous.
///
/// Ce n'est pas un récap : il n'y a ni score ni buteurs. La ligne de la liste
/// des matchs menait nulle part ; elle mène ici, où l'on peut répondre.
///
/// Optimiste, comme la présence d'une soirée : la réponse s'allume au doigt,
/// un refus la remet et le dit.
export default function Convocation({
  t,
  clubId,
  matchId,
  nomA,
  nomB,
  saison,
  convocation,
  peutLancer,
  onLancer,
  onChange,
}: {
  t: Jetons;
  clubId: string;
  matchId: string;
  nomA: string;
  nomB: string;
  saison: string | null;
  convocation: Convoc;
  /// Le droit de scorer : « Composer les équipes et lancer ».
  peutLancer: boolean;
  onLancer: () => void;
  onChange: () => void;
}) {
  const [lignes, setLignes] = useState(convocation.lignes);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => setLignes(convocation.lignes), [convocation]);

  const moi = convocation.monPlayerId;
  const maReponse = moi ? (lignes.find((l) => l.playerId === moi)?.statut ?? null) : null;
  const compte = (s: StatutReponse | null) => lignes.filter((l) => l.statut === s).length;

  async function repondre(statut: StatutReponse) {
    if (!moi || envoi || statut === maReponse) return;
    vibrerChoix();
    setErreur(null);
    const avant = lignes;
    setLignes(lignes.map((l) => (l.playerId === moi ? { ...l, statut } : l)));
    setEnvoi(true);
    try {
      await repondreConvocation(clubId, matchId, moi, statut);
      onChange();
    } catch (e) {
      setLignes(avant);
      setErreur(messageErreur(e));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <View style={s.pile}>
      <View style={s.entete}>
        <Text style={[s.sur, { color: jeton(t, "i2") }]}>
          Match programmé{saison ? ` · ${saison}` : ""}
        </Text>
        <Text style={[s.titre, { color: t.ink }]} accessibilityRole="header">
          {nomA} <Text style={{ color: jeton(t, "i2") }}>vs</Text> {nomB}
        </Text>
        <Text style={[s.quand, { color: t.ink }]}>
          {convocation.jourLong}
          <Text style={{ color: jeton(t, "i2") }}> · {convocation.heure}</Text>
        </Text>
        {convocation.lieu ? (
          <Text style={[s.lieu, { color: jeton(t, "i2") }]}>
            {convocation.lieu}
            {convocation.domicile ? " · à domicile" : ""}
          </Text>
        ) : null}
      </View>

      {peutLancer && (
        <BoutonPlein t={t} titre="Composer les équipes et lancer" onPress={onLancer} />
      )}

      <Carte t={t} titre="Qui est là ?" style={s.carte}>
        {moi ? (
          <View style={s.reponses}>
            {REPONSES.map(([v, l]) => {
              const actif = maReponse === v;
              return (
                <Pressable
                  key={v}
                  onPress={() => void repondre(v)}
                  disabled={envoi}
                  accessibilityRole="button"
                  accessibilityState={{ selected: actif, disabled: envoi }}
                  style={({ pressed }) => [
                    s.reponse,
                    actif
                      ? { backgroundColor: jeton(t, "bt"), borderColor: "transparent" }
                      : { backgroundColor: jeton(t, "gl"), borderColor: jeton(t, "gb") },
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text
                    style={[s.reponseTexte, { color: actif ? jeton(t, "bf") : t.ink }]}
                    numberOfLines={1}
                  >
                    {l}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Text style={[s.aide, { color: jeton(t, "i2") }]}>
            Ton compte n&apos;est rattaché à aucun joueur du club : tu ne peux pas répondre.
          </Text>
        )}
        {erreur ? <Text style={s.erreur}>{erreur}</Text> : null}

        <Text style={[s.compteurs, { color: jeton(t, "i2") }]}>
          <Text style={[s.fort, { color: t.ink }]}>{compte("IN")}</Text> présent
          {compte("IN") > 1 ? "s" : ""} · <Text style={[s.fort, { color: t.ink }]}>{compte("MAYBE")}</Text>{" "}
          peut-être · <Text style={[s.fort, { color: t.ink }]}>{compte("OUT")}</Text> absent
          {compte("OUT") > 1 ? "s" : ""} · <Text style={[s.fort, { color: t.ink }]}>{compte(null)}</Text> sans
          réponse
        </Text>

        {lignes.map((l) => (
          <View key={l.playerId} style={[s.ligne, { borderTopColor: jeton(t, "sep") }]}>
            <Avatar nom={l.nom} photo={l.photo} t={t} taille={32} />
            <Text style={[s.nom, { color: l.moi ? t.ink : jeton(t, "i2") }]} numberOfLines={1}>
              {l.nom}
              {l.moi ? " · moi" : ""}
            </Text>
            <Text
              style={[
                s.statut,
                {
                  color:
                    l.statut === "IN"
                      ? jeton(t, "ok")
                      : l.statut === "MAYBE"
                        ? jeton(t, "or")
                        : l.statut === "OUT"
                          ? jeton(t, "bad")
                          : jeton(t, "i3"),
                },
              ]}
            >
              {l.statut ? LIBELLES[l.statut] : "—"}
            </Text>
          </View>
        ))}
      </Carte>
    </View>
  );
}

const s = StyleSheet.create({
  pile: { gap: 14 },
  entete: { paddingTop: 12, paddingHorizontal: 4, gap: 4 },
  sur: { fontSize: 15, fontWeight: "600" },
  titre: { fontSize: 28, fontWeight: "700", letterSpacing: -0.4 },
  quand: { fontSize: 20, fontWeight: "600", marginTop: 4 },
  lieu: { fontSize: 15 },
  carte: { paddingHorizontal: 20, paddingBottom: 8 },
  reponses: { flexDirection: "row", gap: 8, paddingBottom: 12 },
  reponse: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  reponseTexte: { fontSize: 15, fontWeight: "600" },
  aide: { fontSize: 15, textAlign: "center", paddingBottom: 12 },
  erreur: { fontSize: 15, color: "#ff453a", paddingBottom: 10 },
  compteurs: { fontSize: 14, lineHeight: 20, paddingBottom: 10 },
  fort: { fontWeight: "700" },
  ligne: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 52,
    borderTopWidth: 1,
  },
  nom: { flex: 1, fontSize: 17 },
  statut: { fontSize: 15, fontWeight: "600" },
});
