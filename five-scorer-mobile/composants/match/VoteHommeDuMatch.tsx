import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar, Carte } from "../base";
import { jeton, type Jetons } from "../../lib/couleurs";
import { choix as vibrerChoix } from "../../lib/haptique";
import { messageErreur } from "../../lib/erreurs";
import { voterHommeDuMatch, type FicheMatch } from "../../lib/api";
import { deplacerMaVoix, nombreDeVotes, trierCandidats } from "./textes";

type Vote = NonNullable<FicheMatch["vote"]>;

const OR = "#ffd60a";

/// Le vote de l'homme du match (`MotmVotePanel` du site) : une rangée par
/// joueur, sa barre de voix, et le compteur. Un tap = ma voix ; on peut la
/// déplacer tant que le vote est ouvert.
///
/// Optimiste : la voix bouge au doigt, l'envoi suit. Un refus du serveur
/// remet tout comme avant et le dit. C'est le mode PAR DÉFAUT des clubs — un
/// club qui vit sur l'app n'élisait personne tant que cette carte manquait.
///
/// En ligne seulement, jamais par la file : un vote rejoué trois jours plus
/// tard recompterait un homme du match que le club a déjà lu.
export default function VoteHommeDuMatch({
  t,
  clubId,
  matchId,
  vote,
  onVote,
}: {
  t: Jetons;
  clubId: string;
  matchId: string;
  vote: Vote;
  /// Après un vote accepté : l'écran relit la fiche, l'homme du match a pu
  /// changer.
  onVote?: () => void;
}) {
  const [monVote, setMonVote] = useState(vote.monVote);
  const [candidats, setCandidats] = useState(vote.candidats);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // La fiche relue après un vote remplace l'état local — sauf pendant un
  // envoi, où elle écraserait le geste qu'on vient de faire.
  const enVol = useRef(false);
  useEffect(() => {
    if (enVol.current) return;
    setMonVote(vote.monVote);
    setCandidats(vote.candidats);
  }, [vote]);

  async function voter(playerId: string) {
    if (envoi || playerId === monVote) return;
    vibrerChoix();
    setErreur(null);
    const avant = { monVote, candidats };
    setCandidats(deplacerMaVoix(candidats, monVote, playerId));
    setMonVote(playerId);
    setEnvoi(true);
    enVol.current = true;
    try {
      await voterHommeDuMatch(clubId, matchId, playerId);
      enVol.current = false;
      onVote?.();
    } catch (e) {
      enVol.current = false;
      setMonVote(avant.monVote);
      setCandidats(avant.candidats);
      setErreur(messageErreur(e));
    } finally {
      setEnvoi(false);
    }
  }

  const total = candidats.reduce((n, c) => n + c.voix, 0);
  const max = Math.max(1, ...candidats.map((c) => c.voix));

  return (
    <Carte t={t} titre="Homme du match" style={s.carte}>
      <Text style={[s.aide, { color: jeton(t, "i2") }]}>
        {nombreDeVotes(total)} · touche pour voter, tu peux changer d&apos;avis.
      </Text>
      {trierCandidats(candidats).map((c) => {
        const mien = c.playerId === monVote;
        return (
          <Pressable
            key={c.playerId}
            onPress={() => void voter(c.playerId)}
            disabled={envoi}
            accessibilityRole="button"
            accessibilityState={{ selected: mien, disabled: envoi }}
            accessibilityLabel={`${c.nom}, ${nombreDeVotes(c.voix)}${mien ? ", ton vote" : ""}`}
            style={({ pressed }) => [
              s.rangee,
              { borderTopColor: jeton(t, "sep") },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Avatar nom={c.nom} photo={c.photo} t={t} taille={32} />
            <View style={s.corps}>
              <Text
                style={[s.nom, { color: t.ink, fontWeight: mien ? "600" : "500" }]}
                numberOfLines={1}
              >
                {c.nom}
                {mien ? <Text style={{ color: OR }}> ★</Text> : null}
              </Text>
              <View style={[s.piste, { backgroundColor: jeton(t, "sep") }]}>
                <View style={[s.plein, { width: `${(c.voix / max) * 100}%` }]} />
              </View>
            </View>
            <Text style={[s.compte, { color: c.voix ? OR : jeton(t, "i3") }]}>{c.voix}</Text>
          </Pressable>
        );
      })}
      {erreur ? <Text style={s.erreur}>{erreur}</Text> : null}
    </Carte>
  );
}

const s = StyleSheet.create({
  carte: { paddingHorizontal: 20, paddingBottom: 8 },
  aide: { fontSize: 15, textAlign: "center", marginTop: -6, paddingBottom: 8 },
  rangee: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    paddingVertical: 6,
    borderTopWidth: 1,
  },
  corps: { flex: 1, minWidth: 0, gap: 6 },
  nom: { fontSize: 17 },
  piste: { height: 4, borderRadius: 2, overflow: "hidden" },
  plein: { height: 4, borderRadius: 2, backgroundColor: OR },
  compte: { fontSize: 22, fontWeight: "700", fontVariant: ["tabular-nums"], minWidth: 18, textAlign: "right" },
  erreur: { fontSize: 15, color: "#ff453a", paddingTop: 8, paddingBottom: 8 },
});
