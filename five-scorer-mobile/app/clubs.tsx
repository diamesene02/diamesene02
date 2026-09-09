import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import Ecran from "../composants/Ecran";
import { Avatar, BoutonVerre, Carte, Ecusson } from "../composants/base";
import { JETONS_NEUTRES, type Jetons } from "../lib/couleurs";
import { chargerMoi, SessionExpiree, type ClubDeMoi, type Moi } from "../lib/api";
import { signOut } from "../lib/auth-client";

/// Les clubs de l'utilisateur connecté.
///
/// C'est le premier écran qui prouve que la chaîne complète tient : le cookie
/// est bien rangé dans le trousseau, il est bien rejoué à la main sur nos
/// routes, et le serveur reconnaît la session.
export default function Clubs() {
  const [moi, setMoi] = useState<Moi | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(true);

  const charger = useCallback(async () => {
    setErreur(null);
    setOccupe(true);
    try {
      setMoi(await chargerMoi());
    } catch (e) {
      if (e instanceof SessionExpiree) {
        router.replace("/connexion");
        return;
      }
      setErreur(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setOccupe(false);
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  // Les couleurs du premier club habillent l'écran : c'est celui du lundi.
  const premier = moi?.clubs[0];
  const t: Jetons = premier?.theme.sombre ?? JETONS_NEUTRES;

  return (
    <Ecran
      t={t}
      chasubles={premier ? { a: premier.couleurA, b: premier.couleurB } : undefined}
    >
      <ScrollView
        contentContainerStyle={s.contenu}
        refreshControl={
          <RefreshControl refreshing={occupe && moi != null} onRefresh={charger} tintColor={t.i2} />
        }
      >
        {occupe && !moi && !erreur && (
          <View style={s.centre}>
            <ActivityIndicator color={t.ink} />
          </View>
        )}

        {erreur && (
          <Carte t={t} titre="Ça n'a pas marché">
            <Text style={[s.aide, { color: t.i2 }]}>{erreur}</Text>
            <View style={{ height: 12 }} />
            <BoutonVerre t={t} titre="Réessayer" onPress={charger} />
          </Carte>
        )}

        {moi && (
          <>
            <Text style={[s.salut, { color: t.ink }]}>Salut {moi.utilisateur.nom}</Text>
            <Text style={[s.aide, { color: t.i2 }]}>
              {moi.clubs.length === 0
                ? "Tu n'es dans aucun club pour l'instant."
                : moi.clubs.length > 1
                  ? "Tes clubs."
                  : "Ton club."}
            </Text>

            {moi.clubs.map((c) => (
              <CarteClub key={c.id} club={c} t={t} />
            ))}

            <BoutonVerre
              t={t}
              titre="Se déconnecter"
              onPress={async () => {
                await signOut();
                router.replace("/vitrine");
              }}
            />
          </>
        )}
      </ScrollView>
    </Ecran>
  );
}

function CarteClub({ club, t }: { club: ClubDeMoi; t: Jetons }) {
  const [ouvert, setOuvert] = useState(false);
  const roles: Record<string, string> = {
    owner: "Capitaine",
    admin: "Adjoint",
    member: "Joueur",
  };
  return (
    <Carte t={t}>
      <View style={s.tete}>
        <Ecusson couleur={club.couleurA} lettre={club.nom[0] ?? "F"} taille={44} />
        <View style={s.teteTexte}>
          <Text style={[s.nomClub, { color: t.ink }]} numberOfLines={1}>
            {club.nom}
          </Text>
          <Text style={[s.aide, { color: t.i2 }]}>
            {roles[club.role] ?? club.role}
            {club.monJoueur ? " · " + club.monJoueur.nom : " · pas encore de fiche joueur"}
          </Text>
        </View>
        {club.monJoueur && (
          <Avatar
            nom={club.monJoueur.nom}
            photo={club.monJoueur.photo}
            t={t}
            anneau={t.taR ?? t.ta}
            taille={38}
          />
        )}
      </View>

      <View style={s.chasubles}>
        <Pastille couleur={club.couleurA} nom={club.nomChasubleA} t={t} />
        <Text style={[s.contre, { color: t.i3 }]}>contre</Text>
        <Pastille couleur={club.couleurB} nom={club.nomChasubleB} t={t} />
      </View>

      <Pressable onPress={() => setOuvert((o) => !o)}>
        <Text style={[s.deplier, { color: t.i2 }]}>
          {ouvert ? "Masquer les réglages" : "Les réglages du club"}
        </Text>
      </Pressable>

      {ouvert && (
        <View style={{ paddingTop: 8 }}>
          <Reglage t={t} libelle="Format" valeur={club.reglages.format} />
          <Reglage t={t} libelle="Durée d'un match" valeur={club.reglages.dureeMatchMin + " min"} />
          <Reglage
            t={t}
            libelle="Barème"
            valeur={club.reglages.pointsVictoire + " / " + club.reglages.pointsNul + " / 0"}
          />
          <Reglage
            t={t}
            libelle="Une soirée tient à"
            valeur={club.reglages.minJoueurs + " joueurs"}
          />
          <Reglage
            t={t}
            libelle="Le terrain tient"
            valeur={
              club.reglages.capaciteSoiree > 0
                ? club.reglages.capaciteSoiree + " joueurs"
                : "sans limite"
            }
          />
          <Reglage t={t} libelle="Je peux scorer" valeur={club.peutScorer ? "oui" : "non"} />
        </View>
      )}
    </Carte>
  );
}

function Pastille({ couleur, nom, t }: { couleur: string; nom: string; t: Jetons }) {
  return (
    <View style={s.pastille}>
      <View style={[s.rond, { backgroundColor: couleur, borderColor: t.cb }]} />
      <Text style={[s.aide, { color: t.i2 }]} numberOfLines={1}>
        {nom}
      </Text>
    </View>
  );
}

function Reglage({ t, libelle, valeur }: { t: Jetons; libelle: string; valeur: string }) {
  return (
    <View style={[s.reglage, { borderTopColor: t.sep }]}>
      <Text style={[s.aide, { color: t.i2, flex: 1 }]}>{libelle}</Text>
      <Text style={{ color: t.ink, fontSize: 15, fontWeight: "600" }}>{valeur}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  contenu: { padding: 14, paddingTop: 20, paddingBottom: 40, gap: 14 },
  centre: { paddingTop: 120, alignItems: "center" },
  salut: { fontSize: 28, fontWeight: "700", letterSpacing: -0.4 },
  aide: { fontSize: 15 },
  tete: { flexDirection: "row", alignItems: "center", gap: 12 },
  teteTexte: { flex: 1, gap: 2 },
  nomClub: { fontSize: 19, fontWeight: "700" },
  chasubles: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 14 },
  pastille: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  rond: { width: 22, height: 22, borderRadius: 11, borderWidth: 1 },
  contre: { fontSize: 13 },
  deplier: { fontSize: 15, paddingTop: 14 },
  reglage: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 40,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
