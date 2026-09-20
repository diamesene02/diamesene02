import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar, BoutonPlein, BoutonVerre, CarteVerre, EcussonChasuble, Saisie } from "../base";
import Feuille from "../Feuille";
import { IconeJeu } from "../Icones";
import { jeton, type Jetons } from "../../lib/couleurs";
import { alertesCompo, type Camp, type Statut } from "./logique";
import Pelouse, { type JoueurPelouse } from "./Pelouse";
import type { CompoSoiree } from "./useCompoSoiree";

/// L'ordre du « hors compo » : ceux qui viennent d'abord, les absents à la
/// fin — c'est dans cet ordre qu'on les fait entrer (CompoSoiree.tsx du site).
function rangPresence(p: { statut: Statut | null; enAttente: boolean } | undefined): number {
  if (p?.statut === "IN") return p.enAttente ? 1 : 0;
  if (p?.statut === "MAYBE") return 2;
  if (p?.statut === "OUT") return 4;
  return 3;
}

function libellePresence(p: { statut: Statut | null; enAttente: boolean } | undefined): string {
  if (p?.statut === "IN") return p.enAttente ? "en attente" : "présent";
  if (p?.statut === "MAYBE") return "peut-être";
  if (p?.statut === "OUT") return "absent";
  return "sans réponse";
}

/// La carte « Composition » de la soirée — celle du site (CompoSoiree) : la
/// pelouse, les deux équipes d'un coup d'œil, le hors compo en jetons.
///
/// Le bouton plein change avec l'état : « Enregistrer la compo » dès qu'on a
/// touché quelque chose, sinon la suite logique que l'écran lui donne — le
/// coup d'envoi le jour même, l'envoi sur le groupe les jours d'avant.
export default function CarteCompo({
  t,
  compo,
  couleurA,
  couleurB,
  modifiable,
  suite,
  onCompoPrecedente,
}: {
  t: Jetons;
  compo: CompoSoiree;
  couleurA: string;
  couleurB: string;
  modifiable: boolean;
  /// Le bouton plein quand rien n'attend d'être enregistré. `null` : pas
  /// de suite à proposer (un match est déjà en direct).
  suite: { libelle: string; onPress: () => void; etiquette?: string } | null;
  onCompoPrecedente: () => void;
}) {
  const [renomme, setRenomme] = useState(false);
  const [menu, setMenu] = useState<{ playerId: string; camp: Camp } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const { joueurs, camps, gardiens, nomA, nomB, presenceDe } = compo;

  const parCamp = (camp: Camp): JoueurPelouse[] => {
    const eq = joueurs
      .filter((j) => camps[j.playerId] === camp)
      .map((j) => ({
        playerId: j.playerId,
        nom: j.nom,
        photo: j.photo,
        niveau: j.niveau,
        gardien: Boolean(gardiens[j.playerId]),
        presence: presenceDe.get(j.playerId)?.statut ?? null,
      }));
    // Le gardien en tête : c'est lui qui va devant la cage.
    const gk = eq.find((j) => j.gardien);
    return gk ? [gk, ...eq.filter((j) => j !== gk)] : eq;
  };
  const equipeA = parCamp("A");
  const equipeB = parCamp("B");
  const retenus = equipeA.length + equipeB.length;
  const niveau = (eq: JoueurPelouse[]) => eq.reduce((s, j) => s + j.niveau, 0);
  const dehors = joueurs
    .filter((j) => !camps[j.playerId])
    .sort((a, b) => rangPresence(presenceDe.get(a.playerId)) - rangPresence(presenceDe.get(b.playerId)));

  const alertes = alertesCompo({
    equipeA: equipeA.map((j) => ({ nom: j.nom, gardien: j.gardien, presence: j.presence })),
    equipeB: equipeB.map((j) => ({ nom: j.nom, gardien: j.gardien, presence: j.presence })),
    nomA: nomA || "A",
    nomB: nomB || "B",
  });

  const equilibrer = () => setErreur(compo.equilibrer());

  const cibleBouton = (camp: Camp) => {
    const actif = compo.cible === camp;
    const nom = camp === "A" ? nomA : nomB;
    const n = camp === "A" ? equipeA.length : equipeB.length;
    return (
      <Pressable
        key={camp}
        onPress={() => compo.setCible(camp)}
        disabled={!modifiable}
        accessibilityRole="radio"
        accessibilityState={{ selected: actif, disabled: !modifiable }}
        accessibilityLabel={`${nom}, ${n} joueur${n > 1 ? "s" : ""}`}
        accessibilityHint={modifiable ? "Les joueurs hors compo entrent dans cette équipe" : undefined}
        hitSlop={{ top: 3, bottom: 3 }}
        style={[s.cible, actif && { backgroundColor: jeton(t, "gl") }]}
      >
        <EcussonChasuble
          couleur={camp === "A" ? couleurA : couleurB}
          lettre=""
          taille={18}
          anneau={0}
          ombre={false}
        />
        <Text
          style={[s.cibleTexte, { color: actif ? t.ink : jeton(t, "i2") }]}
          numberOfLines={1}
        >
          {nom} · {n}
        </Text>
      </Pressable>
    );
  };

  const joueurMenu = menu ? joueurs.find((j) => j.playerId === menu.playerId) : null;
  const fermerMenu = () => setMenu(null);

  return (
    <CarteVerre t={t} style={s.carte}>
      <Text style={[s.titre, { color: t.ink }]} accessibilityRole="header">
        Composition
      </Text>

      <View
        style={[s.segment, { backgroundColor: jeton(t, "seg") }]}
        accessibilityRole="radiogroup"
        accessibilityLabel="Équipe à compléter"
      >
        {cibleBouton("A")}
        {cibleBouton("B")}
      </View>

      <View style={{ marginTop: 14 }}>
        <Pelouse
          equipeA={equipeA}
          equipeB={equipeB}
          couleurA={couleurA}
          couleurB={couleurB}
          nomA={nomA}
          nomB={nomB}
          modifiable={modifiable}
          eclair={compo.eclair}
          vide={
            modifiable
              ? "Touche un joueur ci-dessous pour le placer sur le terrain."
              : "Les équipes ne sont pas encore préparées."
          }
          onTap={(id) => compo.changerDEquipe(id)}
          onAppuiLong={(playerId, camp) => setMenu({ playerId, camp })}
        />
      </View>

      {retenus > 0 && (
        // « Note », pas « niveau » : la somme des notes d'équilibrage des deux
        // camps. Le mot « niveau » est réservé à celui qu'on gagne en jouant.
        <View style={s.niveau}>
          <Text style={[s.niveauTexte, { color: jeton(t, "i2") }]}>
            Note totale · {nomA} <Text style={[s.gras, { color: t.ink }]}>{niveau(equipeA)}</Text>
          </Text>
          <Text style={[s.niveauTexte, { color: jeton(t, "i2") }]}>
            {nomB} <Text style={[s.gras, { color: t.ink }]}>{niveau(equipeB)}</Text>
          </Text>
        </View>
      )}

      {modifiable && (
        <View style={s.actions}>
          <BoutonVerre
            t={t}
            titre={compo.tire ? "Autre tirage" : "Équilibrer"}
            onPress={equilibrer}
            style={{ flex: 1, paddingHorizontal: 12 }}
          />
          {compo.modifie ? (
            <BoutonPlein
              t={t}
              titre={compo.envoi ? "Enregistrement…" : "Enregistrer la compo"}
              occupe={compo.envoi}
              onPress={() => void compo.enregistrer()}
              style={{ flex: 1.3, paddingHorizontal: 14 }}
            />
          ) : suite ? (
            <BoutonPlein
              t={t}
              titre={suite.libelle}
              etiquette={suite.etiquette}
              onPress={suite.onPress}
              style={{ flex: 1.3, paddingHorizontal: 14 }}
            />
          ) : null}
        </View>
      )}

      {compo.message && (
        <Text
          style={[
            s.message,
            {
              color:
                compo.message.ton === "erreur"
                  ? jeton(t, "bad")
                  : compo.message.ton === "attente"
                    ? jeton(t, "or")
                    : jeton(t, "i2"),
            },
          ]}
          accessibilityLiveRegion="polite"
        >
          {compo.message.texte}
        </Text>
      )}

      {alertes.length > 0 && (
        <View style={s.alertes}>
          {alertes.map((a) => (
            <Text key={a} style={[s.alerte, { color: jeton(t, "or") }]}>
              {a}
            </Text>
          ))}
        </View>
      )}
      {erreur && <Text style={[s.alerte, s.alertes, { color: jeton(t, "bad") }]}>{erreur}</Text>}

      {modifiable && retenus > 0 && (
        <Text style={[s.aide, { color: jeton(t, "i3") }]}>
          Touche un joueur pour le passer dans l&apos;autre équipe. Appui long : gardien, ou le
          sortir de la compo.
        </Text>
      )}

      {modifiable && dehors.length > 0 && (
        <View style={s.hors}>
          <View style={s.legende}>
            <Text style={[s.legendeTexte, { color: jeton(t, "i2") }]}>
              Hors compo · {dehors.length}
            </Text>
            {compo.presentsDehors.length > 0 && (
              <Pressable
                onPress={compo.placerLesPresents}
                accessibilityRole="button"
                style={({ pressed }) => [s.placer, pressed && { opacity: 0.7 }]}
              >
                <Text style={[s.placerTexte, { color: t.ink }]}>
                  Placer les présents · {compo.presentsDehors.length}
                </Text>
              </Pressable>
            )}
          </View>
          <View style={s.jetons}>
            {dehors.map((j) => {
              const p = presenceDe.get(j.playerId);
              const couleurPastille =
                p?.statut === "IN"
                  ? p.enAttente
                    ? jeton(t, "or")
                    : jeton(t, "ok")
                  : p?.statut === "MAYBE"
                    ? jeton(t, "or")
                    : p?.statut === "OUT"
                      ? jeton(t, "bad")
                      : null;
              return (
                <Pressable
                  key={j.playerId}
                  onPress={() => compo.faireEntrer(j.playerId)}
                  accessibilityRole="button"
                  accessibilityLabel={`${j.nom}, ${libellePresence(p)} — hors compo, ajouter à ${compo.cible === "A" ? nomA : nomB}`}
                  style={({ pressed }) => [
                    s.jeton,
                    { backgroundColor: jeton(t, "seg") },
                    p?.statut === "OUT" && { opacity: 0.45 },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Avatar nom={j.nom} photo={j.photo} t={t} taille={28} />
                  <Text style={[s.jetonNom, { color: t.ink }]} numberOfLines={1}>
                    {j.nom}
                  </Text>
                  <View
                    style={[
                      s.pastille,
                      couleurPastille
                        ? { backgroundColor: couleurPastille }
                        : { borderWidth: 1.5, borderColor: jeton(t, "i3") },
                    ]}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {modifiable && (
        <>
          <View style={s.liens}>
            <Pressable
              onPress={() => {
                if (retenus === 0) return onCompoPrecedente();
                Alert.alert(
                  "Reprendre la compo précédente ?",
                  "Les équipes de la dernière soirée préparée remplacent celles-ci.",
                  [
                    { text: "Annuler", style: "cancel" },
                    { text: "Reprendre", onPress: onCompoPrecedente },
                  ],
                );
              }}
              accessibilityRole="button"
              style={({ pressed }) => [s.lien, pressed && { opacity: 0.6 }]}
            >
              <Text style={[s.lienTexte, { color: jeton(t, "i2") }]}>Compo précédente</Text>
            </Pressable>
            <Pressable
              onPress={() => setRenomme((r) => !r)}
              accessibilityRole="button"
              accessibilityState={{ expanded: renomme }}
              style={({ pressed }) => [s.lien, pressed && { opacity: 0.6 }]}
            >
              <Text style={[s.lienTexte, { color: jeton(t, "i2") }]}>
                {renomme ? "Fermer" : "Renommer les équipes"}
              </Text>
            </Pressable>
          </View>
          {renomme && (
            <View style={s.noms}>
              <Saisie
                t={t}
                value={nomA}
                onChangeText={compo.setNomA}
                maxLength={40}
                accessibilityLabel="Nom de la première équipe"
                style={{ flex: 1, minWidth: 0 }}
              />
              <Saisie
                t={t}
                value={nomB}
                onChangeText={compo.setNomB}
                maxLength={40}
                accessibilityLabel="Nom de la seconde équipe"
                style={{ flex: 1, minWidth: 0 }}
              />
            </View>
          )}
        </>
      )}

      <Feuille t={t} visible={menu != null} onClose={fermerMenu} titre={joueurMenu?.nom}>
        {menu && joueurMenu && (
          <>
            <ActionMenu
              t={t}
              titre={`Passer chez ${menu.camp === "A" ? nomB : nomA}`}
              onPress={() => {
                fermerMenu();
                compo.changerDEquipe(menu.playerId);
              }}
            />
            <ActionMenu
              t={t}
              titre={gardiens[menu.playerId] ? "Ne plus le mettre au but" : "Gardien ce soir"}
              aide={
                joueurMenu.gardien && !gardiens[menu.playerId]
                  ? "C'est le gardien attitré du club"
                  : undefined
              }
              onPress={() => {
                fermerMenu();
                compo.basculerGardien(menu.playerId);
              }}
            />
            <ActionMenu
              t={t}
              titre="Sortir de la compo"
              danger
              onPress={() => {
                fermerMenu();
                compo.retirer(menu.playerId);
              }}
            />
            <Pressable onPress={fermerMenu} style={s.fermer} accessibilityRole="button">
              <Text style={[s.fermerTexte, { color: jeton(t, "i2") }]}>Fermer</Text>
            </Pressable>
          </>
        )}
      </Feuille>
    </CarteVerre>
  );
}

function ActionMenu({
  t,
  titre,
  aide,
  danger,
  onPress,
}: {
  t: Jetons;
  titre: string;
  aide?: string;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [s.action, pressed && { backgroundColor: jeton(t, "gl") }]}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[s.actionTitre, { color: danger ? jeton(t, "bad") : t.ink }]}>{titre}</Text>
        {aide ? <Text style={[s.actionAide, { color: jeton(t, "i2") }]}>{aide}</Text> : null}
      </View>
      <IconeJeu nom="chevron" couleur={jeton(t, "i3")} taille={18} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  carte: { paddingHorizontal: 14, paddingBottom: 16 },
  titre: {
    fontSize: 22,
    fontWeight: "600",
    letterSpacing: -0.3,
    textAlign: "center",
    paddingTop: 22,
    paddingBottom: 16,
  },
  segment: { flexDirection: "row", height: 44, borderRadius: 22, padding: 3 },
  cible: {
    flex: 1,
    height: 38,
    borderRadius: 19,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 10,
  },
  cibleTexte: { fontSize: 17, fontWeight: "600", flexShrink: 1 },
  niveau: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 12,
    paddingHorizontal: 6,
    gap: 12,
  },
  niveauTexte: { fontSize: 15 },
  gras: { fontWeight: "600" },
  actions: { flexDirection: "row", gap: 10, marginTop: 14 },
  message: { fontSize: 15, textAlign: "center", marginTop: 10 },
  alertes: { marginTop: 12, marginHorizontal: 4, gap: 4 },
  alerte: { fontSize: 15, lineHeight: 20 },
  aide: { fontSize: 13, lineHeight: 18, marginTop: 10, marginHorizontal: 4 },
  hors: { marginTop: 16, paddingHorizontal: 2 },
  legende: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    minHeight: 44,
  },
  legendeTexte: { fontSize: 15 },
  placer: { minHeight: 44, justifyContent: "center", paddingHorizontal: 2 },
  placerTexte: { fontSize: 15, fontWeight: "600" },
  jetons: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  jeton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 44,
    borderRadius: 22,
    paddingLeft: 8,
    paddingRight: 14,
    maxWidth: "100%",
  },
  jetonNom: { fontSize: 15, fontWeight: "600", flexShrink: 1 },
  pastille: { width: 8, height: 8, borderRadius: 4 },
  liens: { flexDirection: "row", justifyContent: "center", gap: 22, marginTop: 14 },
  lien: { minHeight: 44, justifyContent: "center" },
  lienTexte: { fontSize: 15, fontWeight: "600" },
  noms: { flexDirection: "row", gap: 10, marginTop: 12 },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  actionTitre: { fontSize: 17, fontWeight: "600" },
  actionAide: { fontSize: 13, paddingTop: 2 },
  fermer: { height: 52, alignItems: "center", justifyContent: "center", marginTop: 4 },
  fermerTexte: { fontSize: 17, fontWeight: "600" },
});
