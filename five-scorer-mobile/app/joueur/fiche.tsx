import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import Ecran from "../../composants/Ecran";
import { BoutonPlein, BoutonRond, BoutonVerre, Carte } from "../../composants/base";
import { JETONS_NEUTRES, type Jetons } from "../../lib/couleurs";
import { choisirPhoto } from "../../lib/photo/choisir";
import {
  ajouterJoueur,
  chargerFicheJoueur,
  chargerMoi,
  modifierJoueur,
  SessionExpiree,
  type ClubDeMoi,
} from "../../lib/api";

/// Ajouter ou modifier un joueur du vestiaire.
///
/// Le même écran pour les deux : mêmes champs, mêmes placeholders, seul change
/// ce qu'on trouve dedans en arrivant et le mot sur le bouton. C'est ce que
/// fait le site, et c'est ce qu'il faut — un formulaire d'édition qui diffère
/// de celui d'ajout, ce sont deux dessins à tenir d'accord.
///
/// Réservé à qui gère le club. Le geste du bord du terrain — « un pote est
/// venu ce soir » — n'est PAS celui-ci : c'est l'invité de la compo, qui ne
/// demande qu'un prénom. Ici, c'est le joueur qui revient : il aura une fiche,
/// une photo, un niveau, et il comptera au classement.
export default function FicheJoueur() {
  const { clubId, id } = useLocalSearchParams<{ clubId?: string; id?: string }>();
  const edition = typeof id === "string" && id.length > 0;

  const [club, setClub] = useState<ClubDeMoi | null>(null);
  const [nom, setNom] = useState("");
  const [surnom, setSurnom] = useState("");
  const [niveau, setNiveau] = useState(3);
  const [gardien, setGardien] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [archive, setArchive] = useState(false);
  const [occupe, setOccupe] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [photoEnCours, setPhotoEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [avertissement, setAvertissement] = useState<string | null>(null);

  const t: Jetons = club?.theme.sombre ?? JETONS_NEUTRES;

  const charger = useCallback(async () => {
    if (!clubId) return;
    try {
      const moi = await chargerMoi();
      setClub(moi.clubs.find((c) => c.id === clubId) ?? null);
      if (edition && id) {
        const f = await chargerFicheJoueur(clubId, id);
        setNom(f.joueur.nom);
        setSurnom(f.joueur.surnom ?? "");
        setNiveau(f.joueur.niveau);
        setGardien(f.joueur.estGardien);
        setPhoto(f.joueur.photo);
      }
    } catch (e) {
      if (e instanceof SessionExpiree) return router.replace("/connexion");
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setOccupe(false);
    }
  }, [clubId, edition, id]);

  useEffect(() => {
    void charger();
  }, [charger]);

  async function prendrePhoto(source: "photothèque" | "appareil") {
    setErreur(null);
    setPhotoEnCours(true);
    try {
      const url = await choisirPhoto(source);
      if (url) setPhoto(url);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setPhotoEnCours(false);
    }
  }

  async function enregistrer() {
    if (!clubId) return;
    const propre = nom.trim();
    if (propre.length < 1) return setErreur("Il faut un nom.");
    setEnvoi(true);
    setErreur(null);
    setAvertissement(null);
    try {
      // On n'envoie QUE ce que ce formulaire touche. `abonne` et `isGuest`
      // passent par la même route ; renvoyer la fiche entière écraserait
      // « Vient tous les lundis », qui est une décision personnelle.
      const fiche = {
        name: propre,
        nickname: surnom.trim() || null,
        skill: niveau,
        isGk: gardien,
        photo,
      };
      const r =
        edition && id
          ? await modifierJoueur(clubId, id, fiche)
          : await ajouterJoueur(clubId, fiche);

      // Le serveur répond 200 même quand il a REFUSÉ la photo : il enregistre
      // la fiche et la met à `null`. Sans lire ce champ, on annoncerait
      // « enregistré » sur une fiche qui revient sans visage.
      if (r.avertissement) {
        setAvertissement(r.avertissement);
        setPhoto(null);
        setEnvoi(false);
        return;
      }
      router.back();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
      setEnvoi(false);
    }
  }

  function archiver() {
    if (!clubId || !id) return;
    // La conséquence, en une phrase, avant le bouton qui la déclenche — et
    // surtout pas le mot « supprimer » : rien dans l'app ne supprime un
    // joueur, et son histoire reste au club.
    Alert.alert(
      `Archiver ${nom.trim() || "ce joueur"} ?`,
      "Il sort de la liste de ceux qui viennent lundi. Ses matchs, ses buts et ses votes restent au club, et tu peux le réactiver quand tu veux.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Archiver",
          style: "destructive",
          onPress: () => {
            setArchive(true);
            void modifierJoueur(clubId, id, { archive: true })
              .then(() => router.back())
              .catch((e: Error) => {
                setArchive(false);
                setErreur(e.message);
              });
          },
        },
      ],
    );
  }

  const couleurA = club?.couleurA ?? "#ffffff";
  const couleurB = club?.couleurB ?? "#111111";
  const initiales = (nom.trim() || "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((m) => m[0] ?? "")
    .join("")
    .toUpperCase();

  return (
    <Ecran t={t} chasubles={{ a: couleurA, b: couleurB }}>
      <ScrollView contentContainerStyle={s.contenu} keyboardShouldPersistTaps="handled">
        <View style={s.barre}>
          <BoutonRond t={t} symbole="‹" etiquette="Retour" onPress={() => router.back()} />
        </View>

        <Text style={[s.titre, { color: t.ink }]}>
          {edition ? "Modifier la fiche" : "Nouveau joueur"}
        </Text>

        {occupe && (
          <View style={s.centre}>
            <ActivityIndicator color={t.ink} />
          </View>
        )}

        {!occupe && (
          <>
            <Carte t={t} style={{ marginTop: 18 }}>
              {/* La photo d'abord : c'est ce qui distingue quinze prénoms sur
                  une feuille de match, et c'est le seul champ qu'on oublie si
                  on le met en bas. */}
              <View style={s.photoLigne}>
                <Pressable
                  onPress={() => void prendrePhoto("photothèque")}
                  disabled={photoEnCours || envoi}
                  accessibilityLabel={photo ? "Changer la photo" : "Ajouter une photo"}
                  style={[s.apercu, { borderColor: t.cb, backgroundColor: t.seg }]}
                >
                  {photo ? (
                    <Image source={{ uri: photo }} style={s.apercuImage} />
                  ) : (
                    <Text style={[s.apercuVide, { color: t.i3 }]}>
                      {nom.trim() ? initiales : "+"}
                    </Text>
                  )}
                </Pressable>
                <View style={s.photoActions}>
                  <BoutonVerre
                    t={t}
                    titre={photoEnCours ? "…" : photo ? "Changer" : "Photothèque"}
                    disabled={photoEnCours || envoi}
                    onPress={() => void prendrePhoto("photothèque")}
                  />
                  <BoutonVerre
                    t={t}
                    titre="Appareil photo"
                    disabled={photoEnCours || envoi}
                    onPress={() => void prendrePhoto("appareil")}
                  />
                  {photo && (
                    <BoutonVerre
                      t={t}
                      titre="Retirer"
                      disabled={envoi}
                      onPress={() => setPhoto(null)}
                    />
                  )}
                </View>
              </View>
            </Carte>

            <Carte t={t} style={{ marginTop: 14 }}>
              <Champ t={t} libelle="NOM">
                <TextInput
                  value={nom}
                  onChangeText={setNom}
                  placeholder="Kylian"
                  placeholderTextColor={t.i3}
                  autoCapitalize="words"
                  style={[s.saisie, { color: t.ink, backgroundColor: t.seg }]}
                />
              </Champ>
              <View style={{ height: 14 }} />
              <Champ t={t} libelle="SURNOM">
                <TextInput
                  value={surnom}
                  onChangeText={setSurnom}
                  placeholder="La Flèche"
                  placeholderTextColor={t.i3}
                  autoCapitalize="words"
                  style={[s.saisie, { color: t.ink, backgroundColor: t.seg }]}
                />
              </Champ>
              <View style={{ height: 14 }} />
              <Champ t={t} libelle="NIVEAU">
                {/* Cinq cases égales portant le chiffre, comme le site — pas
                    des étoiles : les étoiles se LISENT bien (l'effectif en
                    met), elles se tapent mal. */}
                <View style={[s.segment, { backgroundColor: t.seg }]}>
                  {[1, 2, 3, 4, 5].map((n) => {
                    const actif = n === niveau;
                    return (
                      <Pressable
                        key={n}
                        onPress={() => setNiveau(n)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: actif }}
                        style={[s.case_, actif && { backgroundColor: t.gl ?? t.cdSolid }]}
                      >
                        <Text
                          style={[s.caseTexte, { color: actif ? t.ink : t.i2 }]}
                        >
                          {n}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Champ>
            </Carte>

            <Carte t={t} style={{ marginTop: 14 }}>
              <Pressable
                onPress={() => setGardien((g) => !g)}
                accessibilityRole="button"
                accessibilityState={{ selected: gardien }}
                style={({ pressed }) => [s.rangee, pressed && { opacity: 0.6 }]}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[s.libelle, { color: t.ink }]}>Gardien</Text>
                  <Text style={[s.aide, { color: t.i2 }]}>
                    Le générateur d&apos;équipes les sépare en premier.
                  </Text>
                </View>
                <Text style={[s.valeur, { color: t.i2 }]}>{gardien ? "Oui" : "Non"}</Text>
              </Pressable>
            </Carte>

            {avertissement && (
              <Text style={[s.avertissement, { color: t.or ?? "#ffd60a" }]}>
                {avertissement}
              </Text>
            )}
            {erreur && <Text style={[s.erreur, { color: t.bad }]}>{erreur}</Text>}

            <View style={{ height: 18 }} />
            <BoutonPlein
              t={t}
              titre={envoi ? "…" : edition ? "Enregistrer" : "Ajouter au vestiaire"}
              onPress={enregistrer}
              disabled={envoi || photoEnCours}
            />

            {edition && (
              <View style={{ paddingTop: 22 }}>
                <BoutonVerre
                  t={t}
                  titre={archive ? "…" : "Archiver ce joueur"}
                  disabled={envoi || archive}
                  onPress={archiver}
                />
              </View>
            )}
          </>
        )}
      </ScrollView>
    </Ecran>
  );
}

function Champ({
  t,
  libelle,
  children,
}: {
  t: Jetons;
  libelle: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={[s.champLibelle, { color: t.i2 }]}>{libelle}</Text>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  contenu: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 60 },
  barre: { flexDirection: "row", paddingBottom: 12 },
  titre: { fontSize: 34, fontWeight: "700", letterSpacing: -0.5, paddingHorizontal: 4 },
  centre: { paddingTop: 60, alignItems: "center" },

  photoLigne: { flexDirection: "row", alignItems: "center", gap: 14 },
  // 72 px et un trait POINTILLÉ tant qu'il n'y a rien : le site fait pareil,
  // et le pointillé dit « à remplir » sans un mot.
  apercu: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    borderStyle: "dashed",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  apercuImage: { width: "100%", height: "100%" },
  apercuVide: { fontSize: 24, fontWeight: "700" },
  photoActions: { flex: 1, minWidth: 0, gap: 8 },

  champLibelle: { fontSize: 13, fontWeight: "600", letterSpacing: 0.4 },
  saisie: {
    minHeight: 52,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 17,
  },

  // Cinq cases strictement égales, 44 px de haut, rayon 22 — le « segment
  // plein-large » du site.
  segment: {
    flexDirection: "row",
    height: 44,
    padding: 3,
    borderRadius: 22,
  },
  case_: { flex: 1, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  caseTexte: { fontSize: 17, fontWeight: "600" },

  rangee: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 54 },
  libelle: { fontSize: 17, fontWeight: "600" },
  aide: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  valeur: { fontSize: 17 },

  avertissement: { fontSize: 15, textAlign: "center", paddingTop: 16, lineHeight: 21 },
  erreur: { fontSize: 15, textAlign: "center", paddingTop: 16 },
});
