import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import Ecran from "../../composants/Ecran";
import EnTeteClub, { TitreEcran } from "../../composants/EnTeteClub";
import ErreurChargement from "../../composants/ErreurChargement";
import { BoutonVerre, CarteVerre } from "../../composants/base";
import { Bloc, Squelette } from "../../composants/Squelette";
import { useNoyau } from "../../composants/Noyau";
import { chargerMoiMemorise, useClubMemorise } from "../../composants/ClubCourant";
import CarteReponse from "../../composants/soiree/CarteReponse";
import CarteCompo from "../../composants/soiree/CarteCompo";
import CarteTerrain from "../../composants/soiree/CarteTerrain";
import {
  CarteBilan,
  CarteCracks,
  CarteDirect,
  CarteMatchs,
  CarteMot,
} from "../../composants/soiree/CartesApres";
import { useCompoSoiree } from "../../composants/soiree/useCompoSoiree";
import { useGarderBrouillon } from "../../composants/soiree/useGarderBrouillon";
import { quandRelatif, texteConvocation } from "../../composants/soiree/logique";
import { jeton, jetonsDuClub, JETONS_NEUTRES, type Jetons } from "../../lib/couleurs";
import { joursEntre } from "../../lib/datesRelatives";
import { avertissement, succes } from "../../lib/haptique";
import { messageErreur } from "../../lib/erreurs";
import {
  chargerSoiree,
  PROD,
  reprendreCompoPrecedente,
  SessionExpiree,
  type ClubDeMoi,
  type FicheSoiree,
} from "../../lib/api";

/// La fiche d'une soirée — l'écran-pivot du lundi, dans le dessin du site.
///
/// Avant : qui vient, quelles équipes, qui a payé le terrain. Après : le
/// bilan, le mot à coller dans le groupe, les matchs, les cracks du soir.
/// Dès qu'un match existe, les résultats passent devant la préparation :
/// la question n'est plus « qui vient » mais « qu'est-ce qui s'est passé ».
///
/// Les boutons suivent le calendrier, comme sur le site : « Lancer un
/// match » le jour même seulement — proposé le samedi pour le lundi, il
/// ouvrait une feuille en direct deux jours trop tôt —, « Saisir un match
/// joué » le jour même et après, « Envoyer sur le groupe » tant que la
/// soirée est devant nous.
///
/// Le coup d'envoi ouvre la compo AVEC les équipes préparées ici : celles
/// décidées le jeudi sur WhatsApp ne se refont pas au pouce le lundi.
export default function Soiree() {
  const { id, clubId: clubParam } = useLocalSearchParams<{ id: string; clubId?: string }>();
  const { local } = useNoyau();
  const [clubId, setClubId] = useState<string | null>(clubParam ?? null);
  const memo = useClubMemorise(clubId);
  const [club, setClub] = useState<ClubDeMoi | null>(null);
  const [fiche, setFiche] = useState<FicheSoiree | null>(null);
  const [occupe, setOccupe] = useState(true);
  const [rafraichit, setRafraichit] = useState(false);
  const [erreur, setErreur] = useState<unknown>(null);
  const [messagePartage, setMessagePartage] = useState<string | null>(null);

  const charger = useCallback(async () => {
    if (!id) return;
    try {
      // Le club vient du paramètre quand on arrive depuis l'app ; sinon on le
      // retrouve par /api/me — un lien partagé n'a pas de contexte.
      const moi = chargerMoiMemorise();
      const cid = clubParam ?? (await moi).clubs[0]?.id;
      if (!cid) throw new Error("Tu n'es membre d'aucun club pour l'instant.");
      setClubId(cid);
      const [f, m] = await Promise.all([chargerSoiree(cid, id), moi.catch(() => null)]);
      setFiche(f);
      if (m) setClub(m.clubs.find((c) => c.id === cid) ?? null);
      setErreur(null);
    } catch (e) {
      if (e instanceof SessionExpiree) return router.replace("/connexion");
      setErreur(e);
    } finally {
      setOccupe(false);
    }
  }, [id, clubParam]);

  // À chaque retour sur l'écran : un match lancé depuis la compo, une réponse
  // donnée ailleurs changent la soirée.
  useFocusEffect(
    useCallback(() => {
      void charger();
    }, [charger]),
  );

  const compo = useCompoSoiree({ fiche, clubId, recharger: charger });
  useGarderBrouillon({
    modifie: compo.modifie,
    titre: "Enregistrer tes équipes ?",
    message: "Tu as changé la compo sans l'enregistrer.",
    enregistrer: compo.enregistrer,
    jeter: compo.jeter,
  });

  const c = club ?? memo;
  const couleurA = fiche?.chasubles.a.couleur ?? c?.couleurA ?? "#ffffff";
  const couleurB = fiche?.chasubles.b.couleur ?? c?.couleurB ?? "#111111";
  const t: Jetons = fiche
    ? jetonsDuClub(couleurA, couleurB, "dark")
    : (c?.theme.sombre ?? JETONS_NEUTRES);
  const fond = fiche || c ? { a: couleurA, b: couleurB } : undefined;

  const poserFiche = (maj: (f: FicheSoiree) => FicheSoiree) =>
    setFiche((f) => (f ? maj(f) : f));

  async function partager() {
    if (!fiche) return;
    setMessagePartage(null);
    const equipe = (camp: "A" | "B") => {
      const eq = compo.joueurs.filter((j) => compo.camps[j.playerId] === camp);
      const gk = eq.find((j) => compo.gardiens[j.playerId]);
      return (gk ? [gk, ...eq.filter((j) => j !== gk)] : eq).map((j) => j.nom);
    };
    const lien = c?.slug ? `${PROD}/c/${c.slug}/sessions/${fiche.id}` : PROD;
    const texte = texteConvocation({
      entete: [fiche.dateLabel, fiche.heure, fiche.lieu].filter(Boolean).join(" · "),
      etat: fiche.presences.phrase || null,
      equipes: [
        { nom: compo.nomA, joueurs: equipe("A") },
        { nom: compo.nomB, joueurs: equipe("B") },
      ],
      lien,
    });
    try {
      await Share.share({ message: texte });
    } catch (e) {
      setMessagePartage(messageErreur(e));
    }
  }

  async function compoPrecedente() {
    if (!fiche || !clubId) return;
    try {
      const r = await reprendreCompoPrecedente(clubId, fiche.id);
      compo.reprendreDuServeur();
      succes();
      compo.setMessage({
        texte: `Compo précédente reprise : ${r.reprises} joueur${r.reprises > 1 ? "s" : ""}.`,
        ton: "ok",
      });
      await charger();
    } catch (e) {
      avertissement();
      compo.setMessage({ texte: messageErreur(e), ton: "erreur" });
    }
  }

  const ouvrirCompo = (quand: "maintenant" | "deja") => {
    if (!fiche || !clubId) return;
    router.push({
      pathname: "/compo",
      params:
        quand === "deja"
          ? { clubId, soireeId: fiche.id, quand: "deja", date: fiche.date }
          : { clubId, soireeId: fiche.id },
    });
  };

  async function ouvrirMatch(m: FicheSoiree["matchs"][number]) {
    if (!clubId) return;
    // La feuille en direct ne s'ouvre que sur le téléphone qui la tient :
    // lancée ailleurs, on la suit par son récap, sans tourner dans le vide.
    if (m.direct) {
      const enCours = await local.getLiveMatchOfClub(clubId).catch(() => undefined);
      if (enCours?.id === m.id) {
        return router.push({ pathname: "/match/[id]", params: { id: m.id } });
      }
    }
    router.push({ pathname: "/recap/[id]", params: { id: m.id, clubId } });
  }

  const jourJ = fiche ? joursEntre(fiche.date) === 0 : false;
  const modifiable = Boolean(fiche?.peutScorer) && !fiche?.annulee;
  const peutLancer = Boolean(fiche?.peutScorer) && Boolean(fiche?.soireeFinie) && !fiche?.annulee;
  const lancer = peutLancer && jourJ;
  // « Saisir un match joué » ouvre une feuille SANS chrono. Or la feuille
  // déduit ce mode de l'heure : elle n'est « saisie » que passé six heures
  // (lib/noyau/retro). Le jour même, la feuille s'ouvrirait donc en direct,
  // chrono lancé à l'heure de la soirée, buts tamponnés à la 120e minute et
  // durée fausse à l'enregistrement. Le jour même, c'est « Coup d'envoi » qui
  // sert — comme le dit déjà `suite` plus bas.
  const saisir = peutLancer && Boolean(fiche?.passee);
  const aVenir = fiche ? !fiche.annulee && !fiche.passee : false;
  // Le capitaine a « Envoyer sur le groupe » au pied de la compo tant que ce
  // n'est pas le jour même ; les autres membres l'ont en tête de page.
  const envoyerEnTete = aVenir && (jourJ || !fiche?.peutScorer);

  // « Coup d'envoi » ne veut dire qu'UNE chose, ici comme sur le site : le
  // bouton qui ouvre VRAIMENT la feuille, chrono lancé — celui de l'accueil
  // (compo prête, un tap) et celui du pied de l'écran de compo. Ce bouton-ci
  // emmène sur la compo : il porte donc le mot du site, « Lancer un match ».
  // Avant, on tapait « Coup d'envoi » sur la soirée, on arrivait sur un écran
  // où il fallait retaper « Coup d'envoi » — deux boutons du même nom à la
  // suite, et le doute au milieu sur ce qui avait déjà démarré.
  const suite = !fiche?.soireeFinie
    ? null
    : jourJ
      ? {
          libelle: "Lancer un match",
          etiquette: "Lancer un match, avec les équipes préparées",
          onPress: () => ouvrirCompo("maintenant"),
        }
      : fiche?.passee
        ? { libelle: "Saisir un match joué", onPress: () => ouvrirCompo("deja") }
        : { libelle: "Envoyer sur le groupe", onPress: () => void partager() };

  const relatif = fiche ? quandRelatif(fiche.date) : null;
  const directs = fiche?.matchs.filter((m) => m.direct) ?? [];
  const autres = fiche?.matchs.filter((m) => !m.direct) ?? [];

  const preparation = fiche && clubId && (
    <>
      <CarteReponse t={t} fiche={fiche} clubId={clubId} onFiche={poserFiche} recharger={charger} />
      {!fiche.annulee && (
        <CarteCompo
          t={t}
          compo={compo}
          couleurA={couleurA}
          couleurB={couleurB}
          modifiable={modifiable}
          suite={suite}
          onCompoPrecedente={() => void compoPrecedente()}
        />
      )}
      {fiche.terrain.visible && (
        <CarteTerrain t={t} fiche={fiche} clubId={clubId} onFiche={poserFiche} recharger={charger} />
      )}
    </>
  );

  const resultats = fiche && (
    <>
      <CarteBilan t={t} fiche={fiche} couleurA={couleurA} couleurB={couleurB} />
      {fiche.mot && <CarteMot t={t} mot={fiche.mot} />}
      {directs.map((m) => (
        <CarteDirect
          key={m.id}
          t={t}
          m={m}
          couleurA={couleurA}
          couleurB={couleurB}
          onOuvrir={() => void ouvrirMatch(m)}
        />
      ))}
      <CarteMatchs
        t={t}
        matchs={autres}
        couleurA={couleurA}
        couleurB={couleurB}
        onOuvrir={(m) => void ouvrirMatch(m)}
      />
      <CarteCracks
        t={t}
        cracks={fiche.cracks}
        onOuvrir={(playerId) =>
          router.push({ pathname: "/joueur/[id]", params: { id: playerId, clubId: clubId ?? "" } })
        }
      />
    </>
  );

  return (
    <Ecran t={t} chasubles={fond}>
      <ScrollView
        contentContainerStyle={s.contenu}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={rafraichit}
            onRefresh={async () => {
              setRafraichit(true);
              await charger();
              setRafraichit(false);
            }}
            tintColor={t.i2}
          />
        }
      >
        <EnTeteClub t={t} club={c} clubId={clubId} />

        {!fiche && occupe && <SqueletteSoiree t={t} />}

        {fiche ? (
          <>
            <TitreEcran
              t={t}
              titre={fiche.dateLabel}
              sousTitre={[relatif, fiche.sousTitre].filter(Boolean).join(" · ")}
            />
            <View style={s.tete}>
              {fiche.notes ? (
                <Text style={[s.notes, { color: jeton(t, "i2") }]}>{fiche.notes}</Text>
              ) : null}
              {fiche.annulee ? (
                <View style={[s.annulee, { backgroundColor: jeton(t, "seg") }]}>
                  <Text style={[s.annuleeTexte, { color: jeton(t, "i2") }]}>Soirée annulée.</Text>
                </View>
              ) : (
                (lancer || saisir || envoyerEnTete) && (
                  <View style={s.actions}>
                    {lancer && (
                      <BoutonVerre
                        t={t}
                        taille="normal"
                        titre="Lancer un match"
                        etiquette="Lancer un match, avec les équipes préparées"
                        onPress={() => ouvrirCompo("maintenant")}
                      />
                    )}
                    {saisir && (
                      <BoutonVerre
                        t={t}
                        taille="normal"
                        titre="Saisir un match joué"
                        onPress={() => ouvrirCompo("deja")}
                      />
                    )}
                    {envoyerEnTete && (
                      <BoutonVerre
                        t={t}
                        taille="normal"
                        titre="Envoyer sur le groupe"
                        onPress={() => void partager()}
                      />
                    )}
                  </View>
                )
              )}
              {messagePartage && (
                <Text style={[s.notes, { color: jeton(t, "bad") }]}>{messagePartage}</Text>
              )}
            </View>
          </>
        ) : null}

        <View style={s.cartes}>
          {erreur != null && (
            <ErreurChargement t={t} erreur={erreur} onReessayer={charger} />
          )}

          {fiche &&
            (fiche.commencee ? (
              <>
                {resultats}
                {preparation}
              </>
            ) : (
              preparation
            ))}
        </View>
      </ScrollView>
    </Ecran>
  );
}

/// L'attente de la fiche d'une soirée, à la forme de la fiche.
///
/// C'est l'écran-pivot du lundi, et celui qu'on ouvre depuis une notification
/// WhatsApp, donc souvent sur un réseau qui ne vaut rien. Mesuré le 22
/// septembre 2026 sur le serveur de développement (machine chargée) :
/// médiane 667 ms pour `/soirees/:id`, pointe à 2,9 s. C'est la durée pendant
/// laquelle on ne voyait que deux rectangles gris.
///
/// Le titre d'abord, aux mesures exactes de `TitreEcran` (34 et 17) : sans
/// lui, la page n'avait rien au-dessus des cartes et TOUT descendait de
/// quatre-vingt-dix points quand la fiche arrivait — le pouce était déjà
/// posé ailleurs. Puis les deux cartes : les réponses (« qui vient ») avec
/// ses rangées de joueurs, et la composition avec sa pelouse.
///
/// Le tout dans UN seul `Squelette` : le titre et les cartes respirent
/// ensemble. En deux, la moitié haute restait fixe pendant que la basse
/// pulsait, et ça se lisait comme une panne.
function SqueletteSoiree({ t }: { t: Jetons }) {
  return (
    <Squelette etiquette="On ouvre la soirée">
      <View style={sq.tete}>
        <Bloc t={t} l="62%" h={34} r={10} />
        <Bloc t={t} l="38%" h={17} style={sq.sousTitre} />
      </View>

      <View style={sq.cadre}>
        <CarteVerre t={t} style={sq.carte}>
          <View style={sq.ligneTitre}>
            <Bloc t={t} l="42%" h={19} />
            <Bloc t={t} l={132} h={32} r={16} />
          </View>
          {/* Pas de filet ici : une ligne d'un point qui respire ne se lit pas,
              elle scintille. Le vide entre les blocs suffit à dire la coupure. */}
          <View style={sq.ligneTitre}>
            <Bloc t={t} l="46%" h={14} />
            <Bloc t={t} l={70} h={14} />
          </View>
          <Bloc t={t} l="100%" h={38} r={12} style={sq.pastille} />
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={sq.rangee}>
              <Bloc t={t} l={32} h={32} r={16} />
              <Bloc t={t} l={["58%", "44%", "66%", "50%", "60%"][i] as `${number}%`} h={15} />
              <View style={sq.pousse} />
              <Bloc t={t} l={62} h={15} />
            </View>
          ))}
        </CarteVerre>

        <CarteVerre t={t} style={sq.carte}>
          <Bloc t={t} l="38%" h={19} />
          <Bloc t={t} l="100%" h={40} r={14} style={sq.pastille} />
          {/* La pelouse : deux colonnes de cinq, comme les deux équipes. */}
          <View style={sq.pelouse}>
            {[0, 1].map((camp) => (
              <View key={camp} style={sq.camp}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <View key={i} style={sq.joueur}>
                    <Bloc t={t} l={38} h={38} r={19} />
                    <Bloc t={t} l={52} h={11} />
                  </View>
                ))}
              </View>
            ))}
          </View>
          <View style={sq.ligneTitre}>
            <Bloc t={t} l="46%" h={44} r={22} />
            <Bloc t={t} l="46%" h={44} r={22} />
          </View>
        </CarteVerre>
      </View>
    </Squelette>
  );
}

const sq = StyleSheet.create({
  // Les mêmes mesures que `TitreEcran` : 34 de haut de page, 18 de côté.
  tete: { paddingTop: 34, paddingHorizontal: 18 },
  sousTitre: { marginTop: 6 },
  // Et celles de `s.cartes`, que ce squelette remplace le temps de l'attente.
  cadre: { paddingHorizontal: 14, paddingTop: 18, gap: 18 },
  carte: { paddingHorizontal: 18, paddingVertical: 18, gap: 14 },
  ligneTitre: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  pastille: { alignSelf: "stretch" },
  rangee: { flexDirection: "row", alignItems: "center", gap: 12 },
  pousse: { flex: 1 },
  pelouse: { flexDirection: "row", gap: 14 },
  camp: { flex: 1, gap: 12, alignItems: "center" },
  joueur: { alignItems: "center", gap: 6 },
});

const s = StyleSheet.create({
  contenu: { paddingBottom: 48 },
  tete: { paddingHorizontal: 18 },
  notes: { fontSize: 15, lineHeight: 20, marginTop: 10 },
  annulee: { marginTop: 12, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14 },
  annuleeTexte: { fontSize: 15, fontWeight: "600" },
  actions: { gap: 8, marginTop: 14 },
  cartes: { paddingHorizontal: 14, paddingTop: 18, gap: 18 },
});
