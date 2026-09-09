import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import Ecran from "../composants/Ecran";
import { BoutonPlein, Carte, Champ } from "../composants/base";
import { JETONS_NEUTRES } from "../lib/couleurs";
import { signIn, signUp } from "../lib/auth-client";

/// Connexion et inscription, sur le même écran.
///
/// Les deux appels sont exactement ceux du web (`signIn.email`,
/// `signUp.email`) : c'est le même Better Auth, la même base, les mêmes
/// comptes. Un compte créé ici ouvre la porte au site, et l'inverse.
export default function Connexion() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const [inscription, setInscription] = useState(mode === "inscription");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const t = JETONS_NEUTRES;

  const valider = async () => {
    setErreur(null);
    if (!email.trim() || !motDePasse) {
      return setErreur("Il manque l'adresse ou le mot de passe.");
    }
    if (inscription && !nom.trim()) {
      return setErreur("Il manque ton nom.");
    }
    if (inscription && motDePasse.length < 8) {
      return setErreur("Le mot de passe fait au moins 8 caractères.");
    }
    setOccupe(true);
    try {
      const res = inscription
        ? await signUp.email({
            email: email.trim(),
            password: motDePasse,
            name: nom.trim(),
          })
        : await signIn.email({ email: email.trim(), password: motDePasse });

      if (res.error) {
        setErreur(messageLisible(res.error.code, res.error.message));
        return;
      }
      router.replace("/clubs");
    } catch (e) {
      // Une erreur JETÉE, ce n'est pas un refus du serveur : c'est le réseau.
      // Le dire évite de chercher un mot de passe qui est bon.
      setErreur(
        "Impossible de joindre le serveur. Vérifie la connexion — " +
          (e instanceof Error ? e.message : String(e)),
      );
    } finally {
      setOccupe(false);
    }
  };

  return (
    <Ecran>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={s.contenu} keyboardShouldPersistTaps="handled">
          <Text style={[s.titre, { color: t.ink }]}>
            {inscription ? "Créer un compte" : "Se connecter"}
          </Text>

          <Carte t={t} style={{ gap: 14 }}>
            {inscription && (
              <Champ
                t={t}
                libelle="Nom"
                value={nom}
                onChangeText={setNom}
                placeholder="Ton prénom"
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
              />
            )}
            <Champ
              t={t}
              libelle="Adresse e-mail"
              value={email}
              onChangeText={setEmail}
              placeholder="toi@exemple.fr"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
            />
            <Champ
              t={t}
              libelle="Mot de passe"
              value={motDePasse}
              onChangeText={setMotDePasse}
              placeholder={inscription ? "8 caractères minimum" : "••••••••"}
              secureTextEntry
              autoCapitalize="none"
              autoComplete={inscription ? "new-password" : "current-password"}
              textContentType={inscription ? "newPassword" : "password"}
              onSubmitEditing={valider}
              returnKeyType="go"
            />

            {erreur && <Text style={[s.erreur, { color: t.bad }]}>{erreur}</Text>}

            {occupe ? (
              <View style={s.attente}>
                <ActivityIndicator color={t.ink} />
              </View>
            ) : (
              <BoutonPlein
                t={t}
                titre={inscription ? "Créer mon compte" : "Se connecter"}
                onPress={valider}
              />
            )}
          </Carte>

          <Pressable
            onPress={() => {
              setInscription((v) => !v);
              setErreur(null);
            }}
          >
            <Text style={[s.bascule, { color: t.i2 }]}>
              {inscription
                ? "J'ai déjà un compte — se connecter"
                : "Pas encore de compte — en créer un"}
            </Text>
          </Pressable>

          <Pressable onPress={() => router.replace("/vitrine")}>
            <Text style={[s.bascule, { color: t.i3 }]}>Voir le club sans compte</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Ecran>
  );
}

/// Better Auth rend des codes ; l'utilisateur lit du français.
///
/// INVALID_ORIGIN mérite son propre message : c'est l'erreur qu'on rencontre
/// en développement quand le serveur ne connaît pas encore l'origine d'Expo,
/// et le message d'origine n'aide personne à la corriger.
function messageLisible(code: string | undefined, defaut: string | undefined): string {
  switch (code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "Adresse ou mot de passe incorrect.";
    case "USER_ALREADY_EXISTS":
      return "Un compte existe déjà avec cette adresse.";
    case "PASSWORD_TOO_SHORT":
      return "Le mot de passe fait au moins 8 caractères.";
    case "INVALID_ORIGIN":
      return "Le serveur refuse l'origine de l'app. En développement, ajoute exp:// et exps:// aux origines de confiance.";
    default:
      return defaut ?? "Ça n'a pas marché.";
  }
}

const s = StyleSheet.create({
  contenu: { padding: 18, paddingTop: 60, gap: 18 },
  titre: { fontSize: 30, fontWeight: "700", letterSpacing: -0.5, textAlign: "center" },
  erreur: { fontSize: 15, textAlign: "center" },
  attente: { height: 52, alignItems: "center", justifyContent: "center" },
  bascule: { fontSize: 15, textAlign: "center" },
});
