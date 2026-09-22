import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { chargerMoiMemorise, useClubId, useClubMemorise } from "../../../composants/ClubCourant";
import Ecran from "../../../composants/Ecran";
import EnTeteClub from "../../../composants/EnTeteClub";
import ErreurChargement from "../../../composants/ErreurChargement";
import { BoutonPlein, CarteVerre } from "../../../composants/base";
import { CarteSquelette, Squelette } from "../../../composants/Squelette";
import { useSommet } from "../../../composants/RetourEnHaut";
import { IconeCalendrier, IconeJeu, IconePlus } from "../../../composants/Icones";
import { quandRelatif } from "../../../composants/soiree/logique";
import { jeton, JETONS_NEUTRES, type Jetons } from "../../../lib/couleurs";
import { ESPACE_BARRE } from "../../../composants/BarreOnglets";
import {
  chargerSoirees,
  SessionExpiree,
  type ClubDeMoi,
  type EcranSoirees,
  type GroupeMois,
  type LigneSoiree,
} from "../../../lib/api";

/// « Les soirées » — le calendrier du club, repris de la page du site.
///
/// Les six prochaines, puis les soirées déjà jouées, et le reste de la
/// saison replié EN BAS : un club qui pose sa saison d'un coup a quarante
/// lundis devant lui, et la soirée qu'on vient de jouer — celle dont on
/// cherche le résultat — ne doit pas se retrouver sous quarante rangées.
///
/// Une rangée à venir dit ce qu'il faut savoir avant de venir — quand, à
/// quelle heure, combien on est, où. Une rangée passée dit ce qu'il en
/// reste — les matchs, les buts, et ce qu'il y a à encaisser.
export default function Soirees() {
  const id = useClubId();
  const memo = useClubMemorise();
  const [club, setClub] = useState<ClubDeMoi | null>(null);
  const [donnees, setDonnees] = useState<EcranSoirees | null>(null);
  const [resteOuvert, setResteOuvert] = useState(false);
  const [occupe, setOccupe] = useState(true);
  const [rafraichit, setRafraichit] = useState(false);
  const [erreur, setErreur] = useState<unknown>(null);

  // Les couleurs du dernier `/api/me` dès la première image : l'écran ne
  // passe plus du gris au dégradé du club à chaque ouverture.
  const c = club ?? memo;
  const t: Jetons = c?.theme.sombre ?? JETONS_NEUTRES;

  const charger = useCallback(async () => {
    if (!id) return;
    try {
      const [moi, s] = await Promise.all([
        chargerMoiMemorise().catch(() => null),
        chargerSoirees(id),
      ]);
      if (moi) setClub(moi.clubs.find((x) => x.id === id) ?? null);
      setDonnees(s);
      setErreur(null);
    } catch (e) {
      if (e instanceof SessionExpiree) return router.replace("/connexion");
      setErreur(e);
    } finally {
      setOccupe(false);
    }
  }, [id]);

  // À chaque retour : une réponse donnée ou une soirée créée change la liste.
  useFocusEffect(
    useCallback(() => {
      void charger();
    }, [charger]),
  );

  const peutMarquer = donnees?.club.peutMarquer ?? c?.peutScorer ?? false;
  const peutGerer = donnees?.club.peutGerer ?? c?.peutGerer ?? false;
  const programmer = () =>
    router.push({ pathname: "/soiree/nouvelle", params: { clubId: id } });

  return (
    <Ecran t={t} chasubles={c ? { a: c.couleurA, b: c.couleurB } : undefined}>
      <ScrollView
        ref={useSommet("soirees")}
        contentContainerStyle={s.defile}
        refreshControl={
          <RefreshControl
            refreshing={rafraichit}
            onRefresh={async () => {
              setRafraichit(true);
              await charger();
              setRafraichit(false);
            }}
            tintColor={t.i2}
          />
        }
      >
        {/* Le titre d'écran du reste de l'app (34/700 sous la barre) et non un
            28 fait maison : « Stats », « Effectif », « Saison » et « Réglages »
            se présentaient tous pareil, « Les soirées » seul autrement. */}
        <EnTeteClub t={t} club={c} titre="Soirées" sousTitre="Le calendrier du club" />

        <View style={s.contenu}>
          <Text style={[s.chapeau, { color: jeton(t, "i2") }]}>
            Un créneau réservé : une date, un terrain, qui vient.{" "}
            <Text style={{ color: t.ink }}>Les matchs se jouent dedans.</Text>
          </Text>

          {/* L'action principale de l'écran se voit : plein et contrasté. Elle
              était peinte en `seg` sur un fond sombre, c'est-à-dire comme un
              bouton éteint. Elle garde sa largeur de contenu — pleine largeur,
              elle passerait devant le calendrier, qui est ce qu'on vient lire. */}
          {peutMarquer && !donnees?.vide && (
            <BoutonPlein
              t={t}
              titre="Programmer une soirée"
              icone={<IconePlus couleur={jeton(t, "bf")} taille={16} />}
              onPress={programmer}
              style={s.programmer}
            />
          )}
          {peutGerer && (
            // Poser toute la saison d'un coup : la voie normale pour un club
            // qui joue toutes les semaines. Créer les soirées une par une reste
            // possible juste au-dessus, pour les dates hors calendrier. Action
            // secondaire : elle s'efface.
            <Pressable
              onPress={() => router.push({ pathname: "/calendrier", params: { clubId: id } })}
              accessibilityRole="button"
              style={({ pressed }) => [s.saison, pressed && { opacity: 0.6 }]}
            >
              <IconeCalendrier couleur={jeton(t, "i2")} taille={15} />
              <Text style={[s.saisonTexte, { color: jeton(t, "i2") }]}>Poser toute la saison</Text>
              <IconeJeu nom="chevron" couleur={jeton(t, "i2")} taille={14} />
            </Pressable>
          )}

          {erreur != null && (
            <ErreurChargement t={t} erreur={erreur} onReessayer={charger} style={s.section} />
          )}

          {occupe && !donnees && (
            // La forme de la page — deux cartes de mois et leurs rangées de
            // dates — plutôt que deux pavés gris : les lignes sont là avant
            // les mots, rien ne saute quand la liste arrive.
            <Squelette etiquette="On ouvre le calendrier" style={s.section}>
              <CarteSquelette t={t} rangees={3} hauteurRangee={64} entete avatar={false} />
              <CarteSquelette
                t={t}
                rangees={2}
                hauteurRangee={64}
                entete
                avatar={false}
                style={s.squelette}
              />
            </Squelette>
          )}

          {donnees?.vide && (
            <CarteVerre t={t} style={[s.vide, s.section]}>
              <Text style={[s.videTitre, { color: t.ink }]}>Aucune soirée pour l&apos;instant.</Text>
              <Text style={[s.videTexte, { color: t.ink }]}>
                Une soirée, c&apos;est le créneau : jeudi 19 h, terrain 2. Tu la programmes, chacun
                dit s&apos;il vient, et tu répartis le prix du terrain entre les présents.
              </Text>
              <Text style={[s.videTexte, { color: jeton(t, "i2"), marginTop: 12 }]}>
                Les matchs, eux, se jouent dedans — et souvent plusieurs dans la même soirée. Ce
                sont eux qui portent les scores et les statistiques.
              </Text>
              {peutMarquer && (
                <BoutonPlein
                  t={t}
                  titre="Programmer une soirée"
                  icone={<IconePlus couleur={jeton(t, "bf")} taille={18} />}
                  onPress={programmer}
                  style={{ marginTop: 20, alignSelf: "stretch" }}
                />
              )}
            </CarteVerre>
          )}

          {donnees && donnees.prochaines.length > 0 && (
            <View style={s.section}>
              <Text style={[s.sectionTitre, { color: t.ink }]} accessibilityRole="header">
                À venir
              </Text>
              {donnees.prochaines.map((g) => (
                <CarteMois key={"p" + g.cle} g={g} t={t} clubId={id} />
              ))}
            </View>
          )}

          {donnees && donnees.passees.length > 0 && (
            <View style={s.section}>
              <Text style={[s.sectionTitre, { color: t.ink }]} accessibilityRole="header">
                Déjà jouées
              </Text>
              {donnees.passees.map((g) => (
                <CarteMois key={"j" + g.cle} g={g} t={t} clubId={id} />
              ))}
            </View>
          )}

          {donnees && donnees.resteTotal > 0 && (
            <View style={s.section}>
              <Pressable
                onPress={() => setResteOuvert((o) => !o)}
                accessibilityRole="button"
                accessibilityState={{ expanded: resteOuvert }}
                style={({ pressed }) => [s.deplier, pressed && { opacity: 0.6 }]}
              >
                <Text style={[s.sectionTitre, { color: t.ink }]}>
                  Le reste de la saison{" "}
                  <Text style={[s.compteSection, { color: jeton(t, "i3") }]}>
                    {donnees.resteTotal}
                  </Text>
                </Text>
                {/* Les caractères « ▸ » et « ▾ » faisaient six points de haut
                    et ne suivaient pas le dessin des autres chevrons. */}
                <View style={resteOuvert && s.chevronOuvert}>
                  <IconeJeu nom="chevron" couleur={jeton(t, "i3")} taille={16} />
                </View>
              </Pressable>
              {resteOuvert &&
                donnees.reste.map((g) => <CarteMois key={"r" + g.cle} g={g} t={t} clubId={id} />)}
            </View>
          )}
        </View>
      </ScrollView>
    </Ecran>
  );
}

function CarteMois({ g, t, clubId }: { g: GroupeMois; t: Jetons; clubId: string }) {
  return (
    <CarteVerre t={t} style={s.carte}>
      <View style={[s.carteTete, { borderBottomColor: jeton(t, "sep") }]}>
        <Text style={[s.mois, { color: jeton(t, "i2") }]}>{g.titre.toUpperCase()}</Text>
        {/* « 1 » tout seul dans le coin ne disait pas de quoi. */}
        <Text style={[s.petitCompte, { color: jeton(t, "i3") }]}>
          {g.compte} soirée{g.compte > 1 ? "s" : ""}
        </Text>
      </View>
      {g.soirees.map((so, i) => (
        <Rangee key={so.id} so={so} t={t} clubId={clubId} premiere={i === 0} />
      ))}
    </CarteVerre>
  );
}

/// UNE RANGÉE DE SOIRÉE, EN DEUX LIGNES.
///
/// Elle tenait sur une seule, et c'est ce que montrait la capture d'Ibrahima :
/// « jeu. 24 · 19:00 · Dans 2 jours · 8 présents ·… ». Tout ce qui répond à
/// « est-ce que je viens ? » — combien on est, où — tombait dans l'ellipse,
/// parce que le terrain du club s'appelle « Urban Soccer Guyancourt ».
///
/// Le dessin est celui du calendrier de l'écran « Saison », qui marchait déjà :
/// un bloc de date à gauche (le jour en petites capitales, le quantième en
/// gros), puis deux lignes — ce qui se passe, puis ce qu'il faut savoir. La
/// même forme aux deux endroits, et plus rien à couper.
function Rangee({
  so,
  t,
  clubId,
  premiere,
}: {
  so: LigneSoiree;
  t: Jetons;
  clubId: string;
  premiere: boolean;
}) {
  const ouvrir = () => router.push({ pathname: "/soiree/[id]", params: { id: so.id, clubId } });
  const i2 = jeton(t, "i2");
  const i3 = jeton(t, "i3");
  const date = coupeDate(so.jour);

  let titre: React.ReactNode;
  let sous: React.ReactNode = null;
  let etiquette = so.jour;

  if (so.annulee) {
    // Une soirée annulée se présentait comme les autres, et le joueur passé
    // par le menu venait pour rien.
    titre = <Text style={[s.rangeeTitre, s.barre, { color: i2 }]}>Annulée</Text>;
    const motif = so.motifAnnulation ?? so.lieu;
    if (motif) {
      sous = (
        <Text style={[s.rangeeSous, { color: i3 }]} numberOfLines={1}>
          {motif}
        </Text>
      );
    }
    etiquette = `${so.jour}, annulée${so.motifAnnulation ? ` : ${so.motifAnnulation}` : ""}`;
  } else if (so.aVenir) {
    const relatif = quandRelatif(so.date);
    const lieu = so.lieu ?? so.libelle;
    titre = (
      <Text style={[s.rangeeTitre, { color: t.ink }]} numberOfLines={1}>
        {so.heure}
        {lieu ? <Text style={s.maigre}> · {lieu}</Text> : null}
      </Text>
    );
    // La ligne qui répond à « est-ce que je viens ? » : elle ne partage plus
    // sa place avec le lieu, donc elle ne se coupe plus.
    if (relatif || so.presents > 0) {
      sous = (
        <Text style={[s.rangeeSous, { color: i2 }]} numberOfLines={1}>
          {relatif}
          {relatif && so.presents > 0 ? " · " : ""}
          {so.presents > 0 ? (
            <Text style={{ color: t.taInk ?? i2, fontWeight: "600" }}>
              {so.presents} présent{so.presents > 1 ? "s" : ""}
            </Text>
          ) : null}
        </Text>
      );
    }
    etiquette = `${so.jour}, ${so.heure}${relatif ? `, ${relatif}` : ""}${so.presents > 0 ? `, ${so.presents} présents` : ""}${lieu ? `, ${lieu}` : ""}`;
  } else {
    titre = (
      <Text style={[s.rangeeTitre, { color: t.ink }]} numberOfLines={1}>
        {so.matchs}
        <Text style={s.maigre}> match{so.matchs > 1 ? "s" : ""}</Text>
      </Text>
    );
    if (so.buts > 0 || so.prix) {
      sous = (
        <Text style={[s.rangeeSous, { color: i2 }]} numberOfLines={1}>
          {so.buts > 0 ? `${so.buts} but${so.buts > 1 ? "s" : ""}` : ""}
          {so.buts > 0 && so.prix ? " · " : ""}
          {so.prix ? (
            // Ce qui reste à encaisser garde la couleur d'alerte : c'est la
            // seule chose sur cet écran qui attend quelque chose de quelqu'un.
            <Text
              style={{
                color: so.toutRegle ? i3 : jeton(t, "or"),
                fontWeight: so.toutRegle ? "400" : "600",
              }}
            >
              {so.prix} {so.toutRegle ? "réglé" : "à encaisser"}
            </Text>
          ) : null}
        </Text>
      );
    }
    etiquette = `${so.jour}, ${so.matchs} match${so.matchs > 1 ? "s" : ""}${so.buts > 0 ? `, ${so.buts} buts` : ""}`;
  }

  return (
    <Pressable
      onPress={ouvrir}
      accessibilityRole="button"
      accessibilityLabel={etiquette}
      style={({ pressed }) => [
        s.rangee,
        !premiere && { borderTopWidth: 1, borderTopColor: jeton(t, "sep") },
        so.annulee && { opacity: 0.55 },
        pressed && { opacity: so.annulee ? 0.4 : 0.6 },
      ]}
    >
      <View style={s.date}>
        {date ? (
          <>
            <Text style={[s.dateJour, { color: i2 }]} numberOfLines={1}>
              {date.jour}
            </Text>
            <Text style={[s.dateNumero, { color: t.ink }]}>{date.numero}</Text>
          </>
        ) : (
          <Text style={[s.dateJour, { color: i2 }]} numberOfLines={2}>
            {so.jour.toUpperCase()}
          </Text>
        )}
      </View>
      <View style={s.textes}>
        {titre}
        {sous}
      </View>
      <IconeJeu nom="chevron" couleur={i3} taille={14} />
    </Pressable>
  );
}

/// « jeu. 24 » → « JEU. » et « 24 ».
///
/// La route de la saison rend déjà le jour et le quantième séparément ; celle
/// des soirées les rend collés. On coupe au dernier groupe de chiffres — et si
/// ça ne tombe pas juste (un format de date qu'on ne connaît pas), on garde la
/// chaîne entière plutôt que d'en inventer les morceaux.
function coupeDate(x: string): { jour: string; numero: string } | null {
  const m = x.trim().match(/^(.+)\s+(\d{1,2})\.?$/);
  return m ? { jour: m[1].toUpperCase(), numero: m[2] } : null;
}

const s = StyleSheet.create({
  defile: { paddingBottom: ESPACE_BARRE },
  contenu: { paddingHorizontal: 14 },
  chapeau: { fontSize: 15, lineHeight: 21, marginTop: 16, paddingHorizontal: 4, maxWidth: 384 },
  programmer: { alignSelf: "flex-start", marginTop: 16, marginLeft: 4 },
  saison: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    minHeight: 44,
    marginTop: 4,
    marginLeft: 4,
  },
  saisonTexte: { fontSize: 15, fontWeight: "600" },

  section: { marginTop: 28 },
  // Un vrai titre de section (20/700), pas un troisième gris de 15 : « À
  // venir » et « Déjà jouées » découpent l'écran, le mois découpe la carte.
  sectionTitre: { fontSize: 20, fontWeight: "700", letterSpacing: -0.3, paddingHorizontal: 4 },
  compteSection: { fontSize: 17, fontWeight: "400", fontVariant: ["tabular-nums"] },
  chevronOuvert: { transform: [{ rotate: "90deg" }] },
  squelette: { marginTop: 18 },

  vide: { padding: 32, alignItems: "center" },
  videTitre: { fontSize: 22, fontWeight: "700", letterSpacing: -0.3, textAlign: "center" },
  videTexte: { fontSize: 15, lineHeight: 21, textAlign: "center", marginTop: 8, maxWidth: 384 },

  carte: { marginTop: 12, paddingTop: 14, paddingHorizontal: 16, paddingBottom: 8 },
  carteTete: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  mois: { fontSize: 13, fontWeight: "600", letterSpacing: 0.4 },
  petitCompte: { fontSize: 13, fontVariant: ["tabular-nums"] },

  // Le bloc de date, à la mesure de celui de l'écran « Saison ».
  rangee: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingVertical: 10 },
  date: { width: 58 },
  dateJour: { fontSize: 13, fontWeight: "600", letterSpacing: 0.3 },
  dateNumero: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.5,
    lineHeight: 30,
    fontVariant: ["tabular-nums"],
  },
  textes: { flex: 1, minWidth: 0, gap: 2 },
  rangeeTitre: { fontSize: 17, fontWeight: "600", fontVariant: ["tabular-nums"] },
  maigre: { fontWeight: "400" },
  rangeeSous: { fontSize: 15, fontVariant: ["tabular-nums"] },
  barre: { textDecorationLine: "line-through" },

  deplier: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 4,
  },
});
