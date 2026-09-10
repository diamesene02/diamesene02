import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { router, useGlobalSearchParams, useLocalSearchParams } from "expo-router";
import Ecran from "../../composants/Ecran";
import { Avatar, BoutonRond, EcussonChasuble, Poignee } from "../../composants/base";
import { JETONS_NEUTRES, type Jetons } from "../../lib/couleurs";
import { themeTokens } from "../../lib/noyau/theme";
import {
  chargerFicheJoueur,
  reglerAbonnement,
  SessionExpiree,
  type FicheJoueur,
} from "../../lib/api";

/// La fiche d'un joueur — la carte d'identité du vestiaire.
///
/// L'ordre est celui du site, parce que c'est l'ordre dans lequel on regarde :
/// la photo et le sous-titre (« Blanc · Niveau 4 · 2e du tableau »), les
/// quatre chiffres, ce qu'il reste à deux pas, la forme, les derniers matchs,
/// les trophées, la saison par saison.
///
/// Un seul geste possible ici : « Vient tous les lundis ». C'est le réglage
/// qui fait qu'un habitué compte présent sans rien dire — et il change assez
/// souvent (une blessure, un déménagement) pour mériter d'être à portée de
/// pouce plutôt que dans un écran de réglages.
export default function Joueur() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { clubId } = useGlobalSearchParams<{ clubId?: string }>();
  const [fiche, setFiche] = useState<FicheJoueur | null>(null);
  // Le club résolu : l'écran s'ouvre parfois sans lui (un lien direct), et
  // l'interrupteur d'abonnement a besoin de l'identifiant pour écrire.
  const [club, setClub] = useState<string | null>(clubId ?? null);
  const [occupe, setOccupe] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    if (!id) return;
    setErreur(null);
    try {
      const { chargerMoi } = await import("../../lib/api");
      const cid = clubId ?? (await chargerMoi()).clubs[0]?.id;
      if (!cid) throw new Error("Aucun club.");
      setClub(cid);
      setFiche(await chargerFicheJoueur(cid, id));
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

  const couleurA = fiche?.chasubles.a ?? "#ffffff";
  const couleurB = fiche?.chasubles.b ?? "#111111";
  const t: Jetons = fiche ? themeTokens(couleurA, couleurB, "dark") : JETONS_NEUTRES;
  const j = fiche?.joueur;
  const bilan = fiche?.bilan ?? null;

  return (
    <Ecran t={t} chasubles={{ a: couleurA, b: couleurB }}>
      <Poignee />
      <View style={s.barre}>
        <BoutonRond t={t} symbole="‹" etiquette="Retour" onPress={() => router.back()} />
        <View style={{ flex: 1 }} />
        {/* « Modifier » là où le site met son bouton : sur la fiche, pas dans
            la liste. On corrige un niveau ou un surnom en regardant la fiche,
            pas en balayant le vestiaire. La place de 44 px était déjà réservée
            pour garder le titre centré ; elle sert enfin à quelque chose. */}
        {fiche?.droits.peutModifier && club ? (
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/joueur/edition",
                params: { clubId: club, joueur: id },
              })
            }
            style={({ pressed }) => [s.modifier, pressed && { opacity: 0.6 }]}
          >
            <Text style={[s.modifierTexte, { color: t.ink }]}>Modifier</Text>
          </Pressable>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={s.contenu}
        refreshControl={
          <RefreshControl
            refreshing={occupe && fiche != null}
            onRefresh={charger}
            tintColor={t.i2}
          />
        }
      >
        {occupe && !fiche && (
          <View style={s.centre}>
            <ActivityIndicator color={t.ink} />
            <Text style={[s.aide, { color: t.i2 }]}>Un instant…</Text>
          </View>
        )}
        {erreur && <Text style={[s.erreur, { color: t.bad }]}>{erreur}</Text>}

        {fiche && j && (
          <>
            <View style={s.tete}>
              <View>
                <Avatar
                  nom={j.nom}
                  photo={j.photo}
                  t={t}
                  taille={128}
                  epaisseur={4}
                  corps={40}
                  anneau={j.camp ? j.couleur : t.cb}
                />
                {j.camp && (
                  <View style={s.badge}>
                    <EcussonChasuble couleur={j.couleur} lettre={j.badge} taille={40} />
                  </View>
                )}
              </View>
              <Text style={[s.nom, { color: t.ink }]}>{j.nom}</Text>
              {j.surnom && <Text style={[s.sous, { color: t.i2 }]}>« {j.surnom} »</Text>}
              <Text style={[s.sous, { color: t.i2 }]}>{j.sousTitre}</Text>
            </View>

            {bilan && bilan.matchs > 0 ? (
              <>
                <View style={[s.carte, s.chiffres, { borderColor: t.cb, backgroundColor: t.cdSolid }]}>
                  <Chiffre t={t} n={String(bilan.matchs)} l="Matchs" />
                  <Chiffre t={t} n={String(bilan.buts)} l="Buts" />
                  <Chiffre t={t} n={String(bilan.hommeDuMatch)} l="Homme du match" />
                  <Chiffre t={t} n={String(bilan.pctVictoires)} petit="%" l="Victoires" />
                </View>

                {fiche.gardien && (
                  <View style={[s.carte, s.carteListe, { borderColor: t.cb, backgroundColor: t.cdSolid }]}>
                    <Text style={[s.titreCarte, { color: t.ink }]}>Dans les buts</Text>
                    <Ligne t={t} l="Matchs gardés" v={String(fiche.gardien.matchs)} premiere />
                    <Ligne
                      t={t}
                      l="Buts encaissés"
                      v={String(fiche.gardien.butsEncaisses)}
                      apres={`· ${nombre(fiche.gardien.moyenne, 1)} par match`}
                    />
                    <Ligne t={t} l="Matchs sans encaisser" v={String(fiche.gardien.cleanSheets)} />
                    <Ligne t={t} l="Victoires quand il garde" v={`${fiche.gardien.pctVictoires} %`} />
                  </View>
                )}

                {fiche.paliers.length > 0 && (
                  <View style={[s.carte, s.cartePaliers, { borderColor: t.cb, backgroundColor: t.cdSolid }]}>
                    <Text style={[s.titreCarte, { color: t.ink }]}>Prochains paliers</Text>
                    {fiche.paliers.map((p, i) => (
                      <View
                        key={p.cle}
                        style={[
                          s.palier,
                          i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.sep },
                        ]}
                      >
                        <View style={s.palierTete}>
                          <Text style={[s.palierQuoi, { color: t.ink }]} numberOfLines={1}>
                            {p.titre}
                          </Text>
                          <Text style={[s.palierCompte, { color: t.i2 }]}>{p.libelle}</Text>
                        </View>
                        {/* La barre dit la même chose que le texte, en un coup
                            d'œil : on voit tout de suite si c'est pour lundi
                            prochain ou pour la saison prochaine. */}
                        <View style={[s.barreFond, { backgroundColor: t.sep }]}>
                          <View
                            style={[
                              s.barrePleine,
                              { width: `${Math.round(p.part * 100)}%`, backgroundColor: couleurA },
                            ]}
                          />
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                <View style={[s.carte, s.carteListe, { borderColor: t.cb, backgroundColor: t.cdSolid }]}>
                  {fiche.droits.peutReglerAbonnement && club && (
                    <Abonnement
                      t={t}
                      clubId={club}
                      joueurId={j.id}
                      depart={j.abonne}
                      estMoi={j.estMoi}
                      nom={j.nom}
                    />
                  )}
                  <Ligne
                    t={t}
                    l="Forme"
                    premiere={!(fiche.droits.peutReglerAbonnement && club)}
                    milieu={<Forme t={t} resultats={bilan.forme} />}
                    v={
                      bilan.serie > 0
                        ? `+${bilan.serie}`
                        : bilan.serie < 0
                          ? String(bilan.serie)
                          : "—"
                    }
                    teinte={bilan.serie > 0 ? t.ok : bilan.serie < 0 ? t.bad : undefined}
                  />
                  <Ligne
                    t={t}
                    l="Élo"
                    // Séparateur de milliers à la française, comme le site :
                    // « 1 240 », pas « 1240 ».
                    v={nombre(bilan.elo)}
                    apres={
                      bilan.eloTendance !== 0
                        ? bilan.eloTendance > 0
                          ? `+${bilan.eloTendance}`
                          : String(bilan.eloTendance)
                        : undefined
                    }
                    teinteApres={bilan.eloTendance > 0 ? t.ok : t.bad}
                  />
                  <Ligne t={t} l="Buts par match" v={nombre(bilan.butsParMatch, 0, 2)} />
                  {fiche.passesSuivies && bilan.passes > 0 && (
                    <Ligne t={t} l="Passes décisives" v={String(bilan.passes)} />
                  )}
                </View>

                {fiche.derniersMatchs.length > 0 && (
                  <View style={[s.carte, s.carteListe, { borderColor: t.cb, backgroundColor: t.cdSolid }]}>
                    <Text style={[s.titreCarte, { color: t.ink }]}>Derniers matchs</Text>
                    {fiche.derniersMatchs.map((m) => (
                      <Pressable
                        key={m.id}
                        onPress={() =>
                          router.push({
                            pathname: "/recap/[id]",
                            params: { id: m.id, ...(club ? { clubId: club } : null) },
                          })
                        }
                        style={({ pressed }) => [
                          s.match,
                          { borderTopColor: t.sep },
                          pressed && { opacity: 0.7 },
                        ]}
                      >
                        <Text style={[s.matchDate, { color: t.i2 }]}>{m.date}</Text>
                        <Text style={[s.matchScore, { color: t.ink }]} numberOfLines={1}>
                          <Text style={m.scoreA > m.scoreB && s.gagne}>
                            {m.gauche} {m.scoreA}
                          </Text>
                          {" – "}
                          <Text style={m.scoreB > m.scoreA && s.gagne}>
                            {m.scoreB} {m.droite}
                          </Text>
                        </Text>
                        <Text style={[s.matchButs, { color: t.ink }]}>
                          {m.buts > 0 ? `${m.buts} but${m.buts > 1 ? "s" : ""}` : m.homme ? "★" : ""}
                          {m.buts > 0 && m.homme ? " ★" : ""}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}

                {fiche.trophees.length > 0 && (
                  <View style={[s.carte, s.carteTrophees, { borderColor: t.cb, backgroundColor: t.cdSolid }]}>
                    <Text style={[s.titreCarte, { color: t.ink }]}>Trophées</Text>
                    <View style={s.grille}>
                      {fiche.trophees.map((tr) => (
                        <View
                          key={tr.cle}
                          style={[s.trophee, { backgroundColor: t.seg, borderColor: t.cb }]}
                        >
                          <Text style={[s.tropheeNom, { color: t.ink }]}>{tr.nom}</Text>
                          <Text style={[s.tropheeDetail, { color: t.i2 }]}>{tr.detail}</Text>
                          {tr.quand && (
                            <Text style={[s.tropheeQuand, { color: t.i3 }]}>{tr.quand}</Text>
                          )}
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {fiche.parSaison.length > 1 && (
                  <View style={[s.carte, s.carteListe, { borderColor: t.cb, backgroundColor: t.cdSolid }]}>
                    <Text style={[s.titreCarte, { color: t.ink }]}>Par saison</Text>
                    {fiche.parSaison.map((sn) => (
                      <View
                        key={sn.saisonId ?? "sans"}
                        style={[s.match, s.saison, { borderTopColor: t.sep }]}
                      >
                        <Text style={[s.matchScore, { color: t.ink }]} numberOfLines={1}>
                          <Text style={s.gagne}>{sn.saison}</Text> · {sn.matchs} match
                          {sn.matchs > 1 ? "s" : ""}
                        </Text>
                        <Text style={[s.matchButs, { color: t.ink }]}>
                          {sn.buts} but{sn.buts > 1 ? "s" : ""} · {sn.pctVictoires} %
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            ) : (
              <View style={[s.carte, s.carteListe, { borderColor: t.cb, backgroundColor: t.cdSolid }]}>
                <Text style={[s.vide, { color: t.i2 }]}>
                  Aucun match joué pour l&apos;instant. Ça se règle sur le terrain.
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </Ecran>
  );
}

/// « Vient tous les lundis » — l'interrupteur, et rien d'autre.
///
/// L'affichage bascule tout de suite et revient en arrière si le serveur
/// refuse : ce réglage se change au moment où on y pense, souvent avec un
/// réseau médiocre, et attendre l'aller-retour donnerait l'impression que le
/// bouton ne marche pas.
function Abonnement({
  t,
  clubId,
  joueurId,
  depart,
  estMoi,
  nom,
}: {
  t: Jetons;
  clubId: string;
  joueurId: string;
  depart: boolean;
  estMoi: boolean;
  nom: string;
}) {
  const [abonne, setAbonne] = useState(depart);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const basculer = async (v: boolean) => {
    setErreur(null);
    setAbonne(v);
    setOccupe(true);
    try {
      await reglerAbonnement(clubId, joueurId, v);
    } catch (e) {
      setAbonne(!v);
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setOccupe(false);
    }
  };

  return (
    <>
      <View style={s.ligne}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[s.ligneL, { color: t.ink }]}>Vient tous les lundis</Text>
          <Text style={[s.ligneAide, { color: t.i2 }]}>
            Compté présent d&apos;office.{" "}
            {estMoi
              ? "Tu peux toujours te déclarer absent sur une soirée."
              : `${nom} peut toujours se déclarer absent sur une soirée.`}
          </Text>
        </View>
        <Switch
          value={abonne}
          onValueChange={basculer}
          disabled={occupe}
          trackColor={{ true: t.ok, false: t.seg }}
          accessibilityLabel="Vient tous les lundis"
        />
      </View>
      {erreur && <Text style={[s.vide, { color: t.bad }]}>{erreur}</Text>}
    </>
  );
}

function Chiffre({ t, n, petit, l }: { t: Jetons; n: string; petit?: string; l: string }) {
  return (
    <View style={s.chiffre}>
      <Text style={[s.chiffreN, { color: t.ink }]} adjustsFontSizeToFit numberOfLines={1}>
        {n}
        {petit && <Text style={s.chiffrePetit}>{petit}</Text>}
      </Text>
      <Text style={[s.chiffreL, { color: t.i2 }]} numberOfLines={2}>
        {l}
      </Text>
    </View>
  );
}

function Ligne({
  t,
  l,
  v,
  apres,
  milieu,
  premiere,
  teinte,
  teinteApres,
}: {
  t: Jetons;
  l: string;
  v: string;
  apres?: string;
  milieu?: React.ReactNode;
  premiere?: boolean;
  teinte?: string;
  teinteApres?: string;
}) {
  return (
    <View
      style={[
        s.ligne,
        !premiere && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.sep },
      ]}
    >
      <Text style={[s.ligneL, { color: t.ink }]}>{l}</Text>
      {milieu}
      <Text style={[s.ligneV, { color: teinte ?? t.ink }, teinte != null && s.ligneVFort]}>
        {v}
        {apres && <Text style={{ color: teinteApres ?? t.i2, fontWeight: "400" }}> {apres}</Text>}
      </Text>
    </View>
  );
}

/// La forme : cinq carrés V / N / D, comme sur le site.
function Forme({ t, resultats }: { t: Jetons; resultats: ("W" | "D" | "L")[] }) {
  return (
    <View style={s.forme}>
      {resultats.map((r, i) => (
        <View
          key={i}
          style={[
            s.formeCase,
            { backgroundColor: r === "W" ? t.ok : r === "D" ? t.seg : t.bad },
          ]}
        >
          <Text
            style={[s.formeLettre, { color: r === "W" ? "#04230d" : r === "D" ? t.ink : "#fff" }]}
          >
            {r === "W" ? "V" : r === "D" ? "N" : "D"}
          </Text>
        </View>
      ))}
    </View>
  );
}

/// Les nombres à la française : la virgule décimale, et pas plus de chiffres
/// qu'il n'en faut. `Intl` est présent sur iOS comme sur Android modernes.
function nombre(n: number, min = 0, max = min): string {
  return n.toLocaleString("fr-FR", {
    minimumFractionDigits: min,
    maximumFractionDigits: Math.max(min, max),
  });
}

const s = StyleSheet.create({
  barre: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingBottom: 4 },
  modifier: { minWidth: 44, height: 44, justifyContent: "center", alignItems: "flex-end" },
  modifierTexte: { fontSize: 16, fontWeight: "600" },
  contenu: { paddingHorizontal: 14, paddingBottom: 40 },
  centre: { paddingTop: 60, alignItems: "center", gap: 12 },
  aide: { fontSize: 15 },
  erreur: { fontSize: 15, textAlign: "center", paddingTop: 24 },

  tete: { alignItems: "center", paddingTop: 10 },
  badge: { position: "absolute", right: -4, bottom: -2 },
  nom: { fontSize: 34, fontWeight: "700", letterSpacing: -0.5, marginTop: 16, textAlign: "center" },
  sous: { fontSize: 17, marginTop: 4, textAlign: "center" },

  carte: { borderRadius: 28, borderWidth: 1, marginTop: 14 },
  carteListe: { paddingHorizontal: 20 },
  titreCarte: { fontSize: 20, fontWeight: "600", paddingTop: 20, paddingBottom: 8 },

  chiffres: { flexDirection: "row", marginTop: 22, paddingVertical: 18, paddingHorizontal: 8 },
  chiffre: { flex: 1, alignItems: "center" },
  chiffreN: { fontSize: 34, fontWeight: "700", letterSpacing: -0.5 },
  chiffrePetit: { fontSize: 20 },
  chiffreL: { fontSize: 13, marginTop: 2, textAlign: "center" },

  ligne: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 60,
    paddingVertical: 10,
  },
  ligneL: { fontSize: 17, fontWeight: "600", flexShrink: 1 },
  ligneAide: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  ligneV: { fontSize: 17 },
  ligneVFort: { fontWeight: "600" },

  forme: { flexDirection: "row", gap: 5 },
  formeCase: { width: 26, height: 26, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  formeLettre: { fontSize: 12, fontWeight: "700" },

  cartePaliers: { paddingHorizontal: 18, paddingBottom: 16 },
  palier: { paddingTop: 10, paddingBottom: 4 },
  palierTete: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 10 },
  palierQuoi: { fontSize: 15, fontWeight: "600", flexShrink: 1 },
  palierCompte: { fontSize: 13 },
  barreFond: { height: 5, borderRadius: 3, marginTop: 7, overflow: "hidden" },
  barrePleine: { height: 5, borderRadius: 3 },

  match: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 56,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  saison: { justifyContent: "space-between" },
  matchDate: { fontSize: 17, width: 64 },
  matchScore: { fontSize: 17, flex: 1, minWidth: 0 },
  matchButs: { fontSize: 17, fontWeight: "600" },
  gagne: { fontWeight: "600" },

  carteTrophees: { paddingHorizontal: 18, paddingBottom: 18 },
  grille: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  trophee: { flexGrow: 1, flexBasis: 140, borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, gap: 2 },
  tropheeNom: { fontSize: 15, fontWeight: "700" },
  tropheeDetail: { fontSize: 13 },
  tropheeQuand: { fontSize: 13, marginTop: 2 },

  vide: { fontSize: 15, paddingTop: 14, paddingBottom: 16 },
});
