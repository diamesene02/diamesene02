import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import Ecran from "../../composants/Ecran";
import { Avatar, BoutonPlein, EcussonChasuble } from "../../composants/base";
import { useNoyau } from "../../composants/Noyau";
import { JETONS_NEUTRES, type Jetons } from "../../lib/couleurs";
import { fmt } from "../../lib/noyau/clock";
import {
  chargerAccueil,
  chargerMoi,
  SessionExpiree,
  type Accueil,
  type ClubDeMoi,
} from "../../lib/api";

/// L'accueil du club — repris de la page du site.
///
/// Trois blocs, dans cet ordre, parce que c'est l'ordre des questions qu'on se
/// pose en ouvrant l'app : est-ce que je viens lundi, où en est la soirée en
/// cours, et où j'en suis dans la saison.
///
/// Un seul aller-retour les alimente (`GET .../accueil`). La page web en fait
/// une quinzaine, ce qui est le bon choix sur un serveur ; sur un téléphone au
/// bord d'un terrain, chacun se paie en secondes et en batterie.

export default function ClubAccueil() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { local } = useNoyau();

  const [club, setClub] = useState<ClubDeMoi | null>(null);
  const [donnees, setDonnees] = useState<Accueil | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [onglet, setOnglet] = useState<"soir" | "venir">("soir");
  const [banniereFermee, setBanniereFermee] = useState(false);

  const t: Jetons = club?.theme.sombre ?? JETONS_NEUTRES;

  const charger = useCallback(async () => {
    if (!id) return;
    setErreur(null);
    try {
      const [moi, a] = await Promise.all([chargerMoi(), chargerAccueil(id)]);
      setClub(moi.clubs.find((c) => c.id === id) ?? null);
      setDonnees(a);
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

  // Au retour de la feuille de match, le match en cours a pu se terminer et un
  // score a pu changer. On relit à chaque fois que l'écran reprend la main.
  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      void local.getLiveMatchOfClub(id).then((m) => setEnCours(m?.id ?? null));
      void charger();
    }, [id, local, charger]),
  );

  const couleurA = club?.couleurA ?? "#ffffff";
  const couleurB = club?.couleurB ?? "#111111";

  const matchs = donnees?.matchs ?? [];
  const aVenir = useMemo(
    () => matchs.filter((m) => Date.parse(m.joueLe) > Date.now()),
    [matchs],
  );
  const ceSoir = useMemo(
    () => matchs.filter((m) => Date.parse(m.joueLe) <= Date.now()),
    [matchs],
  );
  const listeVisible = onglet === "soir" ? ceSoir : aVenir;

  const soiree = donnees?.soiree ?? null;
  const jours = soiree ? joursAvant(soiree.date) : null;

  return (
    <Ecran t={t} chasubles={{ a: couleurA, b: couleurB }}>
      <View style={[s.entete, { borderBottomColor: t.sep }]}>
        <Text style={[s.marque, { color: t.ink }]}>Five Scorer</Text>
        {club && (
          <Pressable
            onPress={() => router.push("/clubs")}
            style={[s.pilule, { borderColor: t.cb, backgroundColor: t.cdSolid }]}
          >
            <EcussonChasuble couleur={couleurA} lettre={club.nom[0] ?? "F"} taille={24} />
            <Text style={[s.piluleTexte, { color: t.ink }]} numberOfLines={1}>
              {club.nom}
            </Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        contentContainerStyle={s.contenu}
        refreshControl={
          <RefreshControl refreshing={occupe && donnees != null} onRefresh={charger} tintColor={t.i2} />
        }
      >
        {occupe && !donnees && (
          <View style={s.centre}>
            <ActivityIndicator color={t.ink} />
            <Text style={[s.aide, { color: t.i2 }]}>On va chercher le club…</Text>
          </View>
        )}

        {erreur && <Text style={[s.erreur, { color: "#ff453a" }]}>{erreur}</Text>}

        {/* La bannière de présence : la première question qu'on se pose en
            ouvrant l'app un jeudi, c'est « je viens lundi ? ». */}
        {soiree && !banniereFermee && (
          <View style={s.banniere}>
            <View style={{ flex: 1 }}>
              <Text style={[s.banniereTitre, { color: t.ink }]} numberOfLines={1}>
                {dateCourte(soiree.date)}
                {soiree.libelle ? ` — ${soiree.libelle}` : ""}
              </Text>
              <Text style={[s.banniereAide, { color: t.i2 }]}>
                {soiree.phrase}
                {soiree.maReponse ? "" : " · Touche pour répondre."}
              </Text>
            </View>
            <Pressable onPress={() => setBanniereFermee(true)} hitSlop={12}>
              <Text style={[s.fermer, { color: t.i3 }]}>✕</Text>
            </Pressable>
          </View>
        )}

        {/* Le rappel ambre : le club décide ses équipes trois ou quatre jours
            avant, sur WhatsApp. Si la compo n'est pas faite, c'est LA chose à
            faire, et l'accueil doit le dire. */}
        {soiree && !soiree.compoFaite && !soiree.annulee && club?.peutGerer && (
          <Pressable
            onPress={() => router.push({ pathname: "/compo", params: { clubId: id } })}
            style={s.rappel}
          >
            <View style={{ flex: 1 }}>
              <Text style={[s.rappelTitre, { color: t.ink }]}>
                {jours != null && jours > 0
                  ? `Dans ${jours} jour${jours > 1 ? "s" : ""} — les équipes ne sont pas faites`
                  : "Les équipes ne sont pas faites"}
              </Text>
              <Text style={[s.rappelAide, { color: t.i2 }]}>
                {dateLongue(soiree.date)}
                {soiree.libelle ? ` · ${soiree.libelle}` : ""} — préparer la compo maintenant
              </Text>
            </View>
            <Text style={[s.chevron, { color: t.i3 }]}>›</Text>
          </Pressable>
        )}

        {club?.peutScorer && (
          <BoutonPlein
            t={t}
            titre={enCours ? "Reprendre le match" : "Nouveau match"}
            onPress={() =>
              enCours
                ? router.push({ pathname: "/match/[id]", params: { id: enCours } })
                : router.push({ pathname: "/compo", params: { clubId: id } })
            }
          />
        )}

        {donnees && (
          <View style={[s.carte, { borderColor: t.cb, backgroundColor: t.cdSolid }]}>
            <View style={s.onglets}>
              {(
                [
                  ["soir", "Ce soir"],
                  ["venir", "À venir"],
                ] as const
              ).map(([cle, libelle]) => (
                <Pressable key={cle} onPress={() => setOnglet(cle)} hitSlop={8}>
                  <Text
                    style={[s.onglet, { color: onglet === cle ? t.ink : "rgba(255,255,255,0.4)" }]}
                  >
                    {libelle}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={[s.filet, { backgroundColor: t.sep }]} />

            {listeVisible.length === 0 ? (
              <Text style={[s.vide, { color: t.i2 }]}>
                {onglet === "soir" ? "Pas encore de match aujourd'hui." : "Rien de programmé."}
              </Text>
            ) : (
              listeVisible.map((m, i) => (
                <Pressable
                  key={m.id}
                  onPress={() => router.push({ pathname: "/match/[id]", params: { id: m.id } })}
                  style={[s.ligneMatch, i > 0 && { borderTopWidth: 1, borderTopColor: t.sep }]}
                >
                  <View style={s.cote}>
                    <EcussonChasuble couleur={couleurA} lettre={m.nomA[0] ?? "A"} taille={48} />
                    <Text style={[s.nomCote, { color: t.i2 }]} numberOfLines={1}>
                      {m.nomA}
                    </Text>
                  </View>
                  <Text style={[s.score, { color: t.ink }]}>{m.scoreA}</Text>
                  <View style={s.milieuMatch}>
                    <Text
                      style={[
                        s.statut,
                        { color: m.statut === "LIVE" ? "#ff453a" : t.i2 },
                      ]}
                    >
                      {m.statut === "LIVE" ? "• En direct" : "Terminé"}
                    </Text>
                    <Text style={[s.heure, { color: t.i3 }]}>
                      {m.statut === "LIVE"
                        ? fmt(Math.max(0, Date.now() - Date.parse(m.joueLe)))
                        : heure(m.joueLe)}
                    </Text>
                  </View>
                  <Text style={[s.score, { color: t.ink }]}>{m.scoreB}</Text>
                  <View style={s.cote}>
                    <EcussonChasuble couleur={couleurB} lettre={m.nomB[0] ?? "B"} taille={48} />
                    <Text style={[s.nomCote, { color: t.i2 }]} numberOfLines={1}>
                      {m.nomB}
                    </Text>
                  </View>
                </Pressable>
              ))
            )}
          </View>
        )}

        {donnees && donnees.classement.length > 0 && (
          <View style={[s.carte, { borderColor: t.cb, backgroundColor: t.cdSolid }]}>
            <Text style={[s.carteTitre, { color: t.ink }]}>Tableau</Text>
            <View style={s.tableauTete}>
              <Text style={[s.colRang, { color: t.i3 }]} />
              <Text style={[s.colJoueur, { color: t.i3 }]}>Joueur</Text>
              {["MJ", "V", "N", "D", "B"].map((c) => (
                <Text key={c} style={[s.colChiffre, { color: t.i3 }]}>
                  {c}
                </Text>
              ))}
              <Text style={[s.colPoints, { color: t.i3 }]}>PTS</Text>
            </View>
            {donnees.classement.slice(0, 6).map((r) => (
              <View key={r.playerId} style={[s.rangee, { borderTopColor: t.sep }]}>
                <Text style={[s.colRang, { color: t.i2 }]}>{r.rang}</Text>
                <View style={s.joueurCell}>
                  <Avatar nom={r.nom} photo={r.photo} t={t} taille={28} />
                  <Text style={[s.nomJoueur, { color: t.ink }]} numberOfLines={1}>
                    {r.nom}
                  </Text>
                </View>
                {[r.matchs, r.victoires, r.nuls, r.defaites, r.buts].map((v, i) => (
                  <Text key={i} style={[s.colChiffre, { color: t.i2 }]}>
                    {v}
                  </Text>
                ))}
                <Text style={[s.colPoints, { color: t.ink, fontWeight: "700" }]}>{r.points}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </Ecran>
  );
}

function joursAvant(iso: string): number {
  const j = Math.ceil((Date.parse(iso) - Date.now()) / 86_400_000);
  return Number.isFinite(j) ? j : 0;
}

function dateCourte(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }) +
    " " +
    d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  );
}

function dateLongue(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function heure(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

const s = StyleSheet.create({
  entete: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  marque: { fontSize: 20, fontWeight: "700", letterSpacing: -0.3 },
  pilule: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    height: 38,
    paddingLeft: 6,
    paddingRight: 14,
    borderRadius: 19,
    borderWidth: 1,
    maxWidth: 190,
  },
  piluleTexte: { fontSize: 14, fontWeight: "600", flexShrink: 1 },

  contenu: { padding: 14, paddingBottom: 40, gap: 14 },
  centre: { paddingTop: 80, alignItems: "center", gap: 12 },
  aide: { fontSize: 15 },
  erreur: { fontSize: 15, textAlign: "center" },

  banniere: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingTop: 4 },
  banniereTitre: { fontSize: 21, fontWeight: "600" },
  banniereAide: { fontSize: 15, paddingTop: 4 },
  fermer: { fontSize: 17, padding: 4 },

  rappel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    borderLeftWidth: 3,
    borderLeftColor: "#ffd60a",
    backgroundColor: "rgba(0,0,0,0.3)",
    padding: 12,
  },
  rappelTitre: { fontSize: 17, fontWeight: "600" },
  rappelAide: { fontSize: 13, paddingTop: 4 },
  chevron: { fontSize: 22 },

  carte: { borderRadius: 28, borderWidth: 1, overflow: "hidden" },
  carteTitre: {
    fontSize: 22,
    fontWeight: "600",
    textAlign: "center",
    paddingTop: 20,
    paddingBottom: 12,
  },
  onglets: { flexDirection: "row", justifyContent: "center", gap: 24, height: 62, alignItems: "center" },
  onglet: { fontSize: 20, fontWeight: "600" },
  filet: { height: StyleSheet.hairlineWidth },
  vide: { fontSize: 15, textAlign: "center", paddingVertical: 28 },

  ligneMatch: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 14,
  },
  cote: { width: 60, alignItems: "center", gap: 4 },
  nomCote: { fontSize: 12 },
  score: { fontSize: 34, fontWeight: "800", minWidth: 26, textAlign: "center" },
  milieuMatch: { flex: 1, alignItems: "center", gap: 2 },
  statut: { fontSize: 14, fontWeight: "700" },
  heure: { fontSize: 13 },

  tableauTete: { flexDirection: "row", alignItems: "center", height: 28, paddingHorizontal: 12 },
  rangee: {
    flexDirection: "row",
    alignItems: "center",
    height: 54,
    paddingHorizontal: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  colRang: { width: 18, fontSize: 13 },
  colJoueur: { flex: 1, fontSize: 13, paddingLeft: 8 },
  joueurCell: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 },
  nomJoueur: { fontSize: 17, flexShrink: 1 },
  colChiffre: { width: 26, fontSize: 13, textAlign: "center" },
  colPoints: { width: 34, fontSize: 13, textAlign: "right" },
});
