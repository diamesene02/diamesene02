import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { chargerMoiMemorise, useClubId, useClubMemorise } from "../../../composants/ClubCourant";
import Ecran from "../../../composants/Ecran";
import EnTeteClub from "../../../composants/EnTeteClub";
import ErreurChargement from "../../../composants/ErreurChargement";
import { Avatar, BoutonVerre, CarteVerre } from "../../../composants/base";
import { CarteSquelette, Squelette } from "../../../composants/Squelette";
import Etoiles from "../../../composants/Etoiles";
import { IconeJeu } from "../../../composants/Icones";
import PastilleNiveau from "../../../composants/joueur/PastilleNiveau";
import { jeton, JETONS_NEUTRES, type Jetons } from "../../../lib/couleurs";
import { succes as retourSucces } from "../../../lib/haptique";
import { messageErreur } from "../../../lib/erreurs";
import { chargerSuccesClub } from "../../../lib/succes";
import { ESPACE_BARRE } from "../../../composants/BarreOnglets";
import {
  chargerEcranEffectif,
  modifierJoueur,
  rattacherJoueur,
  SessionExpiree,
  type ClubDeMoi,
  type EcranEffectif,
} from "../../../lib/api";

type Niveaux = Map<string, { niveau: number; titre: string }>;

/// « Effectif » — le vestiaire du club.
///
/// Une carte, une rangée par joueur : l'avatar, le nom et son niveau, les
/// cinq étoiles de sa note, ses matchs et ses buts. Les chiffres sont ceux de
/// TOUTES les saisons — le vestiaire raconte une carrière, pas un exercice.
///
/// Deux chiffres se suivent ici, et ils ne disent pas la même chose : les
/// étoiles sont la NOTE (1 à 5) que le capitaine donne pour équilibrer les
/// équipes, la pastille est le NIVEAU gagné en jouant (les succès). Le mot
/// « niveau » est réservé au second — VoiceOver annonçait « niveau 7,
/// Taulier » puis « Niveau 3 sur 5 » à une seconde d'intervalle. La pastille
/// manque pour les invités, que les succès du club ne classent pas.
///
/// Les archivés vivent sous un repli : ce sont ceux qui ne jouent plus, ils
/// ne doivent pas encombrer la liste de ceux qui viennent lundi.
export default function Effectif() {
  const id = useClubId();
  const memo = useClubMemorise();
  const [club, setClub] = useState<ClubDeMoi | null>(null);
  const [donnees, setDonnees] = useState<EcranEffectif | null>(null);
  const [niveaux, setNiveaux] = useState<Niveaux | null>(null);
  const [archivesOuverts, setArchivesOuverts] = useState(false);
  const [occupe, setOccupe] = useState(true);
  const [rafraichit, setRafraichit] = useState(false);
  const [erreur, setErreur] = useState<unknown>(null);
  /// L'identifiant du joueur en cours de revendication : il désarme les autres
  /// boutons pendant l'aller-retour. Deux « C'est moi » tapés coup sur coup
  /// sur deux rangées voisines, et le second gagne — ce n'est pas ce qu'on
  /// voulait dire.
  const [revendique, setRevendique] = useState<string | null>(null);

  const c = club ?? memo;
  const t: Jetons = c?.theme.sombre ?? JETONS_NEUTRES;

  const charger = useCallback(async () => {
    if (!id) return;
    setErreur(null);
    try {
      const [moi, e, sc] = await Promise.all([
        chargerMoiMemorise(),
        chargerEcranEffectif(id),
        // Les niveaux sont un plus : sans eux, le vestiaire s'affiche quand
        // même, sans pastille.
        chargerSuccesClub(id).catch(() => undefined),
      ]);
      setClub(moi.clubs.find((x) => x.id === id) ?? null);
      setDonnees(e);
      if (sc) {
        setNiveaux(new Map(sc.niveaux.map((n) => [n.playerId, { niveau: n.niveau, titre: n.titre }])));
      }
    } catch (e) {
      if (e instanceof SessionExpiree) return router.replace("/connexion");
      setErreur(e);
    } finally {
      setOccupe(false);
    }
  }, [id]);

  // Au focus seulement : le premier affichage en est un aussi. Un `useEffect`
  // en plus faisait partir les trois requêtes deux fois à l'ouverture, dont
  // deux fois les succès du club, qui recalculent tout l'historique.
  useFocusEffect(
    useCallback(() => {
      void charger();
    }, [charger]),
  );

  const rafraichir = useCallback(async () => {
    setRafraichit(true);
    await charger();
    setRafraichit(false);
  }, [charger]);

  /// « C'est moi » : je récupère mon historique de joueur.
  ///
  /// Le geste du nouveau membre. Il rejoint le club par un lien, et sa fiche
  /// est déjà là — quinze matchs sous son prénom, créés par le capitaine avant
  /// qu'il n'ait un compte. Sans ce bouton il repart de zéro à côté de sa
  /// propre histoire.
  ///
  /// Le serveur tranche seul : il refuse un profil déjà pris, un invité, un
  /// archivé, et la course entre deux téléphones. On recharge dans TOUS les
  /// cas — en cas de refus, ce qu'on avait à l'écran était périmé, et c'est
  /// justement ce qui explique le refus.
  const revendiquer = useCallback(
    async (joueurId: string) => {
      if (!id || revendique) return;
      setRevendique(joueurId);
      try {
        await rattacherJoueur(id, joueurId);
        retourSucces();
      } catch (e) {
        if (e instanceof SessionExpiree) return router.replace("/connexion");
        Alert.alert("Ce profil n'a pas pu être rattaché", messageErreur(e));
      } finally {
        setRevendique(null);
        await charger();
      }
    },
    [id, revendique, charger],
  );

  /// Sortir un joueur du fond du vestiaire.
  ///
  /// Le pendant d'« Archiver », et la seule façon de revenir en arrière : sans
  /// lui, une fiche rangée par erreur ne ressort plus depuis le téléphone.
  const reactiver = (joueurId: string, nom: string) => {
    if (!id) return;
    Alert.alert(`Réactiver ${nom} ?`, "Il revient dans la liste de ceux qui viennent lundi.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Réactiver",
        onPress: () => {
          void modifierJoueur(id, joueurId, { archive: false })
            .then(() => {
              retourSucces();
              return charger();
            })
            .catch((e: unknown) => Alert.alert("La réactivation n'est pas passée", messageErreur(e)));
        },
      },
    ]);
  };

  const actifs = (donnees?.joueurs ?? []).filter((j) => !j.archive);
  const archives = (donnees?.joueurs ?? []).filter((j) => j.archive);
  /// La même condition que le site : le bouton n'existe qu'au premier passage,
  /// tant que ce membre n'a revendiqué personne. Un invité ne se revendique
  /// pas (il n'a pas de compte à lui), un profil déjà pris non plus — c'est un
  /// arbitrage d'admin, il se fait sur le site.
  const peutRevendiquer = donnees != null && !donnees.aDejaUnProfil;
  const couleurA = c?.couleurA ?? "#ffffff";

  return (
    <Ecran t={t} chasubles={{ a: couleurA, b: c?.couleurB ?? "#111111" }}>
      <ScrollView
        contentContainerStyle={s.contenu}
        refreshControl={
          <RefreshControl refreshing={rafraichit} onRefresh={rafraichir} tintColor={t.i2} />
        }
      >
        <EnTeteClub t={t} club={c} titre="Effectif" sousTitre={donnees?.sousTitre} />

        <View style={s.corps}>
          {/* Le vestiaire fait une vingtaine de rangées : sa forme est celle
              d'une liste de visages, et c'est elle qu'on attend. */}
          {occupe && !donnees && (
            <Squelette etiquette="On va chercher le vestiaire">
              <CarteSquelette t={t} rangees={8} hauteurRangee={58} style={s.squelette} />
            </Squelette>
          )}
          {erreur != null && (
            <ErreurChargement t={t} erreur={erreur} onReessayer={charger} style={s.erreur} />
          )}

          {/* Un seul « Ajouter un joueur », au-dessus de la liste, comme le
              site. Réservé aux gérants — c'est le serveur qui tranche, l'écran
              ne fait que ne pas mentir. */}
          {donnees?.peutGerer && (
            <BoutonVerre
              t={t}
              titre="Ajouter un joueur"
              icone={<IconeJeu nom="plus" couleur={t.ink} taille={15} />}
              onPress={() => router.push({ pathname: "/joueur/fiche", params: { clubId: id } })}
              style={s.ajouter}
            />
          )}

          {actifs.length > 0 && (
            <CarteVerre t={t} style={s.carte}>
              {actifs.map((j, i) => (
                <Rangee
                  key={j.id}
                  j={j}
                  t={t}
                  premiere={i === 0}
                  clubId={id}
                  niveau={niveaux?.get(j.id)}
                  couleurA={couleurA}
                  // « C'est moi » ne s'affiche que sur une fiche revendiquable :
                  // libre, pas un invité, et seulement si je n'ai pas déjà la
                  // mienne. Le serveur porte la même règle et tranche en
                  // dernier ressort ; ici c'est pour ne pas proposer un bouton
                  // qui sera refusé.
                  revendiquable={peutRevendiquer && !j.compteLie && !j.invite}
                  onRevendiquer={() => void revendiquer(j.id)}
                  occupe={revendique != null}
                  enCours={revendique === j.id}
                />
              ))}
            </CarteVerre>
          )}

          {donnees && actifs.length === 0 && (
            <View style={s.vide}>
              <Text style={[s.videTexte, { color: t.i2 }]}>
                Personne dans le vestiaire pour l&apos;instant.
              </Text>
              {donnees.peutGerer && (
                <Text style={[s.videTexte, { color: t.i2 }]}>Ajoute tes premiers joueurs.</Text>
              )}
            </View>
          )}

          {archives.length > 0 && (
            <>
              <Pressable
                onPress={() => setArchivesOuverts((o) => !o)}
                accessibilityRole="button"
                accessibilityState={{ expanded: archivesOuverts }}
                style={({ pressed }) => [s.deplier, pressed && { opacity: 0.6 }]}
              >
                <Text style={[s.deplierTexte, { color: t.i2 }]}>Archivés ({archives.length})</Text>
                {/* Le chevron pivote vers le bas quand le repli est ouvert :
                    le titre seul ne disait pas qu'il y avait quelque chose
                    dessous, ni si on venait de l'ouvrir. */}
                <View style={archivesOuverts && s.chevronOuvert}>
                  <IconeJeu nom="chevron" couleur={jeton(t, "i3")} taille={14} />
                </View>
              </Pressable>
              {archivesOuverts && (
                <CarteVerre t={t} style={[s.carte, s.carteArchives]}>
                  {archives.map((j, i) => (
                    <Rangee
                      key={j.id}
                      j={j}
                      t={t}
                      premiere={i === 0}
                      clubId={id}
                      couleurA={couleurA}
                      petite
                      onReactiver={donnees?.peutGerer ? () => reactiver(j.id, j.nom) : undefined}
                    />
                  ))}
                </CarteVerre>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </Ecran>
  );
}

function Rangee({
  j,
  t,
  premiere,
  clubId,
  niveau,
  couleurA,
  petite,
  revendiquable,
  onRevendiquer,
  onReactiver,
  occupe,
  enCours,
}: {
  j: EcranEffectif["joueurs"][number];
  t: Jetons;
  premiere: boolean;
  clubId: string;
  /// Le niveau gagné en jouant (les succès). Absent : pas de pastille.
  niveau?: { niveau: number; titre: string };
  couleurA: string;
  petite?: boolean;
  /// C'est l'écran qui décide qui est revendicable ; la rangée ne fait que
  /// peindre.
  revendiquable?: boolean;
  onRevendiquer?: () => void;
  onReactiver?: () => void;
  /// Une revendication est en cours quelque part dans la liste : on éteint
  /// les autres boutons plutôt que de laisser lancer une seconde course.
  occupe?: boolean;
  enCours?: boolean;
}) {
  const encre = petite ? t.i2 : t.ink;
  const chiffres = `${j.matchs} match${j.matchs > 1 ? "s" : ""} · ${j.buts} but${j.buts > 1 ? "s" : ""}`;
  return (
    <View style={!premiere && { borderTopWidth: 1, borderTopColor: jeton(t, "sep") }}>
      <Pressable
        onPress={() => router.push({ pathname: "/joueur/[id]", params: { id: j.id, clubId } })}
        accessibilityRole="button"
        accessibilityLabel={[
          j.nom,
          j.estMoi ? "toi" : null,
          niveau ? `niveau ${niveau.niveau}, ${niveau.titre}` : null,
          !petite && j.gardien ? "gardien" : null,
          // Le point vert ne se voyait que des yeux : il se dit maintenant.
          !petite && j.compteLie ? "a un compte" : null,
          chiffres,
        ]
          .filter(Boolean)
          .join(", ")}
        style={({ pressed }) => [
          s.rangee,
          petite && s.rangeePetite,
          j.estMoi && !petite && [s.moi, { backgroundColor: jeton(t, "gl") }],
          pressed && { opacity: 0.7 },
        ]}
      >
        <Avatar
          nom={j.nom}
          photo={j.photo}
          t={t}
          taille={petite ? 34 : 40}
          initiales={j.initiales}
        />
        {/* LA LIGNE DU NOM N'APPARTIENT QU'AU NOM.
            Elle portait jusqu'ici la pastille de niveau, le gant du gardien et
            le point du compte lié : trois marques qui poussaient « Jean-
            Baptiste » vers les points de suspension, et dont la position
            changeait d'une rangée à l'autre selon ce que le joueur avait. Les
            noms longs sont la règle au club — elles passent à droite, dans une
            colonne qui s'aligne d'une rangée à l'autre. */}
        <View style={s.textes}>
          <Text style={[s.nom, { color: encre }, j.estMoi && s.nomMoi]} numberOfLines={1}>
            {j.nom}
          </Text>
          <View style={s.sousLigne}>
            {/* La note était peinte en encre secondaire : des étoiles grises
                sur un fond gris, qu'on ne lisait qu'en s'arrêtant dessus. */}
            {!petite && <Etoiles note={j.niveau} couleur={t.ink} taille={12} />}
            <Text style={[s.chiffres, { color: t.i2 }]} numberOfLines={1}>
              {chiffres}
              {!petite && j.invite ? " · invité" : ""}
            </Text>
          </View>
        </View>
        {/* Un archivé ne montre ni ses marques, ni de chevron : il ne joue
            plus. Ses chiffres restent — c'est ce qu'on vient y chercher quand
            on le réactive. */}
        {!petite && (
          <View style={s.marques}>
            {j.gardien && <IconeJeu nom="gant" couleur={jeton(t, "i2")} taille={15} />}
            {j.compteLie && <View style={[s.pointLie, { backgroundColor: jeton(t, "ok") }]} />}
            {niveau && (
              <PastilleNiveau niveau={niveau.niveau} titre={niveau.titre} couleur={couleurA} />
            )}
            <IconeJeu nom="chevron" couleur={jeton(t, "i3")} taille={15} />
          </View>
        )}
      </Pressable>

      {/* Les outils sous la rangée, alignés sur le texte : ce sont des gestes
          rares — deux fois par saison — et ils n'ont pas à disputer la place
          au nom, qu'on lit toutes les semaines. */}
      {(revendiquable || onReactiver) && (
        <View style={[s.outils, petite && { paddingLeft: 46 }]}>
          {revendiquable && onRevendiquer && (
            <Pressable
              onPress={onRevendiquer}
              // Éteint pendant qu'une revendication tourne, ici ou sur une
              // autre rangée : deux courses lancées en même temps, c'est un
              // profil pris par le second appui et un refus incompréhensible.
              disabled={occupe}
              accessibilityRole="button"
              accessibilityLabel={`C'est moi : ${j.nom}`}
              accessibilityState={{ disabled: !!occupe, busy: !!enCours }}
              hitSlop={5}
              style={({ pressed }) => [
                s.outil,
                { backgroundColor: jeton(t, "gl"), borderColor: jeton(t, "gb") },
                { opacity: occupe && !enCours ? 0.4 : pressed ? 0.6 : 1 },
              ]}
            >
              {enCours ? (
                <ActivityIndicator size="small" color={t.ink} />
              ) : (
                <Text style={[s.outilTexte, { color: t.ink }]}>C&apos;est moi</Text>
              )}
            </Pressable>
          )}
          {onReactiver && (
            <Pressable
              onPress={onReactiver}
              accessibilityRole="button"
              accessibilityLabel={`Réactiver ${j.nom}`}
              hitSlop={5}
              style={({ pressed }) => [
                s.outil,
                { backgroundColor: jeton(t, "gl"), borderColor: jeton(t, "gb") },
                pressed && { opacity: 0.6 },
              ]}
            >
              <Text style={[s.outilTexte, { color: t.ink }]}>Réactiver</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  contenu: { paddingBottom: ESPACE_BARRE },
  corps: { paddingHorizontal: 14 },
  squelette: { marginTop: 16 },
  erreur: { marginTop: 24 },

  ajouter: { marginTop: 16 },
  carte: { paddingHorizontal: 16, marginTop: 16 },
  carteArchives: { marginTop: 12 },
  // 58 et non 64 : avec un avatar de 40, deux lignes de texte tiennent au
  // large dans 58, et l'écran montre une rangée de plus sans rien serrer.
  rangee: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 58 },
  rangeePetite: { minHeight: 50 },
  // Ma ligne, surlignée comme dans les tableaux des stats : le verre des
  // pilules, débordant de 8 de chaque côté pour que le texte ne bouge pas.
  moi: { marginHorizontal: -8, paddingHorizontal: 8, borderRadius: 14 },
  textes: { flex: 1, minWidth: 0, gap: 3 },
  nom: { fontSize: 17, fontWeight: "600" },
  nomMoi: { fontWeight: "700" },
  // La colonne de droite : gant, compte lié, niveau, chevron — toujours dans
  // cet ordre, alignée à droite d'une rangée à l'autre.
  marques: { flexDirection: "row", alignItems: "center", gap: 8 },
  pointLie: { width: 7, height: 7, borderRadius: 3.5 },
  sousLigne: { flexDirection: "row", alignItems: "center", gap: 8 },
  chiffres: { fontSize: 13, flexShrink: 1, fontVariant: ["tabular-nums"] },
  outils: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingLeft: 52, paddingBottom: 12 },
  outil: {
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  outilTexte: { fontSize: 15, fontWeight: "600" },

  vide: { marginTop: 24, gap: 4, paddingHorizontal: 4 },
  videTexte: { fontSize: 15 },

  // « Archivés (36) » : le kicker du site, à gauche, 32 sous la carte.
  deplier: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    minHeight: 44,
    marginTop: 20,
    paddingHorizontal: 4,
  },
  deplierTexte: { fontSize: 15, fontWeight: "600", letterSpacing: -0.1 },
  chevronOuvert: { transform: [{ rotate: "90deg" }] },
});
