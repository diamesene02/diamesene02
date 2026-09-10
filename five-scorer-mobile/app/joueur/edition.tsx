import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import Ecran from "../../composants/Ecran";
import { Avatar, BoutonPlein, BoutonRond, Carte, Champ, Segment } from "../../composants/base";
import { JETONS_NEUTRES, type Jetons } from "../../lib/couleurs";
import { newId } from "../../lib/noyau/ids";
import {
  chargerEcranEffectif,
  chargerMoi,
  creerJoueur,
  modifierJoueur,
  SessionExpiree,
  type ClubDeMoi,
  type EcranEffectif,
  type FicheAEcrire,
} from "../../lib/api";

/// Ajouter un joueur au vestiaire, ou corriger sa fiche.
///
/// **Un seul écran pour les deux**, comme sur le site : les champs sont les
/// mêmes, et deux écrans auraient fini par diverger sur le plafond d'un nom ou
/// le libellé d'une étoile. Sans `joueur`, c'est un ajout ; avec, une
/// modification.
///
/// Ce qui distingue ce formulaire de celui du site, et pourquoi :
///
/// - **L'identifiant est fabriqué au chargement**, pas à l'envoi. Le bouton
///   peut donc partir deux fois — le pouce impatient, le réseau du gymnase —
///   sans inscrire deux Mamadou. C'est le procédé déjà retenu pour un match.
/// - **On n'envoie que ce qui a changé.** Une fiche modifiée sur un autre
///   téléphone entre-temps ne perd pas sa photo parce qu'on a corrigé un
///   surnom ici.
/// - **La photo n'y est pas encore** (voir la note au bas du fichier).
export default function EditionJoueur() {
  const { clubId, joueur: joueurId } = useLocalSearchParams<{
    clubId?: string;
    joueur?: string;
  }>();
  const modification = Boolean(joueurId);

  const [club, setClub] = useState<ClubDeMoi | null>(null);
  const [depart, setDepart] = useState<EcranEffectif["joueurs"][number] | null>(null);
  const [peutGerer, setPeutGerer] = useState(true);

  const [nom, setNom] = useState("");
  const [surnom, setSurnom] = useState("");
  const [niveau, setNiveau] = useState(3);
  const [gardien, setGardien] = useState(false);
  const [invite, setInvite] = useState(false);

  // Fabriqué une fois, gardé pour toute la vie de l'écran : c'est lui qui rend
  // le double envoi inoffensif.
  const [idNeuf] = useState(() => newId());
  const [occupe, setOccupe] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const t: Jetons = club?.theme.sombre ?? JETONS_NEUTRES;

  const charger = useCallback(async () => {
    if (!clubId) return;
    setErreur(null);
    try {
      // L'effectif plutôt que la fiche : il porte `peutGerer` et tous les
      // champs éditables d'un coup. La fiche du joueur, elle, arrive assemblée
      // pour l'affichage (« Niveau 3 · gardien ») — il faudrait la découper
      // pour la remettre dans des champs, et c'est exactement le genre de
      // découpage qui finit par diverger.
      const [moi, e] = await Promise.all([chargerMoi(), chargerEcranEffectif(clubId)]);
      setClub(moi.clubs.find((c) => c.id === clubId) ?? null);
      setPeutGerer(e.peutGerer);
      if (joueurId) {
        const j = e.joueurs.find((x) => x.id === joueurId) ?? null;
        setDepart(j);
        if (j) {
          setNom(j.nom);
          setSurnom(j.surnom ?? "");
          setNiveau(j.niveau);
          setGardien(j.gardien);
          setInvite(j.invite);
        } else {
          setErreur("Ce joueur n'est plus au vestiaire.");
        }
      }
    } catch (e) {
      if (e instanceof SessionExpiree) return router.replace("/connexion");
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setOccupe(false);
    }
  }, [clubId, joueurId]);

  useEffect(() => {
    void charger();
  }, [charger]);

  /// Ce qui a bougé depuis l'ouverture, et rien d'autre.
  function difference(): FicheAEcrire {
    const d: FicheAEcrire = {};
    const nomPropre = nom.trim();
    const surnomPropre = surnom.trim();
    if (!depart) {
      return { nom: nomPropre, surnom: surnomPropre || null, niveau, gardien, invite };
    }
    if (nomPropre !== depart.nom) d.nom = nomPropre;
    if ((surnomPropre || null) !== (depart.surnom ?? null)) d.surnom = surnomPropre || null;
    if (niveau !== depart.niveau) d.niveau = niveau;
    if (gardien !== depart.gardien) d.gardien = gardien;
    if (invite !== depart.invite) d.invite = invite;
    return d;
  }

  async function enregistrer() {
    if (!clubId) return;
    const nomPropre = nom.trim();
    if (!nomPropre) {
      setErreur("Il faut un nom.");
      return;
    }
    const diff = difference();
    // Rien n'a changé : on repart sans écrire. Le serveur refuserait un corps
    // vide (400) et l'écran afficherait une erreur pour un geste qui n'en est
    // pas un.
    if (modification && Object.keys(diff).length === 0) {
      router.back();
      return;
    }
    setEnvoi(true);
    setErreur(null);
    try {
      if (modification && joueurId) {
        await modifierJoueur(clubId, joueurId, diff);
      } else {
        await creerJoueur(clubId, idNeuf, diff);
      }
      router.back();
    } catch (e) {
      if (e instanceof SessionExpiree) return router.replace("/connexion");
      setErreur(e instanceof Error ? e.message : String(e));
      setEnvoi(false);
    }
  }

  function demanderArchivage() {
    if (!clubId || !joueurId || !depart) return;
    const revient = depart.archive;
    Alert.alert(
      revient ? `Faire revenir ${depart.nom} ?` : `Archiver ${depart.nom} ?`,
      revient
        ? "Il réapparaîtra dans le vestiaire et dans les compositions."
        : "Il sort du vestiaire et des compositions. Ses matchs, ses buts et ses trophées restent : rien n'est effacé, et on peut le faire revenir.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: revient ? "Le faire revenir" : "Archiver",
          style: revient ? "default" : "destructive",
          onPress: async () => {
            setEnvoi(true);
            try {
              await modifierJoueur(clubId, joueurId, { archive: !revient });
              router.back();
            } catch (e) {
              if (e instanceof SessionExpiree) return router.replace("/connexion");
              setErreur(e instanceof Error ? e.message : String(e));
              setEnvoi(false);
            }
          },
        },
      ],
    );
  }

  const couleurA = club?.couleurA ?? "#ffffff";
  const couleurB = club?.couleurB ?? "#111111";

  return (
    <Ecran t={t} chasubles={{ a: couleurA, b: couleurB }}>
      <ScrollView contentContainerStyle={s.contenu} keyboardShouldPersistTaps="handled">
        <View style={s.barre}>
          <BoutonRond t={t} symbole="‹" etiquette="Retour" onPress={() => router.back()} />
        </View>

        <Text style={[s.titre, { color: t.ink }]}>
          {modification ? "Modifier la fiche" : "Ajouter un joueur"}
        </Text>

        {occupe && (
          <View style={s.centre}>
            <ActivityIndicator color={t.ink} />
          </View>
        )}

        {!occupe && !peutGerer && (
          <Text style={[s.aide, { color: t.i2 }]}>
            Seuls les gérants du club peuvent toucher au vestiaire.
          </Text>
        )}

        {!occupe && peutGerer && (
          <>
            <Carte t={t} style={{ marginTop: 18, gap: 4 }}>
              {/* L'avatar montre à qui on est en train de toucher. Il se peint
                  avec le nom EN COURS de saisie : la vignette d'un joueur neuf
                  prend ses initiales pendant qu'on tape. */}
              <View style={s.tete}>
                <Avatar nom={nom || "?"} photo={depart?.photo ?? null} t={t} taille={64} />
              </View>

              <Champ
                t={t}
                libelle="NOM"
                value={nom}
                onChangeText={setNom}
                placeholder="Kylian"
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="next"
                maxLength={60}
              />
              <Champ
                t={t}
                libelle="SURNOM (FACULTATIF)"
                value={surnom}
                onChangeText={setSurnom}
                placeholder="La Flèche"
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={40}
              />

              <Text style={[s.libelle, { color: t.i2 }]}>NIVEAU</Text>
              <Segment
                t={t}
                valeur={String(niveau)}
                choix={[1, 2, 3, 4, 5].map((n) => ({ valeur: String(n), libelle: String(n) }))}
                onChange={(v) => setNiveau(Number(v))}
              />
              <Text style={[s.note, { color: t.i3 }]}>
                Sert à l'équilibrage des équipes, et à rien d'autre.
              </Text>

              <Bascule
                t={t}
                titre="Gardien"
                detail="Le générateur d'équipes en met un de chaque côté en premier."
                value={gardien}
                onValueChange={setGardien}
              />
              <Bascule
                t={t}
                titre="Invité"
                detail="De passage : il joue, il marque, mais on ne l'attend pas tous les lundis."
                value={invite}
                onValueChange={setInvite}
                derniere
              />
            </Carte>

            {erreur && <Text style={[s.erreur, { color: "#ff453a" }]}>{erreur}</Text>}

            <View style={{ marginTop: 18 }}>
              <BoutonPlein
                t={t}
                titre={envoi ? "…" : modification ? "Enregistrer" : "Ajouter au vestiaire"}
                onPress={enregistrer}
                disabled={envoi || !nom.trim()}
              />
            </View>

            {modification && depart && (
              <Pressable onPress={demanderArchivage} style={s.archiver} disabled={envoi}>
                <Text style={[s.archiverTexte, { color: depart.archive ? t.i2 : "#ff453a" }]}>
                  {depart.archive ? `Faire revenir ${depart.nom}` : `Archiver ${depart.nom}`}
                </Text>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>
    </Ecran>
  );
}

/// Une ligne à interrupteur, avec sa phrase d'explication.
///
/// La phrase n'est pas décorative : « invité » et « gardien » changent le
/// comportement du générateur d'équipes et des présences, et personne ne peut
/// le deviner d'un mot.
function Bascule({
  t,
  titre,
  detail,
  value,
  onValueChange,
  derniere,
}: {
  t: Jetons;
  titre: string;
  detail: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  derniere?: boolean;
}) {
  return (
    <View
      style={[
        s.bascule,
        !derniere && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.sep },
      ]}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text style={[s.basculeTitre, { color: t.ink }]}>{titre}</Text>
        <Text style={[s.note, { color: t.i3 }]}>{detail}</Text>
      </View>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

// La photo manque, et c'est dit plutôt que caché : le site sait la prendre et
// la réduire à 256 px avec un canvas, ce que React Native n'a pas. Le chemin
// est connu — `expo-image-picker` puis `expo-image-manipulator`, tous deux
// modules du SDK Expo, donc utilisables dans Expo Go — mais c'est un
// incrément à part entière (permissions, compression, plafond de 200 ko côté
// serveur), et un demi-portage aurait laissé un bouton qui échoue au gymnase.
// En attendant, une photo posée depuis le site s'affiche ici et ne se perd
// pas : l'envoi est partiel, la fiche modifiée n'écrase que ce qu'on touche.

const s = StyleSheet.create({
  contenu: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 60 },
  barre: { flexDirection: "row", paddingBottom: 12 },
  titre: { fontSize: 34, fontWeight: "700", letterSpacing: -0.5, paddingHorizontal: 4 },
  centre: { paddingTop: 60, alignItems: "center" },
  aide: { fontSize: 15, paddingTop: 24, paddingHorizontal: 4 },
  erreur: { fontSize: 15, textAlign: "center", marginTop: 16 },

  tete: { alignItems: "center", paddingBottom: 10 },
  libelle: { fontSize: 12, fontWeight: "700", letterSpacing: 0.6, paddingTop: 12, paddingBottom: 8 },
  note: { fontSize: 12, lineHeight: 16 },
  bascule: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    marginTop: 4,
  },
  basculeTitre: { fontSize: 17, fontWeight: "600" },

  archiver: { paddingVertical: 18, alignItems: "center" },
  archiverTexte: { fontSize: 16, fontWeight: "600" },
});
