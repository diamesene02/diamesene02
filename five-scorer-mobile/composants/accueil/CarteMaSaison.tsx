import { StyleSheet, Text, View } from "react-native";
import { Avatar, CarteVerre, EcussonChasuble } from "../base";
import EnTeteCarte from "./EnTeteCarte";
import BarreProgression from "../succes/BarreProgression";
import IconeSucces from "../succes/IconeSucces";
import Medaille from "../succes/Medaille";
import { nombre } from "../succes/textes";
import { jeton, type Jetons } from "../../lib/couleurs";
import type { Accueil } from "../../lib/api";
import type { SuccesJoueur } from "../../lib/succes";
import type { IconeSucces as CleIcone } from "../../lib/succes-icones";
import {
  evolutionPhrase,
  evolutionTexte,
  poursuite,
  prochainPalier,
  rangTexte,
  seriePhare,
} from "./logique";

/// « Ma saison » (`MaSaison` du site) : ce que le joueur connecté vient
/// chercher le mardi matin — son niveau et ce qui manque au suivant, sa place
/// et ce qu'elle a fait depuis la dernière soirée, qui est juste devant, la
/// série qu'il ne veut pas casser, le prochain palier à portée.
///
/// Le rang vient du tableau de l'accueil (même tri, même saison) : la carte
/// et le tableau juste en dessous ne peuvent pas se contredire. Le niveau et
/// les paliers couvrent toute la carrière (`SuccesJoueur`, calculé par le
/// serveur).
///
/// Écart au site : pas de ligne « Lundi : 2 victoires, 1 nul ». Le site la
/// tire de l'historique des matchs qu'il a sous la main ; la route des succès
/// ne rend pas ce bilan à l'app.
export default function CarteMaSaison({
  t,
  succes,
  classement,
  monIndex,
  evolution,
  chasubles,
  onVoir,
}: {
  t: Jetons;
  succes: SuccesJoueur;
  classement: Accueil["classement"];
  /// Ma ligne dans `classement`, -1 si je n'ai pas joué cette saison.
  monIndex: number;
  evolution: number | null;
  chasubles: { a: string; b: string };
  /// « Mes succès › » : ma fiche.
  onVoir: () => void;
}) {
  const n = succes.niveau;
  const reste = Math.max(0, n.xpSuivant - n.xp);
  const rang = monIndex >= 0 ? monIndex + 1 : null;
  const evo = evolutionTexte(evolution, true);
  const suite = poursuite(classement, monIndex);
  const serie = seriePhare(succes.series);
  const cible = succes.prochain;
  const palier = cible ? prochainPalier(cible, succes.series) : null;
  const couleurEvo =
    evolution == null || evolution === 0
      ? jeton(t, "i3")
      : jeton(t, evolution > 0 ? "ok" : "bad");

  return (
    <CarteVerre t={t} style={s.carte}>
      <EnTeteCarte
        t={t}
        titre="Ma saison"
        action="Mes succès"
        etiquette="Voir mes succès"
        onAction={onVoir}
      />

      <View
        style={s.tete}
        accessible
        accessibilityLabel={[
          `${n.titre}, niveau ${n.niveau}, ${nombre(n.xp)} XP`,
          rang != null ? `${rangTexte(rang)} sur ${classement.length} au tableau` : null,
          evolutionPhrase(evolution),
        ]
          .filter(Boolean)
          .join(", ")}
      >
        <EcussonChasuble couleur={chasubles.a} lettre={String(n.niveau)} taille={52} />
        <View style={s.niveau}>
          <Text style={[s.titre, { color: t.ink }]} numberOfLines={1}>
            {n.titre}
          </Text>
          <Text style={[s.sous, { color: jeton(t, "i2") }]} numberOfLines={1}>
            Niveau {n.niveau} · {nombre(n.xp)} XP
          </Text>
        </View>
        {rang != null && (
          <View style={s.rang}>
            <View style={s.rangLigne}>
              <Text style={[s.rangChiffre, { color: t.ink }]}>{rangTexte(rang)}</Text>
              {evo ? <Text style={[s.evo, { color: couleurEvo }]}>{evo}</Text> : null}
            </View>
            <Text style={[s.sous, { color: jeton(t, "i2") }]}>sur {classement.length}</Text>
          </View>
        )}
      </View>

      <BarreProgression
        t={t}
        part={n.progression}
        chasubles={chasubles}
        hauteur={6}
        etiquette={`Vers le niveau ${n.niveau + 1}`}
        style={s.barre}
      />
      <Text style={[s.reste, { color: jeton(t, "i2") }]}>
        encore <Text style={[s.gras, { color: t.ink }]}>{nombre(reste)} XP</Text> pour le niveau{" "}
        {n.niveau + 1}
      </Text>

      <View style={s.lignes}>
        {suite && (
          <Ligne
            t={t}
            tete={
              suite.devant ? (
                <Avatar nom={suite.devant.nom} t={t} camp={suite.devant.camp ?? null} taille={36} />
              ) : (
                <Pastille t={t} icone="couronne" />
              )
            }
            titre={suite.titre}
            sous={suite.sous}
          />
        )}
        {serie && (
          <Ligne t={t} tete={<Pastille t={t} icone={serie.icone} />} titre={serie.titre} sous={serie.sous} />
        )}
        {cible && palier && (
          <Ligne
            t={t}
            tete={<Medaille icone={cible.icone} matiere={cible.matiere} t={t} chasubles={chasubles} taille={36} />}
            titre={palier.titre}
            sous={palier.sous}
          >
            <BarreProgression
              t={t}
              part={palier.part}
              chasubles={chasubles}
              hauteur={4}
              style={s.barrePalier}
            />
          </Ligne>
        )}
      </View>
    </CarteVerre>
  );
}

/// L'icône d'une ligne, dans une pastille ronde de verre sombre.
function Pastille({ t, icone }: { t: Jetons; icone: CleIcone }) {
  return (
    <View style={[s.pastille, { backgroundColor: jeton(t, "seg"), borderColor: jeton(t, "gb") }]}>
      <IconeSucces icone={icone} couleur={t.ink} taille={20} />
    </View>
  );
}

function Ligne({
  t,
  tete,
  titre,
  sous,
  children,
}: {
  t: Jetons;
  tete: React.ReactNode;
  titre: string;
  sous?: string | null;
  children?: React.ReactNode;
}) {
  return (
    <View
      style={[s.ligne, { borderTopColor: jeton(t, "sep") }]}
      accessible
      accessibilityLabel={sous ? `${titre}, ${sous}` : titre}
    >
      {tete}
      <View style={s.textes}>
        <Text style={[s.l1, { color: t.ink }]} numberOfLines={1}>
          {titre}
        </Text>
        {sous ? (
          <Text style={[s.l2, { color: jeton(t, "i2") }]} numberOfLines={1}>
            {sous}
          </Text>
        ) : null}
        {children}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  carte: { paddingHorizontal: 18, paddingBottom: 12 },
  tete: { flexDirection: "row", alignItems: "center", gap: 14 },
  niveau: { flex: 1, minWidth: 0 },
  titre: { fontSize: 22, fontWeight: "700", letterSpacing: -0.3, lineHeight: 25 },
  sous: { marginTop: 2, fontSize: 15, fontVariant: ["tabular-nums"] },
  rang: { alignItems: "flex-end" },
  rangLigne: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  rangChiffre: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.4,
    lineHeight: 31,
    fontVariant: ["tabular-nums"],
  },
  evo: { fontSize: 14, fontWeight: "700", letterSpacing: -0.2, fontVariant: ["tabular-nums"] },
  barre: { marginTop: 16 },
  reste: { marginTop: 8, fontSize: 13, fontVariant: ["tabular-nums"] },
  gras: { fontWeight: "700" },
  lignes: { marginTop: 12 },
  ligne: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 60,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  textes: { flex: 1, minWidth: 0, gap: 1 },
  l1: { fontSize: 16, fontWeight: "600" },
  l2: { fontSize: 13, fontVariant: ["tabular-nums"] },
  pastille: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  barrePalier: { marginTop: 7 },
});
