import { useCallback, useEffect, useRef, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Ecran from "../../composants/Ecran";
import EnTeteClub from "../../composants/EnTeteClub";
import ErreurChargement from "../../composants/ErreurChargement";
import { chargerMoiMemorise } from "../../composants/ClubCourant";
import {
  Avatar,
  BoutonVerre,
  CarteVerre,
  EcussonChasuble,
  Interrupteur,
} from "../../composants/base";
import { Bloc, Squelette } from "../../composants/Squelette";
import AnnonceSucces from "../../composants/succes/AnnonceSucces";
import SectionSucces from "../../composants/joueur/SectionSucces";
import { sousTitreFiche } from "../../composants/joueur/affichage";
import { arretsDeCrete, jeton, jetonsDuClub, JETONS_NEUTRES, type Jetons } from "../../lib/couleurs";
import { choix as retourChoix, succes as retourSucces } from "../../lib/haptique";
import { messageErreur } from "../../lib/erreurs";
import { chargerSucces, type SuccesJoueur } from "../../lib/succes";
import {
  chargerFicheJoueur,
  reglerAbonnement,
  SessionExpiree,
  type FicheJoueur,
} from "../../lib/api";

/// La fiche d'un joueur — la carte d'identité du vestiaire.
///
/// L'ordre est celui du site, parce que c'est l'ordre dans lequel on regarde :
/// la photo et le sous-titre (« Blanc · Titulaire · 2e du tableau (+1) »), les
/// quatre chiffres, la forme et l'Élo, les succès, les derniers matchs, la
/// saison par saison.
///
/// Le niveau des succès se lit en tête, discret : c'est le chiffre de
/// l'écusson posé sur l'avatar, et le titre dans le sous-titre. L'écusson
/// portait la note d'équilibrage (1 à 5) ; comme sur le site, elle reste là
/// où elle sert — l'effectif et la compo.
///
/// Un seul geste possible ici : « Vient à chaque soirée ». C'est le réglage
/// qui fait qu'un habitué compte présent sans rien dire — et il change assez
/// souvent (une blessure, un déménagement) pour mériter d'être à portée de
/// pouce plutôt que dans un écran de réglages.
///
/// Les succès arrivent par leur propre route, en parallèle de la fiche. Si
/// elle ne répond pas (un serveur pas encore déployé, un hoquet), la fiche
/// s'affiche quand même, avec les « Prochains paliers » et les « Trophées »
/// d'avant : un succès manquant ne doit pas coûter la fiche entière.
export default function Joueur() {
  // `useLocalSearchParams`, PAS `useGlobalSearchParams` (cf. ClubCourant.tsx) :
  // le second rend les paramètres de la route FOCALISÉE. Il suffisait qu'un
  // écran posé par-dessus n'emporte pas `clubId` — « On rejoue — mêmes
  // équipes » remplace la pile par `/match/[id]` sans lui — pour que `clubId`
  // devienne `undefined` ici, que la fiche reparte sur `moi.clubs[0]`, montre
  // « C'est introuvable » et que l'interrupteur d'abonnement écrive dans un
  // autre club. La route reçoit `clubId` à chaque `router.push` : il est à
  // elle, et il ne bouge plus.
  const { id, clubId } = useLocalSearchParams<{ id: string; clubId?: string }>();
  const [fiche, setFiche] = useState<FicheJoueur | null>(null);
  const [succes, setSucces] = useState<SuccesJoueur | null>(null);
  // Le club résolu : l'écran s'ouvre parfois sans lui (un lien direct), et
  // l'interrupteur d'abonnement a besoin de l'identifiant pour écrire.
  const [club, setClub] = useState<string | null>(clubId ?? null);
  // Une fois trouvé, il ne change plus : un rechargement ne doit jamais
  // faire glisser la fiche — et l'écriture d'abonnement — vers un autre club.
  const clubResolu = useRef<string | null>(clubId ?? null);
  const [occupe, setOccupe] = useState(true);
  const [rafraichit, setRafraichit] = useState(false);
  const [erreur, setErreur] = useState<unknown>(null);

  const defile = useRef<ScrollView>(null);
  const hautCorps = useRef(0);
  const hautSucces = useRef<number | null>(null);

  const charger = useCallback(async () => {
    if (!id) return;
    setErreur(null);
    try {
      const cid =
        clubResolu.current ?? clubId ?? (await chargerMoiMemorise()).clubs[0]?.id;
      if (!cid) throw new Error("Aucun club.");
      clubResolu.current = cid;
      setClub(cid);
      const [f, sc] = await Promise.all([
        chargerFicheJoueur(cid, id),
        // `undefined` : la route a échoué. On garde alors ce qu'on avait —
        // un rafraîchissement raté ne doit pas faire disparaître la section.
        chargerSucces(cid, id).catch(() => undefined),
      ]);
      setFiche(f);
      if (sc !== undefined) setSucces(sc.joueur ? (sc as SuccesJoueur) : null);
    } catch (e) {
      if (e instanceof SessionExpiree) return router.replace("/connexion");
      setErreur(e);
    } finally {
      setOccupe(false);
    }
  }, [id, clubId]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const rafraichir = useCallback(async () => {
    setRafraichit(true);
    await charger();
    setRafraichit(false);
  }, [charger]);

  const couleurA = fiche?.chasubles.a ?? "#ffffff";
  const couleurB = fiche?.chasubles.b ?? "#111111";
  const chasubles = { a: couleurA, b: couleurB };
  const t: Jetons = fiche ? jetonsDuClub(couleurA, couleurB, "dark") : JETONS_NEUTRES;
  const j = fiche?.joueur;
  const bilan = fiche?.bilan ?? null;
  const peutAbonner = !!(fiche?.droits.peutReglerAbonnement && club);

  const ouvrirMatch = (matchId: string) =>
    router.push({
      pathname: "/recap/[id]",
      params: { id: matchId, ...(club ? { clubId: club } : null) },
    });

  const allerAuxSucces = () => {
    if (hautSucces.current == null) return;
    defile.current?.scrollTo({ y: hautCorps.current + hautSucces.current - 12, animated: true });
  };

  // Un joueur qui n'a jamais joué est au niveau 1 à 0 XP : rien à en dire.
  const niveau = succes && succes.niveau.xp > 0 ? succes.niveau : null;

  const abonnement =
    fiche && j && club && peutAbonner ? (
      <Abonnement
        t={t}
        clubId={club}
        joueurId={j.id}
        depart={j.abonne}
        estMoi={j.estMoi}
        nom={j.nom}
      />
    ) : null;

  const sectionSucces = succes ? (
    <View onLayout={(e) => (hautSucces.current = e.nativeEvent.layout.y)}>
      <SectionSucces
        t={t}
        succes={succes}
        elo={bilan?.elo ?? null}
        chasubles={chasubles}
        estMoi={!!j?.estMoi}
        onOuvrirMatch={ouvrirMatch}
      />
    </View>
  ) : null;

  return (
    <Ecran t={t} chasubles={chasubles}>
      <ScrollView
        ref={defile}
        contentContainerStyle={s.contenu}
        refreshControl={
          <RefreshControl refreshing={rafraichit} onRefresh={rafraichir} tintColor={t.i2} />
        }
      >
        <EnTeteClub t={t} clubId={club} />

        <View style={s.corps} onLayout={(e) => (hautCorps.current = e.nativeEvent.layout.y)}>
          {/* « Modifier » vit ICI et nulle part ailleurs, comme sur le site :
              seul sur sa ligne, calé à droite, sous la barre. Dix boutons dans
              la liste du vestiaire, pour un geste qu'on fait deux fois par
              saison, ce serait dix occasions de le taper par erreur. */}
          {fiche?.droits.peutModifier && club ? (
            <View style={s.ligneModifier}>
              <BoutonVerre
                t={t}
                titre="Modifier"
                taille="normal"
                lueur
                onPress={() =>
                  router.push({ pathname: "/joueur/fiche", params: { clubId: club, id } })
                }
              />
            </View>
          ) : null}

          {occupe && !fiche && <SqueletteFiche t={t} />}
          {erreur != null && (
            <ErreurChargement t={t} erreur={erreur} onReessayer={charger} style={s.erreur} />
          )}

          {fiche && j && (
            <>
              <View style={s.tete}>
                <View style={s.photo}>
                  <Avatar
                    nom={j.nom}
                    photo={j.photo}
                    t={t}
                    taille={128}
                    epaisseur={4}
                    corps={40}
                    camp={j.camp}
                    initiales={j.initiales}
                  />
                  {niveau ? (
                    // Touchable : il mène à la carte du niveau, plus bas.
                    <Pressable
                      onPress={allerAuxSucces}
                      accessibilityRole="button"
                      accessibilityLabel={`Niveau ${niveau.niveau}, ${niveau.titre}. Voir les succès`}
                      hitSlop={4}
                      style={s.badge}
                    >
                      <EcussonChasuble couleur={j.couleur} lettre={String(niveau.niveau)} taille={40} />
                    </Pressable>
                  ) : !succes && j.camp ? (
                    // Un serveur sans les succès : l'écusson d'avant, la note.
                    <View style={s.badge}>
                      <EcussonChasuble couleur={j.couleur} lettre={j.badge} taille={40} />
                    </View>
                  ) : null}
                </View>
                <Text style={[s.nom, { color: t.ink }]}>{j.nom}</Text>
                {j.surnom && <Text style={[s.sous, { color: t.i2 }]}>« {j.surnom} »</Text>}
                <Text
                  style={[s.sous, { color: t.i2 }]}
                  accessibilityLabel={
                    niveau
                      ? `${sousTitreFiche(j.sousTitre, niveau, succes?.classement.evolution ?? null)}, niveau ${niveau.niveau}`
                      : undefined
                  }
                >
                  {sousTitreFiche(j.sousTitre, succes?.niveau ?? null, succes?.classement.evolution ?? null)}
                </Text>
              </View>

              {bilan && bilan.matchs > 0 ? (
                <>
                  <CarteVerre t={t} style={s.chiffres}>
                    <Chiffre t={t} n={String(bilan.matchs)} l="Matchs" />
                    <Chiffre t={t} n={String(bilan.buts)} l="Buts" />
                    <Chiffre t={t} n={String(bilan.hommeDuMatch)} l="Homme du match" />
                    <Chiffre t={t} n={String(bilan.pctVictoires)} petit="%" l="Victoires" />
                  </CarteVerre>

                  {fiche.gardien && (
                    <CarteFiche t={t} titre="Dans les buts">
                      <Ligne t={t} l="Matchs gardés" v={String(fiche.gardien.matchs)} premiere />
                      <Ligne
                        t={t}
                        l="Buts encaissés"
                        v={String(fiche.gardien.butsEncaisses)}
                        apres={`· ${nombre(fiche.gardien.moyenne, 1)} par match`}
                      />
                      <Ligne t={t} l="Matchs sans encaisser" v={String(fiche.gardien.cleanSheets)} />
                      <Ligne t={t} l="Victoires quand il garde" v={`${fiche.gardien.pctVictoires} %`} />
                    </CarteFiche>
                  )}

                  {!succes && fiche.paliers.length > 0 && (
                    <Paliers t={t} paliers={fiche.paliers} couleurA={couleurA} />
                  )}

                  {/* Deux cartes et non une : « Vient à chaque soirée » est un
                      RÉGLAGE qu'on change, la forme et l'Élo sont des CHIFFRES
                      qu'on lit. Mis bout à bout dans la même carte, avec le
                      même filet entre eux, l'interrupteur se lisait comme une
                      ligne de statistique de plus. C'est aussi ce que fait déjà
                      la fiche d'un joueur qui n'a pas encore joué. */}
                  {abonnement && <CarteFiche t={t}>{abonnement}</CarteFiche>}

                  <CarteFiche t={t}>
                    <Ligne
                      t={t}
                      l="Forme"
                      premiere
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
                      apresFort
                    />
                    <Ligne t={t} l="Buts par match" v={nombre(bilan.butsParMatch, 0, 2)} />
                    {fiche.passesSuivies && bilan.passes > 0 && (
                      <Ligne t={t} l="Passes décisives" v={String(bilan.passes)} />
                    )}
                  </CarteFiche>

                  {sectionSucces}

                  {fiche.derniersMatchs.length > 0 && (
                    <CarteFiche t={t} titre="Derniers matchs">
                      {fiche.derniersMatchs.map((m) => (
                        <Pressable
                          key={m.id}
                          onPress={() => ouvrirMatch(m.id)}
                          accessibilityRole="button"
                          style={({ pressed }) => [
                            s.match,
                            { borderTopColor: jeton(t, "sep") },
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
                    </CarteFiche>
                  )}

                  {!succes && fiche.trophees.length > 0 && (
                    <Trophees t={t} trophees={fiche.trophees} />
                  )}

                  {fiche.parSaison.length > 1 && (
                    <CarteFiche t={t} titre="Par saison">
                      {fiche.parSaison.map((sn) => (
                        <View
                          key={sn.saisonId ?? "sans"}
                          style={[s.match, s.saison, { borderTopColor: jeton(t, "sep") }]}
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
                    </CarteFiche>
                  )}
                </>
              ) : (
                <>
                  {/* L'abonnement AVANT le premier match : c'est le nouveau
                      venu qui en a le plus besoin — se déclarer habitué pour
                      être compté lundi, avant d'avoir jamais joué. */}
                  {abonnement && <CarteFiche t={t}>{abonnement}</CarteFiche>}
                  <CarteFiche t={t}>
                    <Text style={[s.vide, { color: t.i2 }]}>
                      Aucun match joué pour l&apos;instant. Ça se règle sur le terrain.
                    </Text>
                  </CarteFiche>
                </>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* L'annonce d'un succès neuf, sur MA fiche seulement : sur celle d'un
          autre, elle lui annoncerait ses succès à lui — et les marquerait vus
          sur ce téléphone. */}
      {j?.estMoi && club && succes && (
        <AnnonceSucces
          t={t}
          clubId={club}
          joueurId={j.id}
          deblocages={succes.deblocages}
          chasubles={chasubles}
          onVoir={allerAuxSucces}
        />
      )}
    </Ecran>
  );
}

/// Une carte de la fiche : le verre, les marges du site (0 20 px), et le
/// titre centré de `.carte-titre`.
function CarteFiche({
  t,
  titre,
  titreHaut = 20,
  titreBas = 8,
  style,
  children,
}: {
  t: Jetons;
  titre?: string;
  titreHaut?: number;
  titreBas?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  return (
    <CarteVerre t={t} style={[s.carte, style]}>
      {titre ? (
        <Text
          style={[s.titreCarte, { color: t.ink, paddingTop: titreHaut, paddingBottom: titreBas }]}
          accessibilityRole="header"
        >
          {titre}
        </Text>
      ) : null}
      {children}
    </CarteVerre>
  );
}

/// « Vient à chaque soirée » — l'interrupteur, et rien d'autre.
///
/// Le jour n'est PAS écrit ici. Le calendrier laisse choisir n'importe quel
/// jour, et un club du jeudi lisait « Vient tous les lundis » sur son réglage
/// le plus important. Le site déduit le jour des vraies soirées du club
/// (`libelleAbonnement`) ; la route de l'app ne rend pas encore ce libellé,
/// alors on prend sa formulation neutre, qui est vraie pour tout le monde.
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
  useEffect(() => setAbonne(depart), [depart]);

  const basculer = async (v: boolean) => {
    setErreur(null);
    setAbonne(v);
    setOccupe(true);
    retourChoix();
    try {
      await reglerAbonnement(clubId, joueurId, v);
      retourSucces();
    } catch (e) {
      setAbonne(!v);
      setErreur(messageErreur(e));
    } finally {
      setOccupe(false);
    }
  };

  return (
    <>
      <View style={s.ligne}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[s.ligneL, { color: t.ink }]}>Vient à chaque soirée</Text>
          <Text style={[s.ligneAide, { color: t.i2 }]}>
            Compté présent d&apos;office.{" "}
            {estMoi
              ? "Tu peux toujours te déclarer absent sur une soirée."
              : `${nom} peut toujours se déclarer absent sur une soirée.`}
          </Text>
        </View>
        <Interrupteur
          valeur={abonne}
          onChange={(v) => void basculer(v)}
          disabled={occupe}
          etiquette="Vient à chaque soirée"
        />
      </View>
      {erreur && <Text style={[s.ligneErreur, { color: t.bad }]}>{erreur}</Text>}
    </>
  );
}

/// L'ancienne carte « Prochains paliers », gardée pour un serveur qui ne sait
/// pas encore rendre les succès. Le nombre restant en gras, la barre en
/// dégradé de la chasuble A, un filet au-dessus de chaque palier — le site.
function Paliers({
  t,
  paliers,
  couleurA,
}: {
  t: Jetons;
  paliers: FicheJoueur["paliers"];
  couleurA: string;
}) {
  const [clair, milieu, sombre] = arretsDeCrete(couleurA);
  return (
    <CarteFiche t={t} titre="Prochains paliers" titreHaut={18} titreBas={4} style={s.cartePaliers}>
      {paliers.map((p) => (
        <View key={p.cle} style={[s.palier, { borderTopColor: jeton(t, "sep") }]}>
          <View style={s.palierTete}>
            <Text style={[s.palierQuoi, { color: t.ink }]} numberOfLines={1}>
              {p.titre}
            </Text>
            <Text style={[s.palierCompte, { color: t.i2 }]}>
              {p.unite ? (
                <>
                  encore <Text style={[s.gras, { color: t.ink }]}>{p.reste}</Text> {p.unite} pour{" "}
                  {p.objectif}
                </>
              ) : (
                p.libelle
              )}
            </Text>
          </View>
          <View style={[s.barreFond, { backgroundColor: jeton(t, "sep") }]}>
            <LinearGradient
              colors={[clair, milieu, sombre]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={[s.barrePleine, { width: `${Math.round(p.part * 100)}%` }]}
            />
          </View>
        </View>
      ))}
    </CarteFiche>
  );
}

/// L'ancienne grille des trophées, même repli que `Paliers`. Deux colonnes
/// mesurées : la dernière tuile d'un nombre impair garde sa demi-largeur.
function Trophees({ t, trophees }: { t: Jetons; trophees: FicheJoueur["trophees"] }) {
  const [largeur, setLargeur] = useState(0);
  const colonne = largeur > 0 ? Math.floor((largeur - 10) / 2) : undefined;
  return (
    <CarteFiche t={t} titre="Trophées" titreBas={10} style={s.carteTrophees}>
      <View style={s.grille} onLayout={(e) => setLargeur(e.nativeEvent.layout.width)}>
        {trophees.map((tr) => (
          <View
            key={tr.cle}
            style={[
              s.trophee,
              colonne ? { width: colonne } : { width: "47%" },
              { backgroundColor: jeton(t, "seg"), borderColor: jeton(t, "gb") },
            ]}
          >
            <Text style={[s.tropheeNom, { color: t.ink }]}>{tr.nom}</Text>
            <Text style={[s.tropheeDetail, { color: t.i2 }]}>{tr.detail}</Text>
            {tr.quand && <Text style={[s.tropheeQuand, { color: t.i3 }]}>{tr.quand}</Text>}
          </View>
        ))}
      </View>
    </CarteFiche>
  );
}

function Chiffre({ t, n, petit, l }: { t: Jetons; n: string; petit?: string; l: string }) {
  return (
    <View style={s.chiffre} accessible accessibilityLabel={`${n}${petit ?? ""} ${l}`}>
      <Text style={[s.chiffreN, { color: t.ink }]} adjustsFontSizeToFit numberOfLines={1}>
        {n}
        {petit && <Text style={s.chiffrePetit}>{petit}</Text>}
      </Text>
      {/* Deux lignes réservées pour les quatre légendes : « Homme du match »
          passe à la ligne, « Buts » non, et la rangée finissait en dents de
          scie. Elles occupent maintenant la même hauteur, qu'elles la
          remplissent ou pas. */}
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
  apresFort,
}: {
  t: Jetons;
  l: string;
  v: string;
  apres?: string;
  milieu?: React.ReactNode;
  premiere?: boolean;
  teinte?: string;
  teinteApres?: string;
  /// La tendance de l'Élo (`.plus`/`.moins` du site) est en 600 ; la
  /// moyenne des buts encaissés reste en maigre.
  apresFort?: boolean;
}) {
  return (
    <View
      style={[
        s.ligne,
        !premiere && { borderTopWidth: 1, borderTopColor: jeton(t, "sep") },
      ]}
    >
      <Text style={[s.ligneL, { color: t.ink }]}>{l}</Text>
      {milieu}
      <Text style={[s.ligneV, { color: teinte ?? t.ink }, teinte != null && s.ligneVFort]}>
        {v}
        {apres && (
          <Text style={{ color: teinteApres ?? t.i2, fontWeight: apresFort ? "600" : "400" }}>
            {" "}
            {apres}
          </Text>
        )}
      </Text>
    </View>
  );
}

/// La forme : cinq carrés V / N / D, comme sur le site.
function Forme({ t, resultats }: { t: Jetons; resultats: ("W" | "D" | "L")[] }) {
  return (
    <View
      style={s.forme}
      accessible
      accessibilityLabel={`Forme : ${resultats
        .map((r) => (r === "W" ? "victoire" : r === "D" ? "nul" : "défaite"))
        .join(", ")}`}
    >
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

/// L'attente de la fiche, à la forme de la fiche : le grand visage de 128,
/// le nom, la ligne de niveau, puis la rangée des quatre chiffres.
///
/// La fiche demande DEUX choses au serveur (le bilan du joueur et ses
/// succès) : elle est, avec le récap, l'écran le plus long à venir. Il
/// affichait « Un instant… » au milieu du vide, puis basculait d'un coup.
function SqueletteFiche({ t }: { t: Jetons }) {
  return (
    <Squelette etiquette="On ouvre la fiche" style={sq.cadre}>
      <View style={sq.tete}>
        <Bloc t={t} l={128} h={128} r={64} />
        <Bloc t={t} l={172} h={34} r={10} style={sq.nom} />
        <Bloc t={t} l={124} h={17} style={sq.sous} />
      </View>
      <CarteVerre t={t} style={sq.chiffres}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={sq.chiffre}>
            <Bloc t={t} l={38} h={28} r={8} />
            <Bloc t={t} l={52} h={11} />
          </View>
        ))}
      </CarteVerre>
      <CarteVerre t={t} style={sq.carte}>
        <View style={sq.ligne}>
          <Bloc t={t} l="44%" h={15} />
          <Bloc t={t} l={54} h={15} />
        </View>
        <Bloc t={t} l="100%" h={10} r={5} style={sq.barre} />
        {[0, 1, 2].map((i) => (
          <View key={i} style={sq.ligne}>
            <Bloc t={t} l={["52%", "40%", "60%"][i] as `${number}%`} h={15} />
            <Bloc t={t} l={42} h={15} />
          </View>
        ))}
      </CarteVerre>
    </Squelette>
  );
}

const sq = StyleSheet.create({
  cadre: { paddingTop: 10 },
  tete: { alignItems: "center", paddingHorizontal: 18 },
  nom: { marginTop: 16 },
  sous: { marginTop: 8 },
  chiffres: {
    marginTop: 18,
    paddingVertical: 18,
    paddingHorizontal: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  chiffre: { alignItems: "center", gap: 8 },
  carte: { marginTop: 14, paddingHorizontal: 20, paddingVertical: 18, gap: 14 },
  ligne: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  barre: { alignSelf: "stretch" },
});

const s = StyleSheet.create({
  contenu: { paddingBottom: 40 },
  corps: { paddingHorizontal: 14 },
  // La marge négative fait remonter le visage dans la bande de « Modifier » :
  // le bouton est calé à droite, l'avatar au centre, ils ne se croisent pas, et
  // l'écran gagne une vingtaine de points avant le premier chiffre.
  ligneModifier: { flexDirection: "row", justifyContent: "flex-end", paddingTop: 10, marginBottom: -14 },
  erreur: { marginTop: 24 },

  tete: { alignItems: "center", paddingTop: 6, paddingHorizontal: 18 },
  // L'ombre du site sous le grand avatar (0 10px 30px), posée sur un cadre
  // rond : l'avatar coupe son contenu et rognerait la sienne.
  photo: { borderRadius: 64, boxShadow: "0 10px 30px rgba(0,0,0,0.3)" },
  badge: { position: "absolute", right: -4, bottom: -2 },
  nom: { fontSize: 34, fontWeight: "700", letterSpacing: -0.5, marginTop: 16, textAlign: "center" },
  sous: { fontSize: 17, marginTop: 4, textAlign: "center" },

  carte: { marginTop: 14, paddingHorizontal: 20 },
  titreCarte: { fontSize: 22, fontWeight: "600", letterSpacing: -0.3, textAlign: "center" },

  chiffres: {
    flexDirection: "row",
    marginTop: 18,
    paddingTop: 18,
    paddingBottom: 16,
    paddingHorizontal: 8,
  },
  chiffre: { flex: 1, alignItems: "center" },
  chiffreN: { fontSize: 34, fontWeight: "700", letterSpacing: -0.5, fontVariant: ["tabular-nums"] },
  chiffrePetit: { fontSize: 20 },
  chiffreL: { fontSize: 13, lineHeight: 16, minHeight: 32, marginTop: 4, textAlign: "center" },

  ligne: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 56,
    paddingVertical: 10,
  },
  ligneL: { fontSize: 17, fontWeight: "600", flexShrink: 1 },
  ligneAide: { fontSize: 13, lineHeight: 18, marginTop: 3 },
  ligneV: { fontSize: 17, fontVariant: ["tabular-nums"] },
  ligneVFort: { fontWeight: "600" },
  ligneErreur: { fontSize: 15, paddingBottom: 12 },

  forme: { flexDirection: "row", gap: 5 },
  formeCase: { width: 26, height: 26, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  formeLettre: { fontSize: 12, fontWeight: "700" },

  cartePaliers: { paddingHorizontal: 18, paddingBottom: 16 },
  palier: { paddingTop: 10, paddingBottom: 4, borderTopWidth: 1 },
  palierTete: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 10 },
  palierQuoi: { fontSize: 15, fontWeight: "600", flexShrink: 1 },
  palierCompte: { fontSize: 13 },
  gras: { fontWeight: "700" },
  barreFond: { height: 5, borderRadius: 3, marginTop: 7, overflow: "hidden" },
  barrePleine: { height: 5, borderRadius: 3 },

  // La grille du site : 64 px pour la date, le score, les buts — sans écart.
  // La date passe en 15 : c'est le repère, pas la nouvelle. Trois textes de la
  // même taille sur une rangée, on ne sait pas lequel lire en premier.
  match: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 54,
    borderTopWidth: 1,
  },
  saison: { justifyContent: "space-between", gap: 10 },
  matchDate: { fontSize: 15, width: 64, fontVariant: ["tabular-nums"] },
  matchScore: { fontSize: 17, flex: 1, minWidth: 0, fontVariant: ["tabular-nums"] },
  matchButs: { fontSize: 17, fontWeight: "600", marginLeft: 8, fontVariant: ["tabular-nums"] },
  gagne: { fontWeight: "600" },

  carteTrophees: { paddingHorizontal: 18, paddingBottom: 18 },
  grille: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  trophee: { borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, gap: 2 },
  tropheeNom: { fontSize: 15, fontWeight: "700" },
  tropheeDetail: { fontSize: 13 },
  tropheeQuand: { fontSize: 13, marginTop: 2 },

  vide: { fontSize: 17, lineHeight: 23, paddingTop: 16, paddingBottom: 18 },
});
