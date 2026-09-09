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
import {
  Avatar,
  BoutonPlein,
  BoutonRond,
  BoutonVerre,
  EcussonChasuble,
  Poignee,
} from "../../composants/base";
import { useNoyau } from "../../composants/Noyau";
import { JETONS_NEUTRES, type Jetons } from "../../lib/couleurs";
import { themeTokens } from "../../lib/noyau/theme";
import { fmt, nowElapsed } from "../../lib/noyau/clock";
import { estRetro } from "../../lib/noyau/retro";
import type { LivePlayer } from "../../lib/match/local";
import type { LocalClub } from "../../lib/outbox/types";
import type { EtatSynchro } from "../../lib/outbox/sync";

/// La feuille de match, reprise de celle du site (maquette « Live », tour 4).
///
/// Mêmes valeurs, relevées sur le rendu réel plutôt que réinventées : le score
/// en 132 avec le camp qui perd à 40 %, les écussons de chasuble en 76 sous
/// les chiffres, les deux cartes d'équipe en verre à rayon 24, les rangées de
/// 58, la barre du bas à trois boutons de 52.
///
/// Un tap sur un joueur = un but. Un appui long = on retire son dernier but.
/// Rien d'autre ne doit pouvoir se produire par mégarde : c'est le geste qu'on
/// fait vingt-sept fois dans une soirée, souvent d'une main, parfois debout.
///
/// Tout est écrit sur l'appareil AVANT d'être envoyé. Le score monte même sans
/// réseau ; la file s'occupe du serveur quand il revient.

/// Combien de temps l'invite « Passe décisive ? » reste à l'écran.
///
/// Quinze secondes : assez pour qu'on réponde, assez court pour ne pas gêner
/// le but suivant. Elle ne bloque jamais — le score est déjà compté.
const INVITE_MS = 15_000;

/// Le seuil de l'appui long. 500 ms, comme sur le site.
///
/// Le garde `suppressTapUntil` de 700 ms que le web traîne disparaît ici :
/// React Native n'émet pas `onPress` après un `onLongPress`, cette ceinture
/// était pour le navigateur.
const APPUI_LONG_MS = 500;

type Vue = Awaited<ReturnType<ReturnType<typeof useNoyau>["local"]["getLocalMatch"]>>;
type Invite = {
  eventId: string;
  camp: "A" | "B";
  buteurId: string | null;
  genre: "passe" | "csc";
};

export default function Match() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { local, drain } = useNoyau();

  const [vue, setVue] = useState<Vue>(null);
  // Le club vit à part : `getLocalMatch` rend la feuille, pas les réglages.
  // C'est lui qui porte les couleurs et le fait qu'on suive les passes.
  const [club, setClub] = useState<LocalClub | null>(null);
  const [etatSynchro, setEtatSynchro] = useState<EtatSynchro | null>(null);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [confirmeFin, setConfirmeFin] = useState(false);
  const [, setTic] = useState(0);
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
  const clubId = match?.clubId;

  useEffect(() => {
    if (!clubId) return;
    void local.getLocalClub(clubId).then((c) => setClub(c ?? null));
  }, [local, clubId]);

  const retro = match ? estRetro(match.playedAt) : false;
  const tourne = Boolean(match?.clockRunningSince);

  // Amorcer le chrono à la première ouverture, comme le site.
  //
  // La garde rétro n'est pas un détail : sans elle, `maintenant - playedAt`
  // démarrerait le chrono d'un match d'hier à 24:00:00 — donc au-delà du temps
  // réglementaire dès l'ouverture, sirène comprise.
  const amorce = useRef(false);
  useEffect(() => {
    if (!match || match.status !== "LIVE" || amorce.current) return;
    amorce.current = true;
    if (match.clockRunningSince == null && !(match.clockElapsedMs ?? 0) && !retro) {
      void local.demarrerHorloge(match.id, Date.now() - Date.parse(match.playedAt)).then(relire);
    }
  }, [match, retro, local, relire]);

  // Rien ne tourne en base : le temps se dérive des deux colonnes du chrono.
  // Un tic de 500 ms suffit, l'affichage est à la seconde.
  useEffect(() => {
    if (!tourne || retro) return;
    const h = setInterval(() => setTic((n) => n + 1), 500);
    return () => clearInterval(h);
  }, [tourne, retro]);

  useEffect(
    () => () => {
      if (minuteur.current) clearTimeout(minuteur.current);
    },
    [],
  );

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
  const ecoule = nowElapsed({
    elapsedMs: match.clockElapsedMs ?? 0,
    runningSince: match.clockRunningSince ?? null,
  });
  const depasse =
    club?.matchDurationMin != null && ecoule > club.matchDurationMin * 60_000;
  const enJeu = match.status === "LIVE";

  function armerInvite(x: Invite) {
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
    // Jamais sur une feuille rétro : on ne demande pas qui a fait la passe
    // d'un but d'il y a trois jours.
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
    // Le but part au bon camp tout de suite ; l'auteur se désigne après, parmi
    // ceux qui l'ont concédé.
    if (!retro && eventId) {
      armerInvite({ eventId, camp: campQuiConcede, buteurId: null, genre: "csc" });
    }
  }

  async function annulerSonDernier(joueur: LivePlayer) {
    if (!(await local.undoLastGoalOf(match!.id, joueur.id))) return;
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

  async function basculerChrono() {
    await local.basculerHorloge(match!.id);
    await relire();
  }

  async function siffler() {
    if (await local.siffletMiTemps(match!.id)) {
      Vibration.vibrate(30);
      await relire();
    }
  }

  async function terminer() {
    setConfirmeFin(false);
    await local.finishMatch(match!.id, null, Math.round(ecoule / 60_000) || null);
    void drain.relancer();
    router.replace("/clubs");
  }

  const equipes = [
    { camp: "A" as const, nom: match.teamAName, couleur: couleurA, joueurs: vue.teamA },
    { camp: "B" as const, nom: match.teamBName, couleur: couleurB, joueurs: vue.teamB },
  ];

  const candidats = !invite
    ? []
    : invite.genre === "passe"
      ? (invite.camp === "A" ? vue.teamA : vue.teamB).filter((p) => p.id !== invite.buteurId)
      : invite.camp === "A"
        ? vue.teamA
        : vue.teamB;

  return (
    <Ecran t={t} chasubles={{ a: couleurA, b: couleurB }}>
      <Poignee />

      <View style={s.barre}>
        <BoutonRond
          t={t}
          symbole="‹"
          etiquette="Retour"
          onPress={() => router.replace("/clubs")}
        />
        <Text style={s.legende} numberOfLines={1}>
          {legende(match.playedAt)} · {retro ? "Feuille" : "Match"}
        </Text>
        <Pastille etat={etatSynchro} />
      </View>

      {/* Le tableau de marque. Le camp qui perd s'efface à 40 % : à deux
          mètres, on doit savoir qui mène sans lire les chiffres. */}
      <View style={s.marque}>
        <Chiffre valeur={match.scoreA} perd={match.scoreB > match.scoreA} />
        <View style={s.milieu}>
          {enJeu && !retro ? (
            <>
              <View style={s.etatLigne}>
                <View
                  style={[
                    s.point,
                    { backgroundColor: tourne ? "#ff453a" : "rgba(255,255,255,0.5)" },
                  ]}
                />
                <Text
                  style={[s.etat, { color: tourne ? "#ff453a" : "rgba(255,255,255,0.7)" }]}
                >
                  {tourne ? "En direct" : "Pause"}
                </Text>
              </View>
              <Text style={[s.horloge, depasse && { color: "#ff453a" }]}>{fmt(ecoule)}</Text>
              <Pressable onPress={() => void siffler()} hitSlop={8} disabled={(match.period ?? 1) >= 2}>
                <Text style={s.periode}>
                  {(match.period ?? 1) === 1 ? "1re · mi-temps ›" : "2de"}
                </Text>
              </Pressable>
            </>
          ) : (
            <Text style={[s.etat, { color: "rgba(255,255,255,0.7)" }]}>
              {match.status === "FINISHED" ? "Terminé" : "Saisie"}
            </Text>
          )}
        </View>
        <Chiffre valeur={match.scoreB} perd={match.scoreA > match.scoreB} />
      </View>

      {/* Les écussons sous le score, comme sur le site : au five, l'équipe
          n'a pas de nom, elle a une chasuble. */}
      <View style={s.equipes}>
        {equipes.map((e) => (
          <View key={e.camp} style={s.equipe}>
            <EcussonChasuble couleur={e.couleur} lettre={e.nom[0] ?? "?"} />
            <Text style={[s.nomEquipe, { color: t.ink }]} numberOfLines={1}>
              {e.nom}
            </Text>
          </View>
        ))}
      </View>

      <ScrollView contentContainerStyle={s.corps}>
        <View style={s.cartes}>
          {equipes.map((e) => (
            <View key={e.camp} style={s.carte}>
              {e.joueurs.map((j, i) => (
                <Pressable
                  key={j.id}
                  onPress={() => void marquer(e.camp, j)}
                  onLongPress={() => void annulerSonDernier(j)}
                  delayLongPress={APPUI_LONG_MS}
                  disabled={!enJeu}
                  accessibilityLabel={`${j.name} — but (maintenir pour annuler)`}
                  style={({ pressed }) => [
                    s.joueur,
                    i > 0 && s.separe,
                    pressed && { backgroundColor: e.couleur + "33" },
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
                  <Text style={[s.buts, { color: t.ink }]}>{j.goals || ""}</Text>
                </Pressable>
              ))}
              <Pressable
                onPress={() => void contreSonCamp(e.camp)}
                disabled={!enJeu}
                accessibilityLabel={`Contre son camp — but pour ${
                  e.camp === "A" ? match.teamBName : match.teamAName
                }`}
                style={({ pressed }) => [
                  s.csc,
                  s.separe,
                  pressed && { backgroundColor: "rgba(255,255,255,0.08)" },
                ]}
              >
                <Text style={s.cscTexte}>Contre son camp</Text>
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView>

      {invite && (
        <View style={s.invite}>
          <Text style={[s.inviteTitre, { color: t.ink }]}>
            {invite.genre === "passe" ? "Passe décisive ?" : "Qui l'a mis ?"}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.choix}
          >
            {candidats.map((p) => (
              <Pressable key={p.id} onPress={() => void repondreInvite(p.id)} style={s.pastille}>
                <Text style={{ color: t.ink, fontSize: 15, fontWeight: "600" }}>{p.name}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => void repondreInvite(null)} style={s.pastille}>
              <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 15, fontWeight: "600" }}>
                {invite.genre === "passe" ? "Sans passe" : "Sans préciser"}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      )}

      {enJeu && (
        <View style={s.pied}>
          <View style={{ flex: 1 }}>
            <BoutonVerre
              t={t}
              titre="Annuler"
              onPress={() => void annulerDernier()}
              disabled={vue.events.length === 0}
            />
          </View>
          {!retro && (
            <View style={{ flex: 1 }}>
              <BoutonVerre
                t={t}
                titre={tourne ? "Pause" : "Reprendre"}
                onPress={() => void basculerChrono()}
              />
            </View>
          )}
          <View style={{ flex: 1.3 }}>
            <BoutonPlein
              t={t}
              titre={retro ? "Enregistrer" : "Terminer"}
              onPress={() => setConfirmeFin(true)}
            />
          </View>
        </View>
      )}

      <Modal
        visible={confirmeFin}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmeFin(false)}
      >
        <View style={s.voile}>
          <View style={[s.boite, { backgroundColor: t.cdSolid, borderColor: t.cb }]}>
            <Text style={[s.boiteTitre, { color: t.ink }]}>
              {retro ? "Enregistrer ce match ?" : "Terminer ce match ?"}
            </Text>
            <Text style={[s.aide, { color: t.i2, textAlign: "center" }]}>
              {match.teamAName} {match.scoreA} — {match.scoreB} {match.teamBName}
            </Text>
            <View style={{ height: 16 }} />
            <BoutonPlein
              t={t}
              titre={retro ? "Enregistrer" : "Terminer"}
              onPress={() => void terminer()}
            />
            <View style={{ height: 10 }} />
            <BoutonVerre t={t} titre="Pas encore" onPress={() => setConfirmeFin(false)} />
          </View>
        </View>
      </Modal>
    </Ecran>
  );
}

/// « mer. 9 sept. » — la même légende que la barre du site.
function legende(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Match";
  return d.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function Chiffre({ valeur, perd }: { valeur: number; perd: boolean }) {
  return (
    <Text style={[s.chiffre, perd && s.chiffrePerd]} numberOfLines={1} adjustsFontSizeToFit>
      {valeur}
    </Text>
  );
}

/// L'état de la file, en trois mots.
///
/// Ce qui compte au bord du terrain n'est pas le détail mais la réponse à une
/// seule question : « est-ce que ce que je viens de taper est parti ? »
function Pastille({ etat }: { etat: EtatSynchro | null }) {
  if (!etat) return <View style={{ width: 92 }} />;
  const texte = etat.reconnexionRequise
    ? "Reconnecte-toi"
    : etat.bloquees > 0
      ? `${etat.bloquees} refusée${etat.bloquees > 1 ? "s" : ""}`
      : etat.enAttente > 0
        ? `${etat.enAttente} à envoyer`
        : !etat.enLigne
          ? "Hors ligne"
          : "À jour";
  const alerte = etat.reconnexionRequise || etat.bloquees > 0;
  return (
    <Text
      style={[s.pastilleTexte, { color: alerte ? "#ff453a" : "rgba(255,255,255,0.5)" }]}
      numberOfLines={1}
    >
      {texte}
    </Text>
  );
}

const s = StyleSheet.create({
  centre: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  aide: { fontSize: 15 },

  barre: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  legende: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "rgba(255,255,255,0.62)",
    textAlign: "center",
  },
  pastilleTexte: { width: 92, fontSize: 13, textAlign: "right" },

  marque: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 6,
  },
  chiffre: {
    flex: 1,
    fontSize: 132,
    fontWeight: "800",
    letterSpacing: -6.6,
    lineHeight: 138,
    textAlign: "center",
    color: "#ffffff",
  },
  chiffrePerd: { color: "rgba(255,255,255,0.4)" },
  milieu: { alignItems: "center", gap: 4, paddingHorizontal: 8, minWidth: 116 },
  etatLigne: { flexDirection: "row", alignItems: "center", gap: 7 },
  point: { width: 8, height: 8, borderRadius: 4 },
  etat: { fontSize: 17, fontWeight: "600" },
  horloge: { fontSize: 17, fontWeight: "500", color: "rgba(255,255,255,0.7)" },
  periode: { fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.5)" },

  equipes: { flexDirection: "row", paddingHorizontal: 24, paddingTop: 4 },
  equipe: { flex: 1, alignItems: "center", gap: 8, minWidth: 0 },
  nomEquipe: { fontSize: 22, fontWeight: "600", letterSpacing: -0.3 },

  corps: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 },
  cartes: { flexDirection: "row", gap: 10 },
  carte: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.085)",
    overflow: "hidden",
    minWidth: 0,
  },
  joueur: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 58,
    paddingHorizontal: 12,
  },
  separe: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)" },
  nomJoueur: { flex: 1, fontSize: 17, fontWeight: "500" },
  buts: { fontSize: 22, fontWeight: "700", minWidth: 14, textAlign: "right" },
  csc: { height: 46, alignItems: "center", justifyContent: "center" },
  cscTexte: { fontSize: 15, fontWeight: "600", color: "rgba(255,255,255,0.55)" },

  invite: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "rgba(14,14,24,0.94)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.12)",
  },
  inviteTitre: { fontSize: 15, fontWeight: "600", marginBottom: 8 },
  choix: { gap: 8, paddingRight: 14 },
  pastille: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  pied: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 10,
  },

  voile: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  boite: { width: "100%", maxWidth: 340, borderRadius: 26, borderWidth: 1, padding: 20 },
  boiteTitre: { fontSize: 20, fontWeight: "600", textAlign: "center", paddingBottom: 8 },
});
