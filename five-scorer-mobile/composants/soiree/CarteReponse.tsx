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
      {/* L'ÉTAT D'ABORD, le détail ensuite. « 8 présents · 4 places » (la
          réponse : est-ce que la soirée tient ?) arrivait SOUS « 8 présents ·
          0 absent » écrit en plus gros : on lisait deux fois le même nombre,
          et le plus gros des deux n'était pas le plus utile. La pastille de
          couleur passe devant, le décompte devient sa légende — avec la part
          du terrain, alignée à droite en chasse tabulaire. */}
      <View style={[s.etat, { backgroundColor: pastille.fond }]}>
        <Text style={[s.etatTexte, { color: pastille.encre }]}>{p.phrase}</Text>
      </View>
      <View style={s.compte}>
        <Text style={[s.compteTexte, { color: jeton(t, "i2") }]} numberOfLines={1}>
          {compteDesPresences(p.lignes)}
        </Text>
        {fiche.terrain.resume ? (
          <Text style={[s.compteTexte, s.argent, { color: jeton(t, "i2") }]}>
            {fiche.terrain.resume}
          </Text>
        ) : null}
      </View>
      {moi?.viaAbonnement && mien === "IN" && (
        // L'encre secondaire, pas la tertiaire : c'est la phrase qui explique
        // pourquoi on est marqué présent sans avoir rien répondu. À 0,4
        // d'opacité sur du verre, elle ne se lisait pas au soleil.
        <Text style={[s.abonne, { color: jeton(t, "i2") }]}>
          Abonné : tu es compté présent d&apos;office. Touche « Absent » si tu ne peux pas venir.
        </Text>
      )}
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
            {/* Le statut sur sa ligne, son origine SOUS lui. « Présent ·
                abonné » écrits d'un bloc prenaient 130 points à droite de la
                rangée, et c'est le NOM qui se coupait — « Compte de dev (… ».
                En deux lignes, la colonne de droite tombe à la largeur du mot
                le plus long, le prénom reprend quatre-vingts points, et le
                mot d'état gagne en clarté : il est seul, en couleur. */}
            <View style={s.colonneStatut}>
              <Text style={[s.statut, { color: couleur }]} numberOfLines={1}>
                {l.libelle}
              </Text>
              {/* Un abonné n'a rien répondu : le lui faire croire serait
                  mentir, et l'empêcherait de se désister. */}
              {l.viaAbonnement && !l.enAttente ? (
                <Text style={[s.via, { color: jeton(t, "i2") }]} numberOfLines={1}>
                  abonné
                </Text>
              ) : null}
            </View>
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
        <Text style={[s.aide, { color: jeton(t, "i2") }]}>
          Touche un joueur : présent → peut-être → absent.
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
    gap: 12,
    paddingTop: 20,
    paddingHorizontal: 18,
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
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  // 15 et non 17 : c'est la légende de la pastille au-dessus, pas un titre.
  compteTexte: { fontSize: 15, flexShrink: 1 },
  argent: { fontVariant: ["tabular-nums"], flexShrink: 0 },
  abonne: { fontSize: 13, lineHeight: 18, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 6 },
  etat: {
    marginHorizontal: 4,
    marginTop: 14,
    marginBottom: 0,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  etatTexte: { fontSize: 15, fontWeight: "600", textAlign: "center" },
  erreur: { fontSize: 15, paddingTop: 6, paddingHorizontal: 20, paddingBottom: 6 },
  // Marge 20 → 18 et écart 14 → 12 : quatre points de plus pour le nom. Les
  // prénoms du club sont longs, et « Compte de dev (moi) » se coupait déjà.
  rangee: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    height: 54,
    paddingHorizontal: 18,
  },
  nom: { flex: 1, minWidth: 0, fontSize: 17, fontWeight: "500" },
  // La colonne de droite ne prend jamais plus du tiers de la rangée, et elle
  // se rétrécit avant le nom : figée, elle laissait couper les prénoms.
  colonneStatut: { alignItems: "flex-end", flexShrink: 1, maxWidth: "34%" },
  statut: { fontSize: 15, fontWeight: "600" },
  via: { fontSize: 13, fontWeight: "400" },
  autres: { paddingTop: 6, paddingHorizontal: 18, paddingBottom: 12, minHeight: 44 },
  autresTexte: { fontSize: 15 },
  aide: { fontSize: 13, lineHeight: 18, paddingHorizontal: 18, paddingBottom: 16 },
});
