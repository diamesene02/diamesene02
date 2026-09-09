import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect, useGlobalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ecran from "../../../composants/Ecran";
import { Avatar, EcussonChasuble, Poignee } from "../../../composants/base";
import {
  IconeBallonFin,
  IconePasse,
  IconeTrophee,
} from "../../../composants/Icones";
import { JETONS_NEUTRES, type Jetons } from "../../../lib/couleurs";
import {
  chargerMoi,
  chargerStats,
  SessionExpiree,
  type ClubDeMoi,
  type EcranStats,
} from "../../../lib/api";

/// « Stats » — le même écran que celui du site, dans le même ordre.
///
/// Une carte à trois onglets (le tableau, les buteurs, la forme), le palmarès
/// de la période, le derby, les gardiens, les records, et le bilan contre les
/// adversaires extérieurs quand il y en a.
///
/// Tout vient d'un seul `GET .../stats` : la page web en fait une quinzaine,
/// ce qui va très bien sur un serveur. Ici, chaque aller-retour se paie en
/// secondes — et l'écran doit s'afficher entier, pas carte par carte.
type Vue = "tableau" | "buteurs" | "forme";

export default function Stats() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const [club, setClub] = useState<ClubDeMoi | null>(null);
  const [d, setD] = useState<EcranStats | null>(null);
  const [saison, setSaison] = useState<string | undefined>(undefined);
  const [choixOuvert, setChoixOuvert] = useState(false);
  const [vue, setVue] = useState<Vue>("tableau");
  const [occupe, setOccupe] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const bas = useSafeAreaInsets().bottom;

  const t: Jetons = club?.theme.sombre ?? JETONS_NEUTRES;

  const charger = useCallback(async () => {
    if (!id) return;
    setErreur(null);
    try {
      const [moi, r] = await Promise.all([chargerMoi(), chargerStats(id, saison)]);
      setClub(moi.clubs.find((c) => c.id === id) ?? null);
      setD(r);
    } catch (e) {
      if (e instanceof SessionExpiree) return router.replace("/connexion");
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setOccupe(false);
    }
  }, [id, saison]);

  useEffect(() => {
    void charger();
  }, [charger]);

  // Un match terminé pendant qu'on était ailleurs change tout le tableau.
  useFocusEffect(
    useCallback(() => {
      void charger();
    }, [charger]),
  );

  const couleurA = club?.couleurA ?? "#ffffff";
  const couleurB = club?.couleurB ?? "#111111";
  const courante =
    d?.saisons.choix.find((c) => c.id === d.saisons.choisie)?.libelle ?? "";
  const vide = d != null && d.tableau.length === 0;

  /// L'anneau d'un avatar : la variante REDRESSÉE de la chasuble (`taR`/`tbR`),
  /// pas la couleur brute. Une chasuble noire peinte telle quelle disparaît
  /// sur une carte sombre — la règle est celle de `lib/theme.ts`.
  const anneau = (c: "A" | "B" | null) =>
    c === "A" ? t.taR : c === "B" ? t.tbR : undefined;

  const ouvrirFiche = (playerId: string) =>
    router.push({ pathname: "/joueur/[id]", params: { id: playerId, clubId: id } });

  return (
    <Ecran t={t} chasubles={{ a: couleurA, b: couleurB }}>
      <ScrollView
        contentContainerStyle={s.contenu}
        refreshControl={
          <RefreshControl refreshing={occupe && d != null} onRefresh={charger} tintColor={t.i2} />
        }
      >
        <View style={s.tete}>
          <Text style={[s.titre, { color: t.ink }]} numberOfLines={1}>
            Stats
          </Text>
          {d && d.saisons.choix.length > 1 && (
            <Pressable
              onPress={() => setChoixOuvert(true)}
              accessibilityLabel="Choisir la saison"
              style={({ pressed }) => [
                s.pilule,
                { borderColor: t.cb, backgroundColor: t.cdSolid },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={[s.piluleTexte, { color: t.ink }]} numberOfLines={1}>
                {courante}
              </Text>
              <Text style={[s.fleche, { color: t.i2 }]}>▾</Text>
            </Pressable>
          )}
        </View>

        {occupe && !d && (
          <View style={s.centre}>
            <ActivityIndicator color={t.ink} />
            <Text style={[s.aide, { color: t.i2 }]}>On compte les points…</Text>
          </View>
        )}
        {erreur && <Text style={[s.erreur, { color: t.bad }]}>{erreur}</Text>}

        {/* L'état vide est le SQUELETTE du tableau, avec des tirets à la place
            des chiffres : une feuille vierge doit se reconnaître vierge, elle
            ne se présente pas comme une erreur. */}
        {vide && (
          <Carte t={t}>
            <Onglets t={t} vue="tableau" onChange={() => {}} inerte />
            <Filet t={t} />
            <EnTeteTableau t={t} />
            {[0, 1, 2].map((i) => (
              <View key={i} style={s.rangeeTableau}>
                <Text style={[s.tRang, { color: t.i3 }]}>—</Text>
                <View style={{ width: 30 }} />
                <Text style={[s.tNom, { color: t.i3 }]}>—</Text>
                <Text style={[s.tMj, { color: t.i3 }]}>—</Text>
                <Text style={[s.tPetit, { color: t.i3 }]}>—</Text>
                <Text style={[s.tPetit, { color: t.i3 }]}>—</Text>
                <Text style={[s.tPetit, { color: t.i3 }]}>—</Text>
                <Text style={[s.tMj, { color: t.i3 }]}>—</Text>
                <Text style={[s.tPts, { color: t.i3 }]}>—</Text>
              </View>
            ))}
            <Text style={[s.vide, { color: t.i2 }]}>
              Aucun match terminé sur cette période.
            </Text>
          </Carte>
        )}

        {d && !vide && (
          <>
            <Carte t={t}>
              <Onglets t={t} vue={vue} onChange={setVue} />
              <Filet t={t} />

              {vue === "tableau" && (
                <View>
                  <EnTeteTableau t={t} />
                  {d.tableau.map((l, i) => (
                    <Pressable
                      key={l.playerId}
                      onPress={() => ouvrirFiche(l.playerId)}
                      style={({ pressed }) => [
                        s.rangeeTableau,
                        i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.sep },
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <Text style={[s.tRang, { color: t.ink }]}>{l.rang}</Text>
                      <Avatar nom={l.nom} photo={l.photo} t={t} taille={30} anneau={anneau(l.camp)} />
                      <Text style={[s.tNom, { color: t.ink }]} numberOfLines={1}>
                        {l.nom}
                        {l.invite && <Text style={{ color: t.i3 }}> (inv.)</Text>}
                      </Text>
                      <Text style={[s.tMj, { color: t.ink }]}>{l.matchs}</Text>
                      <Text style={[s.tPetit, { color: t.ink }]}>{l.victoires}</Text>
                      <Text style={[s.tPetit, { color: t.ink }]}>{l.nuls}</Text>
                      <Text style={[s.tPetit, { color: t.ink }]}>{l.defaites}</Text>
                      <Text style={[s.tMj, { color: t.ink }]}>{l.buts}</Text>
                      <Text style={[s.tPts, { color: t.ink }]}>{l.points}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {vue === "buteurs" && (
                <View>
                  {d.buteurs.map((b, i) => (
                    <Pressable
                      key={b.playerId}
                      onPress={() => ouvrirFiche(b.playerId)}
                      style={({ pressed }) => [
                        s.rangee,
                        i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.sep },
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <Text style={[s.bRang, { color: t.ink }]}>{b.rang}</Text>
                      <Avatar nom={b.nom} photo={b.photo} t={t} taille={30} anneau={anneau(b.camp)} />
                      <View style={s.bBloc}>
                        <Text style={[s.nom, { color: t.ink }]} numberOfLines={1}>
                          {b.nom}
                        </Text>
                        {/* La barre se lit par rapport au MEILLEUR buteur : ce
                            qu'on veut voir, c'est l'écart au premier. */}
                        <View style={[s.barreFond, { backgroundColor: t.sep }]}>
                          <View
                            style={[
                              s.barrePleine,
                              {
                                width: `${Math.round(b.part * 100)}%`,
                                backgroundColor: anneau(b.camp) ?? t.i3,
                              },
                            ]}
                          />
                        </View>
                      </View>
                      <Text style={[s.bButs, { color: t.ink }]}>{b.buts}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {vue === "forme" && (
                <View>
                  {d.forme.map((f, i) => (
                    <Pressable
                      key={f.playerId}
                      onPress={() => ouvrirFiche(f.playerId)}
                      style={({ pressed }) => [
                        s.rangee,
                        { gap: 10 },
                        i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.sep },
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <Avatar nom={f.nom} photo={f.photo} t={t} taille={30} anneau={anneau(f.camp)} />
                      <Text style={[s.nom, { color: t.ink, flex: 1 }]} numberOfLines={1}>
                        {f.nom}
                      </Text>
                      <Forme t={t} resultats={f.forme} />
                      <Text
                        style={[
                          s.serie,
                          { color: f.serie > 0 ? t.ok : f.serie < 0 ? t.bad : t.i3 },
                        ]}
                      >
                        {f.serie > 0 ? `+${f.serie}` : f.serie < 0 ? `−${Math.abs(f.serie)}` : "—"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </Carte>

            {d.palmares.titres.length > 0 && (
              <Carte t={t} titre={d.palmares.titre} rembourrage={20}>
                {d.palmares.titres.map((ti, i) => (
                  <Pressable
                    key={ti.cle}
                    onPress={() => ouvrirFiche(ti.playerId)}
                    style={({ pressed }) => [
                      s.ligneTitre,
                      i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.sep },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <View style={s.icone}>
                      {ti.icone === "trophee" && <IconeTrophee couleur={t.or ?? "#ffd60a"} />}
                      {ti.icone === "ballon" && <IconeBallonFin couleur={t.ink} />}
                      {ti.icone === "passe" && <IconePasse couleur={t.ink} />}
                    </View>
                    <Text style={[s.libelle, { color: t.ink }]} numberOfLines={1}>
                      {ti.libelle}
                    </Text>
                    <Text style={[s.laureat, { color: t.ink }]} numberOfLines={1}>
                      {ti.nom} · {ti.valeur}
                    </Text>
                  </Pressable>
                ))}
              </Carte>
            )}

            {d.saisonsPassees.length > 0 && (
              <Carte t={t} titre="Palmarès des saisons clôturées" rembourrage={20}>
                {d.saisonsPassees.map((h, i) => (
                  <View
                    key={h.saison}
                    style={[
                      s.saisonClose,
                      i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.sep },
                    ]}
                  >
                    <Text style={[s.saisonNom, { color: t.ink }]}>{h.saison}</Text>
                    <Text style={[s.saisonLaureats, { color: t.i2 }]}>
                      {h.vide ? "Saison sans relief." : h.lignes.join("  ·  ")}
                    </Text>
                  </View>
                ))}
              </Carte>
            )}

            {d.derby && (
              <Carte t={t} titre={d.derby.titre} rembourrage={16}>
                <View style={s.derbyCamps}>
                  <CampDerby
                    t={t}
                    couleur={couleurA}
                    lettre={d.derby.lettreA}
                    nom={d.derby.nomA}
                    compte={d.derby.victoiresA}
                    mene={d.derby.mene === "A"}
                  />
                  <View style={s.derbyMilieu}>
                    <Text style={[s.derbyNuls, { color: t.i2 }]}>
                      {d.derby.nuls} nul{d.derby.nuls > 1 ? "s" : ""}
                    </Text>
                    <Text style={[s.derbyMatchs, { color: t.i3 }]}>
                      sur {d.derby.total} match{d.derby.total > 1 ? "s" : ""}
                    </Text>
                  </View>
                  <CampDerby
                    t={t}
                    couleur={couleurB}
                    lettre={d.derby.lettreB}
                    nom={d.derby.nomB}
                    compte={d.derby.victoiresB}
                    mene={d.derby.mene === "B"}
                  />
                </View>

                {/* La jauge fait 6 px : les variantes redressées, sinon la
                    part de la chasuble noire se confond avec la carte et la
                    moitié du derby disparaît. */}
                <View style={[s.jauge, { backgroundColor: t.sep }]}>
                  <View style={{ flexGrow: d.derby.victoiresA, flexBasis: 0, backgroundColor: t.taR }} />
                  <View style={{ flexGrow: d.derby.nuls, flexBasis: 0, backgroundColor: t.i3 }} />
                  <View style={{ flexGrow: d.derby.victoiresB, flexBasis: 0, backgroundColor: t.tbR }} />
                </View>

                <View style={{ marginTop: 12 }}>
                  <LigneDerby t={t} g={d.derby.butsA} l="Buts marqués" dr={d.derby.butsB} />
                  {(d.derby.soireesA > 0 || d.derby.soireesB > 0 || d.derby.soireesPartagees > 0) && (
                    <LigneDerby
                      t={t}
                      g={d.derby.soireesA}
                      l="Soirées gagnées"
                      note={
                        d.derby.soireesPartagees > 0
                          ? ` · ${d.derby.soireesPartagees} partagée${d.derby.soireesPartagees > 1 ? "s" : ""}`
                          : undefined
                      }
                      dr={d.derby.soireesB}
                    />
                  )}
                </View>

                {d.derby.serie && (
                  <Text style={[s.derbySerie, { color: t.i2 }]}>{d.derby.serie}</Text>
                )}
              </Carte>
            )}

            {d.gardiens.length > 0 && (
              <Carte t={t} titre="Les gardiens" rembourrage={12}>
                <View style={s.gTete}>
                  <View style={{ width: 30 }} />
                  <Text style={[s.gNomTete, { color: t.i3 }]}>Gardien</Text>
                  {["MJ", "BE", "Moy.", "CS", "%V"].map((c, i) => (
                    <Text key={c} style={[colonneG(i), { color: t.i3 }]}>
                      {c}
                    </Text>
                  ))}
                </View>
                {d.gardiens.map((g) => (
                  <Pressable
                    key={g.playerId}
                    onPress={() => ouvrirFiche(g.playerId)}
                    style={({ pressed }) => [
                      s.gRangee,
                      { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.sep },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Avatar nom={g.nom} photo={g.photo} t={t} taille={30} anneau={anneau(g.camp)} />
                    <Text style={[s.gNom, { color: t.ink }]} numberOfLines={1}>
                      {g.nom}
                    </Text>
                    <Text style={[colonneG(0), { color: t.ink }]}>{g.matchs}</Text>
                    <Text style={[colonneG(1), { color: t.ink }]}>{g.encaisses}</Text>
                    <Text style={[colonneG(2), { color: t.ink, fontWeight: "700" }]}>
                      {g.moyenne.toLocaleString("fr-FR", { minimumFractionDigits: 1 })}
                    </Text>
                    <Text style={[colonneG(3), { color: t.ink }]}>{g.cleanSheets}</Text>
                    <Text style={[colonneG(4), { color: t.ink }]}>{g.pctVictoires}</Text>
                  </Pressable>
                ))}
                <Text style={[s.legende, { color: t.i3, borderTopColor: t.sep }]}>
                  BE : buts encaissés · Moy. : par match · CS : matchs sans encaisser
                </Text>
              </Carte>
            )}

            {d.records.lignes.length > 0 && (
              <Carte t={t} titre="Les records du club" rembourrage={16}>
                {d.records.lignes.map((r, i) => (
                  <Pressable
                    key={r.cle}
                    disabled={!r.cible}
                    onPress={() => {
                      if (!r.cible) return;
                      if (r.cible.quoi === "match")
                        router.push({ pathname: "/recap/[id]", params: { id: r.cible.id, clubId: id } });
                      else if (r.cible.quoi === "soiree")
                        router.push({ pathname: "/soiree/[id]", params: { id: r.cible.id, clubId: id } });
                      else ouvrirFiche(r.cible.id);
                    }}
                    style={({ pressed }) => [
                      s.record,
                      i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.sep },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    {r.avatar ? (
                      <Avatar nom={r.avatar.nom} photo={r.avatar.photo} t={t} taille={38} />
                    ) : (
                      <View style={[s.pastille, { backgroundColor: t.seg, borderColor: t.cb }]} />
                    )}
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Text style={[s.recordTitre, { color: t.ink }]}>{r.titre}</Text>
                      <Text style={[s.recordContexte, { color: t.i2 }]} numberOfLines={1}>
                        {r.contexte}
                      </Text>
                    </View>
                    <Text style={[s.recordValeur, { color: t.ink }]}>{r.valeur}</Text>
                  </Pressable>
                ))}
                {d.records.jeunesse && (
                  <Text style={[s.recordJeune, { color: t.i3, borderTopColor: t.sep }]}>
                    {d.records.jeunesse}
                  </Text>
                )}
              </Carte>
            )}

            {d.adversaires && (
              <Carte t={t} titre="Bilan vs adversaires" rembourrage={20}>
                <Text style={[s.synthese, { color: t.ink }]}>
                  <Text style={s.gras}>{d.adversaires.matchs}</Text> match
                  {d.adversaires.matchs > 1 ? "s" : ""} ·{" "}
                  <Text style={s.gras}>{d.adversaires.victoires}</Text> V ·{" "}
                  <Text style={s.gras}>{d.adversaires.nuls}</Text> N ·{" "}
                  <Text style={s.gras}>{d.adversaires.defaites}</Text> D · {d.adversaires.butsPour}
                  <Text style={{ color: t.i3 }}>:</Text>
                  {d.adversaires.butsContre} · <Text style={s.gras}>{d.adversaires.points}</Text> pts
                </Text>
                {d.adversaires.forme.length > 0 && (
                  <View style={s.syntheseForme}>
                    <Forme t={t} resultats={d.adversaires.forme} />
                  </View>
                )}
                {d.adversaires.duels.map((o) => (
                  <View
                    key={o.id}
                    style={[s.duel, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.sep }]}
                  >
                    <Text style={[s.nom, { color: t.ink, flex: 1 }]} numberOfLines={1}>
                      {o.nom}
                    </Text>
                    <Text style={[s.duelBilan, { color: t.i2 }]}>
                      <Text style={[s.gras, { color: t.ink }]}>{o.victoires}</Text> V ·{" "}
                      <Text style={[s.gras, { color: t.ink }]}>{o.nuls}</Text> N ·{" "}
                      <Text style={[s.gras, { color: t.ink }]}>{o.defaites}</Text> D · {o.butsPour}:
                      {o.butsContre}
                    </Text>
                    <Text
                      style={[
                        s.duelDiff,
                        { color: o.diff > 0 ? t.ok : o.diff < 0 ? t.bad : t.i3 },
                      ]}
                    >
                      {o.diff > 0 ? `+${o.diff}` : o.diff < 0 ? `−${Math.abs(o.diff)}` : "="}
                    </Text>
                  </View>
                ))}
              </Carte>
            )}
          </>
        )}
      </ScrollView>

      {/* Le choix de la saison. Le site ouvre un menu accroché à la pilule ;
          sur un téléphone, une feuille par le bas se tape au pouce et ne
          dépasse jamais de l'écran, quel que soit le nombre de saisons. */}
      <Modal
        visible={choixOuvert}
        transparent
        animationType="slide"
        onRequestClose={() => setChoixOuvert(false)}
      >
        <Pressable style={s.voile} onPress={() => setChoixOuvert(false)}>
          <Pressable
            style={[s.feuille, { paddingBottom: bas + 12, backgroundColor: t.bgSolid, borderTopColor: t.ink }]}
            onPress={() => {}}
          >
            <Poignee />
            {d?.saisons.choix.map((c) => {
              const actif = c.id === d.saisons.choisie;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => {
                    setChoixOuvert(false);
                    setOccupe(true);
                    setSaison(c.id);
                  }}
                  style={({ pressed }) => [
                    s.choix,
                    actif && { backgroundColor: t.seg },
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <Text style={[s.choixTexte, { color: t.ink }]} numberOfLines={1}>
                    {c.libelle}
                  </Text>
                  {actif && <Text style={[s.coche, { color: t.i2 }]}>✓</Text>}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </Ecran>
  );
}

function Carte({
  t,
  titre,
  rembourrage = 12,
  children,
}: {
  t: Jetons;
  titre?: string;
  rembourrage?: number;
  children: React.ReactNode;
}) {
  return (
    <View
      style={[
        s.carte,
        { borderColor: t.cb, backgroundColor: t.cdSolid, paddingHorizontal: rembourrage },
      ]}
    >
      {titre && <Text style={[s.carteTitre, { color: t.ink }]}>{titre}</Text>}
      {children}
    </View>
  );
}

function Filet({ t }: { t: Jetons }) {
  return (
    <View
      style={{
        marginHorizontal: -2,
        marginBottom: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: t.sep,
      }}
    />
  );
}

/// Les trois onglets en tête de carte : 62 px, 20 gras, l'actif en encre
/// pleine et les autres en encre tertiaire. Pas de trait sous l'actif — le
/// site n'en met pas ici, c'est la couleur qui dit lequel est ouvert.
function Onglets({
  t,
  vue,
  onChange,
  inerte,
}: {
  t: Jetons;
  vue: Vue;
  onChange: (v: Vue) => void;
  inerte?: boolean;
}) {
  const ONGLETS: { id: Vue; libelle: string }[] = [
    { id: "tableau", libelle: "Tableau" },
    { id: "buteurs", libelle: "Buteurs" },
    { id: "forme", libelle: "Forme" },
  ];
  return (
    <View style={s.onglets}>
      {ONGLETS.map((o) => (
        <Pressable
          key={o.id}
          disabled={inerte}
          onPress={() => onChange(o.id)}
          accessibilityRole="tab"
          accessibilityState={{ selected: o.id === vue }}
          style={s.onglet}
        >
          <Text
            style={[s.ongletTexte, { color: o.id === vue ? t.ink : t.i3 }]}
            numberOfLines={1}
          >
            {o.libelle}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function EnTeteTableau({ t }: { t: Jetons }) {
  return (
    <View style={[s.rangeeTableau, s.enTete]}>
      <View style={{ width: 24 }} />
      <View style={{ width: 30 }} />
      <Text style={[s.tNom, s.enTeteTexte, { color: t.i2 }]}>Joueur</Text>
      <Text style={[s.tMj, s.enTeteTexte, { color: t.i2 }]}>MJ</Text>
      <Text style={[s.tPetit, s.enTeteTexte, { color: t.i2 }]}>V</Text>
      <Text style={[s.tPetit, s.enTeteTexte, { color: t.i2 }]}>N</Text>
      <Text style={[s.tPetit, s.enTeteTexte, { color: t.i2 }]}>D</Text>
      <Text style={[s.tMj, s.enTeteTexte, { color: t.i2 }]}>B</Text>
      <Text style={[s.tPts, s.enTeteTexte, { color: t.i2 }]}>PTS</Text>
    </View>
  );
}

/// Les cinq cases V / N / D, dans l'ordre du temps : la plus récente à droite,
/// là où l'œil finit — c'est de là que part la série.
function Forme({ t, resultats }: { t: Jetons; resultats: ("W" | "D" | "L")[] }) {
  if (resultats.length === 0) return <Text style={{ color: t.i3 }}>—</Text>;
  return (
    <View style={s.forme}>
      {resultats.map((r, i) => (
        <View
          key={i}
          style={[s.formeCase, { backgroundColor: r === "W" ? t.ok : r === "D" ? t.seg : t.bad }]}
        >
          <Text style={[s.formeLettre, { color: r === "W" ? "#04230d" : r === "D" ? t.ink : "#fff" }]}>
            {r === "W" ? "V" : r === "D" ? "N" : "D"}
          </Text>
        </View>
      ))}
    </View>
  );
}

function CampDerby({
  t,
  couleur,
  lettre,
  nom,
  compte,
  mene,
}: {
  t: Jetons;
  couleur: string;
  lettre: string;
  nom: string;
  compte: number;
  mene: boolean;
}) {
  return (
    <View style={s.derbyCamp}>
      <EcussonChasuble couleur={couleur} lettre={lettre} taille={44} />
      <Text style={[s.derbyNom, { color: t.i2 }]} numberOfLines={1}>
        {nom}
      </Text>
      <Text style={[s.derbyCompte, { color: mene ? t.ink : t.i2 }]}>{compte}</Text>
      <Text style={[s.derbyUnite, { color: t.i2 }]}>
        victoire{compte > 1 ? "s" : ""}
      </Text>
    </View>
  );
}

function LigneDerby({
  t,
  g,
  l,
  note,
  dr,
}: {
  t: Jetons;
  g: number;
  l: string;
  note?: string;
  dr: number;
}) {
  return (
    <View style={[s.derbyLigne, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.sep }]}>
      <Text style={[s.derbyG, { color: t.ink }]}>{g}</Text>
      <Text style={[s.derbyL, { color: t.i2 }]} numberOfLines={1}>
        {l}
        {note && <Text style={{ color: t.i3 }}>{note}</Text>}
      </Text>
      <Text style={[s.derbyD, { color: t.ink }]}>{dr}</Text>
    </View>
  );
}

/// Les cinq colonnes de chiffres des gardiens : 26/26/34/26/30, alignées à
/// droite comme sur le site.
const LARGEURS_G = [26, 26, 34, 26, 30];
const colonneG = (i: number) => ({
  width: LARGEURS_G[i],
  fontSize: 15,
  textAlign: "right" as const,
});

const s = StyleSheet.create({
  contenu: { paddingHorizontal: 14, paddingBottom: 40 },
  tete: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingTop: 18,
    paddingHorizontal: 4,
  },
  titre: { fontSize: 34, fontWeight: "700", letterSpacing: -0.5, minWidth: 0, flexShrink: 1 },
  pilule: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    maxWidth: 200,
  },
  piluleTexte: { fontSize: 17, fontWeight: "600", flexShrink: 1 },
  fleche: { fontSize: 13 },

  centre: { paddingTop: 60, alignItems: "center", gap: 12 },
  aide: { fontSize: 15 },
  erreur: { fontSize: 15, textAlign: "center", paddingTop: 24 },
  vide: { fontSize: 17, paddingTop: 12, paddingBottom: 14 },

  carte: { borderRadius: 28, borderWidth: 1, marginTop: 18, paddingBottom: 10 },
  carteTitre: { fontSize: 20, fontWeight: "600", paddingTop: 22, paddingBottom: 10 },

  onglets: { flexDirection: "row", height: 62, alignItems: "center" },
  onglet: { flex: 1, height: 62, justifyContent: "center", paddingHorizontal: 4 },
  ongletTexte: { fontSize: 20, fontWeight: "600", letterSpacing: -0.3, textAlign: "center" },

  // Les neuf colonnes du site : 24/30/1fr/30/26/26/26/30/40.
  rangeeTableau: {
    flexDirection: "row",
    alignItems: "center",
    height: 54,
    paddingHorizontal: 6,
  },
  enTete: { height: undefined, paddingBottom: 8 },
  enTeteTexte: { fontSize: 15, fontWeight: "400" },
  tRang: { width: 24, fontSize: 17 },
  tNom: { flex: 1, minWidth: 0, fontSize: 17, fontWeight: "500", paddingLeft: 8 },
  tMj: { width: 30, fontSize: 17, textAlign: "center" },
  tPetit: { width: 26, fontSize: 17, textAlign: "center" },
  tPts: { width: 40, fontSize: 17, fontWeight: "600", textAlign: "center" },

  rangee: { flexDirection: "row", alignItems: "center", height: 56, paddingHorizontal: 6 },
  nom: { fontSize: 17, fontWeight: "500" },
  bRang: { width: 24, fontSize: 17 },
  bBloc: { flex: 1, minWidth: 0, paddingLeft: 8, paddingRight: 12, gap: 6 },
  barreFond: { height: 4, borderRadius: 2, overflow: "hidden" },
  barrePleine: { height: 4, borderRadius: 2 },
  bButs: { width: 44, fontSize: 22, fontWeight: "700", textAlign: "right" },

  forme: { flexDirection: "row", gap: 5 },
  formeCase: { width: 26, height: 26, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  formeLettre: { fontSize: 12, fontWeight: "700" },
  serie: { width: 44, fontSize: 17, fontWeight: "600", textAlign: "right" },

  ligneTitre: { flexDirection: "row", alignItems: "center", gap: 14, height: 60 },
  icone: { width: 26, alignItems: "center", justifyContent: "center" },
  libelle: { flex: 1, minWidth: 0, fontSize: 17 },
  laureat: { fontSize: 17, fontWeight: "600", maxWidth: "55%" },

  saisonClose: { paddingVertical: 14, gap: 4 },
  saisonNom: { fontSize: 17, fontWeight: "600" },
  saisonLaureats: { fontSize: 15, lineHeight: 21 },

  derbyCamps: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingTop: 2 },
  derbyCamp: { flex: 1, alignItems: "center", gap: 3, minWidth: 0 },
  derbyNom: { fontSize: 15, fontWeight: "600", maxWidth: "100%" },
  derbyCompte: { fontSize: 40, fontWeight: "800", letterSpacing: -1.2 },
  derbyUnite: { fontSize: 13 },
  derbyMilieu: { alignItems: "center", gap: 2, paddingTop: 46 },
  derbyNuls: { fontSize: 15, fontWeight: "600" },
  derbyMatchs: { fontSize: 13 },
  jauge: {
    flexDirection: "row",
    height: 6,
    marginTop: 14,
    marginHorizontal: 2,
    borderRadius: 3,
    overflow: "hidden",
  },
  derbyLigne: { flexDirection: "row", alignItems: "center", minHeight: 42 },
  derbyG: { width: 44, fontSize: 15, fontWeight: "700" },
  derbyL: { flex: 1, fontSize: 15, textAlign: "center" },
  derbyD: { width: 44, fontSize: 15, fontWeight: "700", textAlign: "right" },
  derbySerie: { paddingTop: 12, textAlign: "center", fontSize: 13 },

  gTete: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
    paddingTop: 6,
    paddingBottom: 8,
  },
  gRangee: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 46,
    paddingHorizontal: 4,
  },
  gNomTete: { flex: 1, minWidth: 0, fontSize: 13 },
  gNom: { flex: 1, minWidth: 0, fontSize: 15, fontWeight: "600" },
  legende: {
    paddingHorizontal: 4,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    fontSize: 13,
  },

  record: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 62, paddingVertical: 8 },
  pastille: { width: 38, height: 38, borderRadius: 19, borderWidth: 1 },
  recordTitre: { fontSize: 15, fontWeight: "600" },
  recordContexte: { fontSize: 13 },
  recordValeur: { fontSize: 19, fontWeight: "700" },
  recordJeune: {
    paddingTop: 10,
    paddingBottom: 12,
    textAlign: "center",
    fontSize: 13,
    borderTopWidth: StyleSheet.hairlineWidth,
  },

  synthese: { fontSize: 17, textAlign: "center", paddingTop: 4, paddingBottom: 14 },
  gras: { fontWeight: "700" },
  syntheseForme: { alignItems: "center", paddingBottom: 14 },
  duel: { flexDirection: "row", alignItems: "center", gap: 12, height: 56 },
  duelBilan: { fontSize: 15 },
  duelDiff: { width: 44, fontSize: 17, fontWeight: "600", textAlign: "right" },

  voile: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  feuille: { borderTopWidth: 3, paddingHorizontal: 16, paddingTop: 8 },
  choix: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    height: 48,
    borderRadius: 24,
    paddingHorizontal: 16,
  },
  choixTexte: { fontSize: 17, fontWeight: "600", flexShrink: 1 },
  coche: { fontSize: 17 },
});
