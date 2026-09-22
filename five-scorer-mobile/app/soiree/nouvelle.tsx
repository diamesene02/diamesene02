import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import Ecran from "../../composants/Ecran";
import EnTeteClub, { TitreEcran } from "../../composants/EnTeteClub";
import { BoutonPlein, CarteVerre, Saisie } from "../../composants/base";
import { chargerMoiMemorise, useClubMemorise } from "../../composants/ClubCourant";
import ChampDate from "../../composants/soiree/ChampDate";
import { cleLocale, prochaineDateDeJeu, quandRelatif } from "../../composants/soiree/logique";
import { jeton, JETONS_NEUTRES, type Jetons } from "../../lib/couleurs";
import { avertissement, succes } from "../../lib/haptique";
import { messageErreur } from "../../lib/erreurs";
import { chargerSoirees, creerSoiree, SessionExpiree, type ClubDeMoi } from "../../lib/api";

/// « Programmer une soirée » — un créneau de plus au calendrier.
///
/// Le geste courant n'est pas celui-ci : un club qui joue toutes les semaines
/// pose sa saison entière d'un coup. Cet écran sert au soir en plus — un
/// tournoi, un rattrapage, un vendredi de fin d'année.
///
/// La date proposée est celle du site : le prochain jour de jeu du club, à
/// son heure habituelle, sans doubler une soirée déjà posée ; le lieu est
/// celui de la dernière soirée. L'écran partait du « prochain lundi 20 h » et
/// d'un lieu vide, quel que soit le club : on corrigeait les deux à chaque
/// fois.
export default function NouvelleSoiree() {
  const { clubId, lieu: lieuInitial } = useLocalSearchParams<{
    clubId?: string;
    lieu?: string;
  }>();
  const memo = useClubMemorise(clubId);
  const [club, setClub] = useState<ClubDeMoi | null>(null);
  const [date, setDate] = useState(() =>
    prochaineDateDeJeu({ modele: null, prises: [], maintenant: new Date() }),
  );
  const [lieu, setLieu] = useState(lieuInitial ?? "");
  const [titre, setTitre] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // Ce que la personne a déjà touché ne se fait pas écraser par la
  // proposition qui arrive du réseau une seconde plus tard.
  const touche = useRef({ date: false, lieu: Boolean(lieuInitial) });

  const c = club ?? memo;
  const t: Jetons = c?.theme.sombre ?? JETONS_NEUTRES;

  const charger = useCallback(async () => {
    if (!clubId) return;
    try {
      const [moi, soirees] = await Promise.all([
        chargerMoiMemorise().catch(() => null),
        chargerSoirees(clubId).catch(() => null),
      ]);
      if (moi) setClub(moi.clubs.find((x) => x.id === clubId) ?? null);
      if (!soirees) return;
      const toutes = [...soirees.prochaines, ...soirees.reste, ...soirees.passees].flatMap(
        (g) => g.soirees,
      );
      const valides = toutes.filter((so) => !so.annulee);
      const derniere = valides.reduce<(typeof valides)[number] | null>(
        (d, so) => (!d || so.date > d.date ? so : d),
        null,
      );
      if (!touche.current.date) {
        setDate(
          prochaineDateDeJeu({
            modele: derniere ? new Date(derniere.date) : null,
            prises: toutes.filter((so) => so.aVenir).map((so) => cleLocale(new Date(so.date))),
            maintenant: new Date(),
          }),
        );
      }
      if (!touche.current.lieu && derniere?.lieu) setLieu(derniere.lieu);
    } catch (e) {
      if (e instanceof SessionExpiree) router.replace("/connexion");
    }
  }, [clubId]);

  useEffect(() => {
    void charger();
  }, [charger]);

  async function creer() {
    if (!clubId || envoi) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await creerSoiree(clubId, {
        date: date.toISOString(),
        lieu: lieu.trim() || undefined,
        titre: titre.trim() || undefined,
      });
      succes();
      // Sur la soirée créée : c'est là que le capitaine enchaîne — la compo,
      // l'envoi sur le groupe.
      router.replace({ pathname: "/soiree/[id]", params: { id: r.soireeId, clubId } });
    } catch (e) {
      if (e instanceof SessionExpiree) return router.replace("/connexion");
      avertissement();
      setErreur(messageErreur(e));
      setEnvoi(false);
    }
  }

  const relatif = quandRelatif(date);

  return (
    <Ecran t={t} chasubles={c ? { a: c.couleurA, b: c.couleurB } : undefined}>
      <ScrollView contentContainerStyle={s.defile} keyboardShouldPersistTaps="handled">
        <EnTeteClub t={t} club={c} clubId={clubId} />

        {/* Le titre d'écran du produit (34/700 + sous-titre), le même que la
            soirée et la compo, ses deux voisins directs. Cet écran avait le
            sien : surtitre « Organisation », titre en 28, chapeau en 14 —
            trois tailles de plus pour dire la même chose, et une page qui ne
            ressemblait à aucune autre. */}
        <TitreEcran
          t={t}
          titre="Programmer une soirée"
          sousTitre="Une date, un lieu, et chacun répond présent."
        />

        <View style={s.contenu}>
          <CarteVerre t={t} style={s.carte}>
            <Text style={[s.kicker, s.libelle, { color: jeton(t, "i2") }]}>Date &amp; heure</Text>
            <ChampDate
              t={t}
              valeur={date}
              etiquette="Date et heure de la soirée"
              onChange={(d) => {
                touche.current.date = true;
                setDate(d);
              }}
            />
            {relatif && (
              <Text style={[s.relatif, { color: jeton(t, "i2") }]}>{relatif}</Text>
            )}

            <Text style={[s.kicker, s.libelle, s.suivant, { color: jeton(t, "i2") }]}>Titre</Text>
            <Saisie
              t={t}
              value={titre}
              onChangeText={setTitre}
              placeholder="Five du jeudi"
              autoCapitalize="sentences"
              accessibilityLabel="Titre de la soirée"
            />

            <Text style={[s.kicker, s.libelle, s.suivant, { color: jeton(t, "i2") }]}>Lieu</Text>
            <Saisie
              t={t}
              value={lieu}
              onChangeText={(v) => {
                touche.current.lieu = true;
                setLieu(v);
              }}
              placeholder="Urban Soccer…"
              autoCapitalize="sentences"
              returnKeyType="done"
              accessibilityLabel="Lieu de la soirée"
            />

            {erreur && <Text style={[s.erreur, { color: jeton(t, "bad") }]}>{erreur}</Text>}

            <BoutonPlein
              t={t}
              grand
              titre={envoi ? "Création…" : "Programmer la soirée"}
              occupe={envoi}
              onPress={() => void creer()}
              style={{ marginTop: 22 }}
            />
            <Text style={[s.note, { color: jeton(t, "i2") }]}>
              Les membres répondront présent depuis l&apos;accueil ; au lancement du match, le
              générateur reprend les présents.
            </Text>
          </CarteVerre>
        </View>
      </ScrollView>
    </Ecran>
  );
}

const s = StyleSheet.create({
  defile: { paddingBottom: 60 },
  contenu: { paddingHorizontal: 14 },
  // Les libellés de champ suivent ceux du produit (`Champ` de base.tsx) :
  // 13 en 600, capitales espacées. En 15 semi-gras, ils avaient le même poids
  // que la valeur saisie juste dessous — trois fois de suite.
  kicker: { fontSize: 13, fontWeight: "600", letterSpacing: 0.4, textTransform: "uppercase" },
  carte: { marginTop: 18, paddingTop: 18, paddingHorizontal: 20, paddingBottom: 20 },
  libelle: { marginBottom: 8 },
  suivant: { marginTop: 20 },
  relatif: { fontSize: 13, marginTop: 6 },
  erreur: { fontSize: 15, marginTop: 14 },
  note: { fontSize: 13, lineHeight: 18, marginTop: 14 },
});
