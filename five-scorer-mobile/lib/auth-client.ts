import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import { organizationClient } from "better-auth/client/plugins";
import * as SecureStore from "expo-secure-store";
import { API } from "./api";

/// Le client d'authentification de l'app.
///
/// Trois choses le distinguent du client web :
///
/// 1. Le cookie de session est rangé dans le TROUSSEAU du téléphone
///    (expo-secure-store), pas dans un cookie de navigateur. Le plugin le
///    découpe en morceaux de 1800 caractères : d'anciennes versions d'iOS
///    refusaient les valeurs au-delà de ~2 ko, et notre session porte un
///    cache (`cookieCache` côté serveur) qui la fait grossir.
///
/// 2. Le schéma `fivescorer` sert de destination au retour de connexion. En
///    Expo Go, expo-linking l'ignore silencieusement et rend `exp` à la
///    place — le même code marche donc en Expo Go et dans un build natif,
///    sans branche conditionnelle.
///
/// 3. Rien n'est envoyé automatiquement à NOS routes : React Native n'a pas
///    de bocal à cookies. C'est `appelAuthentifie()` de lib/api.ts qui rejoue
///    l'en-tête à la main.
export const authClient = createAuthClient({
  baseURL: API,
  plugins: [
    organizationClient(),
    expoClient({
      scheme: "fivescorer",
      storagePrefix: "fivescorer",
      storage: SecureStore,
    }),
  ],
});

export const { useSession, signIn, signUp, signOut } = authClient;
