import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar, BoutonVerre, CarteVerre, Saisie } from "../base";
import { jeton, type Jetons } from "../../lib/couleurs";
import { avertissement, choix, succes } from "../../lib/haptique";
import { messageErreur } from "../../lib/erreurs";
import { ecrirePrixTerrain, marquerPaye, type FicheSoiree } from "../../lib/api";
import { caisse, euros, lireMontant } from "./logique";

/// « Le terrain » — la caisse de la soirée (MoneyPanel du site) : le prix à
/// saisir, qui a payé (un tap par joueur), l'encaissé et sa jauge.
///
/// Le gérant tient la caisse depuis le bord du terrain, billets en main :
/// le « Payé » bascule au doigt, sans attendre le serveur, et revient en
/// arrière s'il refuse.
export default function CarteTerrain({
  t,
  fiche,
  clubId,
  onFiche,
  recharger,
}: {
  t: Jetons;
  fiche: FicheSoiree;
  clubId: string;
  onFiche: (maj: (f: FicheSoiree) => FicheSoiree) => void;
  recharger: () => unknown;
}) {
  const terrain = fiche.terrain;
  const gerant = fiche.peutGerer;
  const [saisie, setSaisie] = useState(
    terrain.prixCents != null ? String(terrain.prixCents / 100).replace(".", ",") : "",
  );
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Un autre gérant a changé le prix : le champ suit, tant qu'on n'y tape pas.
  useEffect(() => {
    if (envoi) return;
    setSaisie(terrain.prixCents != null ? String(terrain.prixCents / 100).replace(".", ",") : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terrain.prixCents]);

  const { part, encaisse, pourcentage } = caisse(terrain.prixCents, terrain.payeurs);

  async function enregistrerPrix() {
    const cents = lireMontant(saisie);
    if (cents === "invalide") {
      avertissement();
      return setErreur("Montant illisible : écris par exemple 48 ou 52,50.");
    }
    setErreur(null);
    setEnvoi(true);
    try {
      await ecrirePrixTerrain(clubId, fiche.id, cents);
      succes();
      await recharger();
    } catch (e) {
      avertissement();
      setErreur(messageErreur(e));
    } finally {
      setEnvoi(false);
    }
  }

  async function basculerPaye(playerId: string, paye: boolean) {
    setErreur(null);
    choix();
    const poser = (valeur: boolean) =>
      onFiche((f) => ({
        ...f,
        terrain: {
          ...f.terrain,
          payeurs: f.terrain.payeurs.map((p) => (p.playerId === playerId ? { ...p, aPaye: valeur } : p)),
        },
      }));
    poser(paye);
    try {
      await marquerPaye(clubId, fiche.id, playerId, paye);
    } catch (e) {
      poser(!paye);
      avertissement();
      setErreur(messageErreur(e));
    }
  }

  return (
    <CarteVerre t={t} style={s.carte}>
      <Text style={[s.titre, { color: t.ink }]} accessibilityRole="header">
        Le terrain
      </Text>

      {gerant ? (
        <View style={s.prix}>
          <Saisie
            t={t}
            value={saisie}
            onChangeText={setSaisie}
            placeholder="Prix du terrain (€)"
            keyboardType="decimal-pad"
            returnKeyType="done"
            onSubmitEditing={() => void enregistrerPrix()}
            accessibilityLabel="Prix du terrain en euros"
            style={{ flex: 1, minWidth: 0, fontVariant: ["tabular-nums"] }}
          />
          <BoutonVerre
            t={t}
            titre={envoi ? "…" : "Enregistrer"}
            onPress={() => void enregistrerPrix()}
            disabled={envoi}
          />
        </View>
      ) : (
        terrain.prix && (
          <View style={s.rangee}>
            <Text style={[s.nom, { color: t.ink }]}>Prix du terrain</Text>
            <Text style={[s.valeur, { color: t.ink, fontWeight: "600" }]}>{terrain.prix}</Text>
          </View>
        )
      )}
      {erreur && <Text style={[s.erreur, { color: jeton(t, "bad") }]}>{erreur}</Text>}

      {terrain.prixCents != null && (
        <>
          {terrain.payeurs.length === 0 ? (
            <Text style={[s.vide, { color: jeton(t, "i2") }]}>
              Personne n&apos;a encore répondu présent — la part sera calculée dès les premières
              réponses.
            </Text>
          ) : (
            <View style={gerant ? { marginTop: 8 } : undefined}>
              {terrain.payeurs.map((p, i) => {
                const contenu = (
                  <>
                    <Avatar nom={p.nom} photo={p.photo ?? null} t={t} taille={30} />
                    <Text style={[s.nom, { color: t.ink }]} numberOfLines={1}>
                      {p.nom}
                    </Text>
                    <Text
                      style={[
                        s.valeur,
                        p.aPaye
                          ? { color: jeton(t, "ok"), fontWeight: "600" }
                          : { color: jeton(t, "i2") },
                      ]}
                    >
                      {p.aPaye ? "Payé" : "—"}
                    </Text>
                  </>
                );
                const style = [s.rangee, i > 0 && { borderTopWidth: 1, borderTopColor: jeton(t, "sep") }];
                return gerant ? (
                  <Pressable
                    key={p.playerId}
                    onPress={() => void basculerPaye(p.playerId, !p.aPaye)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: p.aPaye }}
                    accessibilityLabel={`${p.nom}, ${p.aPaye ? "a payé" : "n'a pas payé"}`}
                    style={({ pressed }) => [...style, pressed && { opacity: 0.7 }]}
                  >
                    {contenu}
                  </Pressable>
                ) : (
                  <View key={p.playerId} style={style}>
                    {contenu}
                  </View>
                );
              })}
            </View>
          )}

          <View style={s.encaisse}>
            <View style={s.ligne}>
              <Text style={[s.ligneTexte, { color: jeton(t, "i2") }]}>
                Encaissé{part != null ? ` · ${euros(part)} chacun` : ""}
              </Text>
              <Text style={[s.ligneTexte, { color: jeton(t, "i2") }]}>
                <Text style={{ color: t.ink, fontWeight: "600" }}>{euros(encaisse)}</Text> /{" "}
                {euros(terrain.prixCents)}
              </Text>
            </View>
            <View
              style={[s.jauge, { backgroundColor: jeton(t, "sep") }]}
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: 100, now: pourcentage }}
            >
              <View style={[s.jaugePleine, { width: `${pourcentage}%`, backgroundColor: t.ink }]} />
            </View>
          </View>
        </>
      )}

      {terrain.prixCents == null && gerant && (
        <Text style={[s.aide, { color: jeton(t, "i3") }]}>
          Renseigne le prix du terrain pour répartir la note entre les présents et cocher qui a
          payé.
        </Text>
      )}
    </CarteVerre>
  );
}

const s = StyleSheet.create({
  carte: { paddingHorizontal: 20, paddingBottom: 16 },
  titre: {
    fontSize: 22,
    fontWeight: "600",
    letterSpacing: -0.3,
    textAlign: "center",
    paddingTop: 20,
    paddingBottom: 12,
  },
  prix: { flexDirection: "row", alignItems: "center", gap: 10 },
  erreur: { fontSize: 15, marginTop: 8 },
  vide: { fontSize: 15, marginTop: 12, lineHeight: 20 },
  rangee: { flexDirection: "row", alignItems: "center", gap: 12, height: 54 },
  nom: { flex: 1, minWidth: 0, fontSize: 17 },
  valeur: { fontSize: 17 },
  encaisse: { marginTop: 14 },
  ligne: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  ligneTexte: { fontSize: 15, fontVariant: ["tabular-nums"] },
  jauge: { height: 6, borderRadius: 3, overflow: "hidden", marginTop: 8 },
  jaugePleine: { height: 6, borderRadius: 3 },
  aide: { fontSize: 13, lineHeight: 18, marginTop: 12 },
});
