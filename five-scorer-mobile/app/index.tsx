import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Redirect } from "expo-router";
import Ecran from "../composants/Ecran";
import { useSession } from "../lib/auth-client";
import { JETONS_NEUTRES } from "../lib/couleurs";

/// L'aiguillage. Une session ? les clubs. Sinon, la vitrine publique, qui
/// donne à voir quelque chose avant même d'avoir un compte.
export default function Accueil() {
  const { data, isPending } = useSession();

  // Un journal discret : au premier lancement dans Expo Go, savoir si la
  // session a été retrouvée dans le trousseau évite une demi-heure de doute.
  useEffect(() => {
    if (!isPending) {
      console.log(
        "[five-scorer] session :",
        data?.user ? data.user.email : "aucune",
      );
    }
  }, [isPending, data]);

  if (isPending) {
    return (
      <Ecran>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
          <ActivityIndicator color={JETONS_NEUTRES.ink} />
          <Text style={{ color: JETONS_NEUTRES.i2, fontSize: 15 }}>Un instant…</Text>
        </View>
      </Ecran>
    );
  }

  return <Redirect href={data?.user ? "/clubs" : "/vitrine"} />;
}
