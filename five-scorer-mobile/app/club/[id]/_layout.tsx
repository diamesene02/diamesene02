import { useCallback } from "react";
import { Tabs, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { chargerMoi } from "../../../lib/api";
import { FournisseurClub, memoriserMoi } from "../../../composants/ClubCourant";

/// Le cadre des écrans du club.
///
/// Plus de barre d'onglets en bas : comme sur le site (app/c/[slug]/layout.tsx,
/// « le menu en verre porte toute la navigation »), on passe d'un écran à
/// l'autre par la pilule du club, en haut à droite de chaque écran
/// (composants/EnTeteClub.tsx). La feuille « Créer » du « + » central vit
/// maintenant dans composants/FeuilleCreer.tsx, ouverte depuis l'accueil.
///
/// Les écrans restent déclarés dans un `Tabs`, barre masquée, plutôt que dans
/// une pile : un écran visité reste monté, on y revient sans le recharger ni
/// perdre où l'on avait défilé — et le menu y saute sans empiler de doublon.
/// `backBehavior="history"` : le retour ramène à l'écran d'où l'on venait,
/// comme le bouton retour du navigateur sur le site, et pas toujours à
/// l'accueil.
export default function DispositionClub() {
  const { id } = useLocalSearchParams<{ id: string }>();

  // Le club de la route peut ne plus être un club de l'utilisateur.
  //
  // expo-router garde sa pile de navigation entre deux lancements : un club
  // quitté — ou recréé sous un autre identifiant par la migration — y reste, et
  // l'app rouvre l'onglet d'un club auquel elle n'a plus accès. TOUS les écrans
  // tombent alors en 404, y compris ceux qui affichent encore les données du
  // chargement précédent : « Le serveur a répondu 404 » en travers d'un
  // calendrier qui s'affiche quand même.
  //
  // Vu en production le 13 septembre 2026, et resté plusieurs jours parce que
  // le message accusait la session : l'utilisateur s'est déconnecté et
  // reconnecté plusieurs fois sans que rien ne change — la pile, elle, ne se
  // vide pas à la déconnexion.
  //
  // Ici et pas dans les quinze écrans : ce layout les enveloppe tous.
  // À CHAQUE retour sur l'écran, pas seulement au montage.
  //
  // La première version utilisait `useEffect` : elle sortait bien du club au
  // premier affichage, mais l'écran de l'ancien club RESTAIT dans la pile,
  // déjà monté. Revenir dessus (un « ‹ » depuis une fiche de soirée) ne
  // remontait rien, donc ne relançait rien — et le 404 réapparaissait.
  // Constaté sur un enregistrement d'écran : corrigé à 09 s, revenu à 23 s.
  //
  // La réponse est gardée au passage (`memoriserMoi`) : c'est elle qui donne
  // à la pilule le nom de l'utilisateur et le nombre de ses clubs, et aux
  // écrans leurs couleurs dès la première image.
  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      let vivant = true;
      void (async () => {
        try {
          const moi = await chargerMoi();
          if (!vivant) return;
          memoriserMoi(moi);
          if (!moi.clubs.some((c) => c.id === id)) {
            // Vers la liste : elle sait dire « aucun club » et proposer d'en
            // rejoindre un. On ne laisse personne dans un club fantôme.
            router.replace("/clubs");
          }
        } catch {
          // Hors ligne, session finie, serveur muet : on NE SORT PAS quelqu'un de
          // son club parce que le réseau a hoqueté. Les écrans ont déjà leurs
          // propres messages pour ces cas ; ici, on ne fait rien.
        }
      })();
      return () => {
        vivant = false;
      };
    }, [id]),
  );

  return (
    <FournisseurClub value={id}>
      <Tabs
        tabBar={() => null}
        backBehavior="history"
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: "transparent" } }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="matchs" />
        <Tabs.Screen name="soirees" />
        <Tabs.Screen name="saison" />
        <Tabs.Screen name="stats" />
        <Tabs.Screen name="effectif" />
        <Tabs.Screen name="reglages" />
      </Tabs>
    </FournisseurClub>
  );
}
