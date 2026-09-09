import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  Vibration,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import Ecran from "../../composants/Ecran";
import { Avatar, BoutonPlein, BoutonVerre } from "../../composants/base";
import { useNoyau } from "../../composants/Noyau";
import { JETONS_NEUTRES, type Jetons } from "../../lib/couleurs";
import { themeTokens } from "../../lib/noyau/theme";
import { fmt } from "../../lib/noyau/clock";
import { estRetro } from "../../lib/noyau/retro";
import type { LivePlayer } from "../../lib/match/local";
import type { LocalClub } from "../../lib/outbox/types";
import type { EtatSynchro } from "../../lib/outbox/sync";

/// La feuille de match.
///
/// Un tap sur un joueur = un but. Un appui long = on retire son dernier but.
/// Rien d'autre ne doit pouvoir se produire par mégarde : c'est le geste qu'on
/// fait vingt-sept fois dans une soirée, souvent d'une main, parfois en
/// courant.
///
/// Tout est écrit sur l'appareil AVANT d'être envoyé. Le score monte même sans
/// réseau ; la file s'occupe du serveur quand il revient.

/// Combien de temps l'invite « Passe décisive ? » reste à l'écran.
///
/// Quinze secondes : assez pour que quelqu'un réponde, assez court pour ne pas
/// gêner le but suivant. Elle ne bloque jamais — le score est déjà compté.
const INVITE_MS = 15_000;

/// Le seuil de l'appui long, en millisecondes.
///
/// 500 ms, comme sur le web. En natif on n'a pas besoin du garde
/// `suppressTapUntil` que le web trainait : React Native n'émet pas `onPress`
/// après un `onLongPress`.
const APPUI_LONG_MS = 500;

type Vue = Awaited<ReturnType<ReturnType<typeof useNoyau>["local"]["getLocalMatch"]>>;

export default function Match() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { local, drain } = useNoyau();

  const [vue, setVue] = useState<Vue>(null);
  // Le club vit à part : `getLocalMatch` rend la feuille, pas les réglages.
  // C'est lui qui porte les couleurs, la durée réglementaire et le fait qu'on
  // suive ou non les passes décisives.
  const [club, setClub] = useState<LocalClub | null>(null);
  const [etatSynchro, setEtatSynchro] = useState<EtatSynchro | null>(null);
  const [invite, setInvite] = useState<
    | { eventId: string; camp: "A" | "B"; buteurId: string | null; genre: "passe" | "csc" }
    | null
  >(null);
  const [confirmeFin, setConfirmeFin] = useState(false);
  const [tic, setTic] = useState(0);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);

  const relire = useCallback(async () => {
    if (!id) return;
    setVue(await local.getLocalMatch(id));
  }, [id, local]);

  useEffect(() => {
    void relire();
  }, [relire]);

  useEffect(() => drain.abonner(setEtatSynchro), [drain]);

  const match = vue?.match;

  useEffect(() => {
    if (!match) return;
    void local.getLocalClub(match.clubId).then((c) => setClub(c ?? null));
  }, [local, match?.clubId]);
  const retro = match ? estRetro(match.playedAt) : false;

  // L'horloge se dérive du coup d'envoi, comme la minute des buts. Un tic de
  // 500 ms suffit : l'affichage est à la seconde, et rien n'est écrit en base.
  useEffect(() => {
    if (!match || retro || match.status !== "LIVE") return;
    const h = setInterval(() => setTic((n) => n + 1), 500);
    return () => clearInterval(h);
  }, [match, retro]);

  useEffect(() => {
    return () => {
      if (minuteur.current) clearTimeout(minuteur.current);
    };
  }, []);

  if (!vue || !match) {
    return (
      <Ecran>
        <View style={s.centre}>
          <ActivityIndicator color="#fff" />
          <Text style={[s.aide, { color: JETONS_NEUTRES.i2 }]}>Un instant…</Text>
        </View>
      </Ecran>
    );
  }

  const couleurA = club?.colorA ?? "#ffffff";
  const couleurB = club?.colorB ?? "#111111";
  const t: Jetons = club ? themeTokens(couleurA, couleurB, "dark") : JETONS_NEUTRES;
  const ecoule = Math.max(0, Date.now() - Date.parse(match.playedAt));

  function armerInvite(x: NonNullable<typeof invite>) {
    if (minuteur.current) clearTimeout(minuteur.current);
    setInvite(x);
    minuteur.current = setTimeout(() => setInvite(null), INVITE_MS);
  }

  function fermerInvite() {
    if (minuteur.current) clearTimeout(minuteur.current);
    setInvite(null);
  }

  async function marquer(camp: "A" | "B", joueur: LivePlayer) {
    Vibration.vibrate(12);
    const eventId = await local.addEvent(match!.id, {
      type: "GOAL",
      team: camp,
      playerId: joueur.id,
    });
    await relire();
    void drain.relancer();
    // L'invite ne s'ouvre que si le club suit les passes, et jamais sur une
    // feuille rétro : on ne demande pas qui a fait la passe d'un but d'il y a
    // trois jours.
    if (club?.trackAssists && !retro && eventId) {
      armerInvite({ eventId, camp, buteurId: joueur.id, genre: "passe" });
    }
  }

  async function contreSonCamp(campQuiConcede: "A" | "B") {
    const campCredite = campQuiConcede === "A" ? "B" : "A";
    Vibration.vibrate(12);
    const eventId = await local.addEvent(match!.id, {
      type: "OWN_GOAL",
      team: campCredite,
    });
    await relire();
    void drain.relancer();
    if (!retro && eventId) {
      // Le but est déjà au bon camp ; l'auteur se désigne après, parmi ceux
      // qui l'ont concédé.
      armerInvite({ eventId, camp: campQuiConcede, buteurId: null, genre: "csc" });
    }
  }

  async function annulerSonDernier(joueur: LivePlayer) {
    const supprime = await local.undoLastGoalOf(match!.id, joueur.id);
    if (!supprime) return;
    Vibration.vibrate(30);
    fermerInvite();
    await relire();
    void drain.relancer();
  }

  async function annulerDernier() {
    const dernier = vue!.events[vue!.events.length - 1];
    if (!dernier) return;
    await local.removeEvent(match!.id, dernier.id);
    Vibration.vibrate(30);
    fermerInvite();
    await relire();
    void drain.relancer();
  }

  async function repondreInvite(joueurId: string | null) {
    if (!invite) return;
    if (joueurId) {
      if (invite.genre === "passe") {
        await local.setEventAssist(match!.id, invite.eventId, joueurId);
      } else {
        await local.setEventScorer(match!.id, invite.eventId, joueurId);
      }
      await relire();
      void drain.relancer();
    }
    fermerInvite();
  }

  async function terminer() {
    setConfirmeFin(false);
    await local.finishMatch(match!.id, null, club?.matchDurationMin ?? null);
    void drain.relancer();
    router.replace("/clubs");
  }

  const gagneA = match.scoreA > match.scoreB;
  const gagneB = match.scoreB > match.scoreA;
  const equipes: { camp: "A" | "B"; nom: string; couleur: string; joueurs: LivePlayer[] }[] = [
    { camp: "A", nom: match.teamAName, couleur: couleurA, joueurs: vue.teamA },
    { camp: "B", nom: match.teamBName, couleur: couleurB, joueurs: vue.teamB },
  ];

  const candidats =
    invite?.genre === "passe"
      ? (invite.camp === "A" ? vue.teamA : vue.teamB).filter((p) => p.id !== invite.buteurId)
      : invite
        ? invite.camp === "A"
          ? vue.teamA
          : vue.teamB
        : [];

  return (
    <Ecran t={t} chasubles={{ a: couleurA, b: couleurB }}>
      <View style={s.barre}>
        <Pressable onPress={() => router.replace("/clubs")} hitSlop={12}>
          <Text style={[s.retour, { color: t.i2 }]}>‹ Club</Text>
        </Pressable>
        <Text style={[s.legende, { color: t.i2 }]}>
          {retro ? "Feuille saisie" : "Match"}
        </Text>
        <Pastille t={t} etat={etatSynchro} />
      </View>

      {/* Le tableau de marque. Le camp qui perd s'efface : d'un coup d'œil, à
          deux mètres, on doit savoir qui mène sans lire les chiffres. */}
      <View style={s.marque}>
        <Text style={[s.chiffre, { color: t.ink, opacity: gagneB ? 0.4 : 1 }]}>
          {match.scoreA}
        </Text>
        <View style={s.milieu}>
          <Text style={[s.etat, { color: t.i2 }]}>
            {match.status === "FINISHED" ? "Terminé" : retro ? "Saisie" : "En direct"}
          </Text>
          {!retro && match.status === "LIVE" && (
            <Text style={[s.horloge, { color: t.ink }]}>{fmt(ecoule)}</Text>
          )}
        </View>
        <Text style={[s.chiffre, { color: t.ink, opacity: gagneA ? 0.4 : 1 }]}>
          {match.scoreB}
        </Text>
      </View>

      <ScrollView contentContainerStyle={s.corps}>
        <View style={s.colonnes}>
          {equipes.map((e) => (
            <View key={e.camp} style={s.colonne}>
              <Text style={[s.nomEquipe, { color: t.i2 }]} numberOfLines={1}>
                {e.nom}
              </Text>
              {e.joueurs.map((j) => (
                <Pressable
                  key={j.id}
                  onPress={() => void marquer(e.camp, j)}
                  onLongPress={() => void annulerSonDernier(j)}
                  delayLongPress={APPUI_LONG_MS}
                  disabled={match.status !== "LIVE"}
                  accessibilityLabel={`${j.name} — but (maintenir pour annuler)`}
                  style={({ pressed }) => [
                    s.tuile,
                    {
                      borderColor: t.sep,
                      backgroundColor: pressed ? e.couleur + "33" : "transparent",
                    },
                  ]}
                >
                  <Avatar
                    nom={j.name}
                    photo={j.photo}
                    t={t}
                    anneau={e.camp === "A" ? (t.taR ?? couleurA) : (t.tbR ?? couleurB)}
                    taille={34}
                  />
                  <Text style={[s.nomJoueur, { color: t.ink }]} numberOfLines={1}>
                    {j.name}
                  </Text>
                  {j.goals > 0 && (
                    <Text style={[s.buts, { color: t.ink }]}>{j.goals}</Text>
                  )}
                </Pressable>
              ))}
            </View>
          ))}
        </View>

        {/* Les deux « contre son camp » vivent hors des colonnes : celles-ci
            n'ont jamais le même nombre de joueurs, et deux boutons qui ne
            s'alignent pas se cherchent du regard à chaque fois. */}
        {match.status === "LIVE" && (
          <View style={s.rangeeCsc}>
            {equipes.map((e) => (
              <Pressable
                key={e.camp}
                onPress={() => void contreSonCamp(e.camp)}
                accessibilityLabel={`Contre son camp — but pour ${
                  e.camp === "A" ? match.teamBName : match.teamAName
                }`}
                style={s.csc}
              >
                <Text style={[s.cscTexte, { color: t.i3 }]} numberOfLines={1}>
                  Contre son camp
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {invite && (
        <View style={[s.invite, { backgroundColor: t.cdSolid, borderTopColor: t.sep }]}>
          <Text style={[s.inviteTitre, { color: t.ink }]}>
            {invite.genre === "passe" ? "Passe décisive ?" : "Qui l'a mis ?"}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pastilles}>
            {candidats.map((p) => (
              <Pressable key={p.id} onPress={() => void repondreInvite(p.id)} style={[s.pastille, { borderColor: t.cb }]}>
                <Text style={{ color: t.ink, fontSize: 15 }}>{p.name}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => void repondreInvite(null)} style={[s.pastille, { borderColor: t.cb }]}>
              <Text style={{ color: t.i3, fontSize: 15 }}>
                {invite.genre === "passe" ? "Sans passe" : "Sans préciser"}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      )}

      {match.status === "LIVE" && (
        <View style={s.pied}>
          <View style={{ flex: 1 }}>
            <BoutonVerre
              t={t}
              titre="Annuler"
              onPress={() => void annulerDernier()}
              disabled={vue.events.length === 0}
            />
          </View>
          <View style={{ flex: 1.3 }}>
            <BoutonPlein
              t={t}
              titre={retro ? "Enregistrer" : "Terminer"}
              onPress={() => setConfirmeFin(true)}
            />
          </View>
        </View>
      )}

      <Modal visible={confirmeFin} transparent animationType="fade" onRequestClose={() => setConfirmeFin(false)}>
        <View style={s.voile}>
          <View style={[s.boite, { backgroundColor: t.cdSolid, borderColor: t.cb }]}>
            <Text style={[s.boiteTitre, { color: t.ink }]}>
              {retro ? "Enregistrer ce match ?" : "Terminer ce match ?"}
            </Text>
            <Text style={[s.aide, { color: t.i2, textAlign: "center" }]}>
              {match.scoreA} — {match.scoreB}
            </Text>
            <View style={{ height: 14 }} />
            <BoutonPlein t={t} titre={retro ? "Enregistrer" : "Terminer"} onPress={() => void terminer()} />
            <View style={{ height: 10 }} />
            <BoutonVerre t={t} titre="Pas encore" onPress={() => setConfirmeFin(false)} />
          </View>
        </View>
      </Modal>
    </Ecran>
  );
}

/// L'état de la file, en trois mots.
///
/// Ce qui compte au bord du terrain n'est pas le détail mais la réponse à une
/// seule question : « est-ce que ce que je viens de taper est parti ? »
function Pastille({ t, etat }: { t: Jetons; etat: EtatSynchro | null }) {
  if (!etat) return <View style={{ width: 60 }} />;
  const texte = etat.reconnexionRequise
    ? "Reconnecte-toi"
    : etat.bloquees > 0
      ? `${etat.bloquees} refusée${etat.bloquees > 1 ? "s" : ""}`
      : etat.enAttente > 0
        ? `${etat.enAttente} en attente`
        : !etat.enLigne
          ? "Hors ligne"
          : "À jour";
  const couleur = etat.reconnexionRequise || etat.bloquees > 0 ? (t.bad ?? "#ff453a") : t.i3;
  return <Text style={[s.pastilleTexte, { color: couleur }]}>{texte}</Text>;
}

const s = StyleSheet.create({
  centre: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  aide: { fontSize: 15 },
  barre: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  retour: { fontSize: 17 },
  legende: { fontSize: 15 },
  pastilleTexte: { fontSize: 13 },
  marque: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 6,
  },
  chiffre: {
    flex: 1,
    fontSize: 84,
    fontWeight: "800",
    letterSpacing: -4,
    textAlign: "center",
  },
  milieu: { alignItems: "center", gap: 2, minWidth: 90 },
  etat: { fontSize: 13 },
  horloge: { fontSize: 17, fontWeight: "600" },
  corps: { paddingHorizontal: 10, paddingBottom: 12 },
  colonnes: { flexDirection: "row", gap: 10 },
  colonne: { flex: 1, gap: 6 },
  nomEquipe: { fontSize: 13, fontWeight: "600", textAlign: "center", paddingBottom: 2 },
  tuile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 58,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  nomJoueur: { flex: 1, fontSize: 16 },
  buts: { fontSize: 22, fontWeight: "700" },
  rangeeCsc: { flexDirection: "row", gap: 10, paddingTop: 8 },
  csc: { flex: 1, height: 46, alignItems: "center", justifyContent: "center" },
  cscTexte: { fontSize: 15, fontWeight: "600" },
  invite: { paddingVertical: 10, paddingHorizontal: 14, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
  inviteTitre: { fontSize: 15, fontWeight: "600" },
  pastilles: { gap: 8, paddingRight: 14 },
  pastille: { height: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  pied: { flexDirection: "row", gap: 10, paddingHorizontal: 14, paddingBottom: 10, paddingTop: 6 },
  voile: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 24 },
  boite: { width: "100%", maxWidth: 340, borderRadius: 26, borderWidth: 1, padding: 20 },
  boiteTitre: { fontSize: 20, fontWeight: "600", textAlign: "center", paddingBottom: 8 },
});
