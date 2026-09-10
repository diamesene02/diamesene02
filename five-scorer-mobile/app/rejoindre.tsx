import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import Ecran from "../composants/Ecran";
import { BoutonPlein, BoutonVerre, Carte, Champ } from "../composants/base";
import { JETONS_NEUTRES } from "../lib/couleurs";
import { rejoindreClub, SessionExpiree } from "../lib/api";

/// « On m'a filé un code. »
///
/// Le seul écran qui manquait pour qu'un compte neuf serve à quelque chose.
/// Avant lui, quelqu'un qui installait l'app et s'inscrivait arrivait sur une
/// liste de clubs vide avec, pour tout geste possible, « Se déconnecter ».
///
/// Le champ accepte le LIEN entier autant que le code seul, et c'est le point
/// important : ce que le nouveau venu a sous le pouce est l'URL reçue sur
/// WhatsApp, pas douze caractères qu'il aurait recopiés. Le tri se fait côté
/// serveur pour que le site en profite aussi.
export default function Rejoindre() {
  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [deja, setDeja] = useState<string | null>(null);
  const t = JETONS_NEUTRES;

  const valider = async () => {
    // La garde qui compte sur un téléphone : deux appuis sur « Rejoindre »
    // partiraient en deux requêtes, et rien en base n'empêche aujourd'hui d'être
    // inscrit deux fois au même club (aucun index unique sur `member`). Le
    // second appui est donc refusé ici, avant le réseau.
    if (occupe) return;
    setErreur(null);
    setDeja(null);
    if (!code.trim()) return setErreur("Colle le lien ou le code reçu.");

    setOccupe(true);
    try {
      const res = await rejoindreClub(code.trim());
      if (res.dejaMembre) {
        // Ni une erreur ni une bienvenue : rouvrir un vieux lien est le geste
        // normal de quelqu'un qui ne sait plus s'il a déjà rejoint.
        setDeja(res.nom);
        return;
      }
      router.replace({ pathname: "/club/[id]", params: { id: res.clubId } });
    } catch (e) {
      if (e instanceof SessionExpiree) {
        router.replace("/connexion");
        return;
      }
      // `ErreurServeur` porte le message français du serveur — « Code
      // d'invitation invalide. » — fait pour être affiché tel quel.
      setErreur(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setOccupe(false);
    }
  };

  return (
    <Ecran t={t}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={s.contenu} keyboardShouldPersistTaps="handled">
          <Text style={[s.titre, { color: t.ink }]}>Rejoindre un club</Text>
          <Text style={[s.aide, { color: t.i2 }]}>
            On t&apos;a envoyé un lien d&apos;invitation ? Colle-le ici. Le code
            seul marche aussi.
          </Text>

          <Carte t={t} style={{ gap: 14 }}>
            <Champ
              t={t}
              libelle="Lien ou code"
              value={code}
              onChangeText={setCode}
              placeholder="https://…/join/abcd1234"
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              keyboardType="url"
              onSubmitEditing={valider}
              returnKeyType="go"
              editable={!occupe}
            />

            {erreur && <Text style={[s.erreur, { color: t.bad }]}>{erreur}</Text>}

            {deja && (
              <Text style={[s.aide, { color: t.i2 }]}>
                Tu es déjà du club «&nbsp;{deja}&nbsp;». Rien à faire : il
                t&apos;attend dans tes clubs.
              </Text>
            )}

            {occupe ? (
              <View style={s.attente}>
                <ActivityIndicator color={t.ink} />
              </View>
            ) : deja ? (
              <BoutonPlein t={t} titre="Voir mes clubs" onPress={() => router.replace("/clubs")} />
            ) : (
              <BoutonPlein t={t} titre="Rejoindre" onPress={valider} />
            )}
          </Carte>

          <BoutonVerre t={t} titre="Retour" onPress={() => router.back()} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Ecran>
  );
}

const s = StyleSheet.create({
  contenu: { padding: 14, paddingTop: 28, paddingBottom: 40, gap: 14 },
  titre: { fontSize: 28, fontWeight: "700", letterSpacing: -0.4 },
  aide: { fontSize: 15, lineHeight: 21 },
  erreur: { fontSize: 15 },
  attente: { height: 52, alignItems: "center", justifyContent: "center" },
});
