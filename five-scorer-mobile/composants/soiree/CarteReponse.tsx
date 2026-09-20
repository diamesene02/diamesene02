import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar, CarteVerre } from "../base";
import { jeton, voile, type Jetons } from "../../lib/couleurs";
import { avertissement, choix, succes } from "../../lib/haptique";
import { messageErreur } from "../../lib/erreurs";
import { repondrePresence, type FicheSoiree, type StatutReponse } from "../../lib/api";
import { compteDesPresences, libelleAutres, statutSuivant } from "./logique";

type Ligne = FicheSoiree["presences"]["lignes"][number];

const LIBELLES: Record<StatutReponse, { libelle: string; ton: string }> = {
  IN: { libelle: "Présent", ton: "in" },
  MAYBE: { libelle: "Peut-être", ton: "maybe" },
  OUT: { libelle: "Absent", ton: "out" },
};

/// Quatre lignes, puis « et N autres » : sur un club de vingt, on veut
/// savoir qui vient, pas lire vingt lignes — et la compo doit rester à portée
/// de pouce juste en dessous.
const VISIBLES = 4;

/// La carte « Ma réponse » — celle du site (SessionRsvpAdmin) : mon choix
/// Présent / Absent en tête, le compte et la note du terrain, l'état de la
/// soirée, puis les joueurs.
///
/// Le choix allumé est le statut RETENU : un abonné qui n'a rien dit est
/// présent, et le lui montrer éteint lui faisait croire qu'il n'était pas
/// inscrit. La réponse part de façon optimiste : l'écran bouge au doigt, et
/// revient en arrière — en le disant — si le serveur refuse.
export default function CarteReponse({
  t,
  fiche,
  clubId,
  onFiche,
  recharger,
}: {
  t: Jetons;
  fiche: FicheSoiree;
  clubId: string;
  /// Pose une version modifiée de la fiche à l'écran (la réponse optimiste).
  onFiche: (maj: (f: FicheSoiree) => FicheSoiree) => void;
  recharger: () => unknown;
}) {
  const [deplie, setDeplie] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envois, setEnvois] = useState<Record<string, boolean>>({});
  const p = fiche.presences;
  const moi = p.lignes.find((l) => l.moi) ?? null;
  const mien = moi?.statut ?? null;

  const poser = (playerId: string, remplacer: (l: Ligne) => Ligne, maReponse?: StatutReponse | null) =>
    onFiche((f) => ({
      ...f,
      presences: {
        ...f.presences,
        ...(maReponse !== undefined ? { maReponse } : null),
        lignes: f.presences.lignes.map((l) => (l.playerId === playerId ? remplacer(l) : l)),
      },
    }));

  async function repondre(ligne: Ligne, statut: StatutReponse) {
    if (envois[ligne.playerId]) return;
    setErreur(null);
    choix();
    const avant = ligne;
    const avantMaReponse = p.maReponse;
    poser(
      ligne.playerId,
      (l) => ({
        ...l,
        statut,
        viaAbonnement: false,
        enAttente: statut === "IN" ? l.enAttente : false,
        libelle: statut === "IN" && l.enAttente ? "En attente" : LIBELLES[statut].libelle,
        ton: statut === "IN" && l.enAttente ? "attente" : LIBELLES[statut].ton,
      }),
      ligne.moi ? statut : undefined,
    );
    setEnvois((e) => ({ ...e, [ligne.playerId]: true }));
    try {
      await repondrePresence(clubId, fiche.id, ligne.playerId, statut);
      succes();
      // L'état de la soirée (confirmée, liste d'attente) se recalcule côté
      // serveur : on relit sans bloquer l'écran.
      void recharger();
    } catch (e) {
      // La ligne revient à ce que le serveur sait : l'écran ne doit pas
      // montrer un statut qui n'a pas été enregistré.
      poser(ligne.playerId, () => avant, ligne.moi ? avantMaReponse : undefined);
      avertissement();
      setErreur(`Pas enregistré. ${messageErreur(e)}`);
    } finally {
      setEnvois((e) => ({ ...e, [ligne.playerId]: false }));
    }
  }

  const visibles = deplie ? p.lignes : p.lignes.slice(0, VISIBLES);
  const caches = p.lignes.slice(VISIBLES);
  const etat = p.etat;
  const pastille =
    etat === "confirmee"
      ? { fond: voile(jeton(t, "ok"), 0.12), encre: jeton(t, "ok") }
      : etat === "en-attente"
        ? { fond: voile(jeton(t, "or"), 0.14), encre: jeton(t, "or") }
        : { fond: jeton(t, "seg"), encre: jeton(t, "i2") };

  const segment = (statut: StatutReponse, libelle: string) => {
    const actif = mien === statut;
    return (
      <Pressable
        key={statut}
        onPress={() => moi && !actif && void repondre(moi, statut)}
        disabled={!moi || Boolean(envois[moi.playerId])}
        accessibilityRole="radio"
        accessibilityState={{ selected: actif }}
        accessibilityLabel={`${libelle}${actif && moi?.viaAbonnement ? ", compté d'office comme abonné" : ""}`}
        hitSlop={{ top: 6, bottom: 6 }}
        style={({ pressed }) => [
          s.segmentBouton,
          actif && { backgroundColor: jeton(t, "bt") },
          pressed && !actif && { opacity: 0.7 },
        ]}
      >
        <Text style={[s.segmentTexte, { color: actif ? jeton(t, "bf") : jeton(t, "i2") }]}>
          {libelle}
        </Text>
      </Pressable>
    );
  };

  return (
    <CarteVerre t={t}>
      <View style={s.tete}>
        <Text style={[s.titre, { color: t.ink }]} accessibilityRole="header">
          {p.titre}
        </Text>
        {p.monPlayerId && (
          <View
            style={[s.segment, { backgroundColor: jeton(t, "seg") }]}
            accessibilityRole="radiogroup"
            accessibilityLabel="Ma réponse"
          >
            {segment("IN", "Présent")}
            {segment("OUT", "Absent")}
          </View>
        )}
      </View>
      <View style={[s.filet, { backgroundColor: jeton(t, "sep") }]} />
      <View style={s.compte}>
        <Text style={[s.compteTexte, { color: jeton(t, "i2") }]}>
          {compteDesPresences(p.lignes)}
        </Text>
        {fiche.terrain.resume ? (
          <Text style={[s.compteTexte, s.argent, { color: jeton(t, "i2") }]}>
            {fiche.terrain.resume}
          </Text>
        ) : null}
      </View>
      {moi?.viaAbonnement && mien === "IN" && (
        <Text style={[s.abonne, { color: jeton(t, "i3") }]}>
          Abonné : tu es compté présent d&apos;office. Touche « Absent » si tu ne peux pas venir.
        </Text>
      )}
      <View style={[s.etat, { backgroundColor: pastille.fond }]}>
        <Text style={[s.etatTexte, { color: pastille.encre }]}>{p.phrase}</Text>
      </View>
      {erreur && (
        <Text style={[s.erreur, { color: jeton(t, "bad") }]} accessibilityLiveRegion="polite">
          {erreur}
        </Text>
      )}

      {visibles.map((l) => {
        const effectif = l.statut;
        const couleur = l.enAttente
          ? jeton(t, "or")
          : effectif === "IN"
            ? jeton(t, "ok")
            : effectif === "MAYBE"
              ? jeton(t, "or")
              : effectif === "OUT"
                ? jeton(t, "bad")
                : jeton(t, "i3");
        const contenu = (
          <>
            <Avatar nom={l.nom} photo={l.photo} t={t} camp={l.camp} taille={36} />
            <Text style={[s.nom, { color: t.ink }]} numberOfLines={1}>
              {l.nom}
              {l.moi ? " (moi)" : ""}
            </Text>
            <Text style={[s.statut, { color: couleur }]} numberOfLines={1}>
              {l.libelle}
              {/* Un abonné n'a rien répondu : le lui faire croire serait
                  mentir, et l'empêcherait de se désister. */}
              {l.viaAbonnement && !l.enAttente ? (
                <Text style={[s.via, { color: jeton(t, "i3") }]}> · abonné</Text>
              ) : null}
            </Text>
          </>
        );
        return fiche.peutGerer ? (
          <Pressable
            key={l.playerId}
            onPress={() => void repondre(l, statutSuivant(l.statut))}
            disabled={Boolean(envois[l.playerId])}
            accessibilityRole="button"
            accessibilityLabel={`${l.nom}, ${l.libelle}${l.viaAbonnement ? ", abonné" : ""}`}
            accessibilityHint="Touche pour changer son statut"
            style={({ pressed }) => [s.rangee, pressed && { opacity: 0.7 }]}
          >
            {contenu}
          </Pressable>
        ) : (
          <View key={l.playerId} style={s.rangee}>
            {contenu}
          </View>
        );
      })}

      {caches.length > 0 ? (
        <Pressable
          onPress={() => setDeplie((d) => !d)}
          accessibilityRole="button"
          accessibilityState={{ expanded: deplie }}
          style={s.autres}
        >
          <Text style={[s.autresTexte, { color: jeton(t, "i3") }]}>
            {deplie ? "Replier" : libelleAutres(caches)}
          </Text>
        </Pressable>
      ) : (
        <View style={{ height: 12 }} />
      )}

      {fiche.peutGerer && (
        <Text style={[s.aide, { color: jeton(t, "i3") }]}>
          Touche un joueur pour changer son statut : présent → peut-être → absent.
        </Text>
      )}
    </CarteVerre>
  );
}

const s = StyleSheet.create({
  tete: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  titre: { fontSize: 22, fontWeight: "600", letterSpacing: -0.3, flexShrink: 1 },
  segment: { flexDirection: "row", height: 36, borderRadius: 10, padding: 2 },
  segmentBouton: {
    height: 32,
    borderRadius: 8,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentTexte: { fontSize: 15, fontWeight: "600" },
  filet: { height: 1, marginHorizontal: 12 },
  compte: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingTop: 14,
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  compteTexte: { fontSize: 17, flexShrink: 1 },
  argent: { fontVariant: ["tabular-nums"], flexShrink: 0 },
  abonne: { fontSize: 13, lineHeight: 18, paddingHorizontal: 20, paddingBottom: 6 },
  etat: {
    marginHorizontal: 4,
    marginTop: 6,
    marginBottom: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  etatTexte: { fontSize: 15, fontWeight: "600", textAlign: "center" },
  erreur: { fontSize: 15, paddingTop: 6, paddingHorizontal: 20, paddingBottom: 6 },
  rangee: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    height: 54,
    paddingHorizontal: 20,
  },
  nom: { flex: 1, minWidth: 0, fontSize: 17, fontWeight: "500" },
  statut: { fontSize: 15, fontWeight: "600", flexShrink: 0 },
  via: { fontWeight: "400" },
  autres: { paddingTop: 6, paddingHorizontal: 20, paddingBottom: 16, minHeight: 44 },
  autresTexte: { fontSize: 15 },
  aide: { fontSize: 13, lineHeight: 18, paddingHorizontal: 20, paddingBottom: 16 },
});
