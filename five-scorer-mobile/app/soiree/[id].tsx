import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useGlobalSearchParams, useLocalSearchParams } from "expo-router";
import Ecran from "../../composants/Ecran";
import { Avatar, BoutonRond, EcussonChasuble } from "../../composants/base";
import { JETONS_NEUTRES, type Jetons } from "../../lib/couleurs";
import { useNoyau } from "../../composants/Noyau";
import { balanceTeams } from "../../lib/noyau/balance";
import { themeTokens } from "../../lib/noyau/theme";
import {
  chargerSoiree,
  repondrePresence,
  SessionExpiree,
  type FicheSoiree,
  type StatutReponse,
} from "../../lib/api";

/// La fiche d'une soirée — l'écran-pivot du lundi.
///
/// Avant : qui vient, quelles équipes, qui a payé le terrain. Après : le
/// bilan, le mot à coller dans le groupe, les matchs, les cracks du soir.
///
/// L'ORDRE des cartes bascule : dès qu'un match existe, les résultats passent
/// devant la préparation. Avant le coup d'envoi la question est « qui vient » ;
/// après, c'est « qu'est-ce qui s'est passé ».
///
/// Tout arrive fait du serveur — libellés, comptes, listes de buteurs, et le
/// mot lui-même. L'app ne formate rien : le moteur JavaScript de React Native
/// n'embarque pas les fuseaux horaires.
export default function Soiree() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { clubId } = useGlobalSearchParams<{ clubId?: string }>();
  const [fiche, setFiche] = useState<FicheSoiree | null>(null);
  const [club, setClub] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // La composition, tenue à l'écran pendant qu'on la touche. Elle part dans la
  // file d'attente à l'enregistrement, pas à chaque tap : composer est un
  // brouillon, et un brouillon ne doit pas produire quinze opérations.
  const { local, drain } = useNoyau();
  const [camps, setCamps] = useState<Record<string, "A" | "B" | null>>({});
  const [gardiens, setGardiens] = useState<Record<string, boolean>>({});
  const [graine, setGraine] = useState(1);
  const [envoiCompo, setEnvoiCompo] = useState(false);
  const [motCompo, setMotCompo] = useState<string | null>(null);

  const charger = useCallback(async () => {
    if (!id) return;
    setErreur(null);
    try {
      // Le club vient du paramètre quand on arrive depuis la liste ; sinon on
      // le retrouve par /api/me — un lien partagé n'a pas de contexte.
      const { chargerMoi } = await import("../../lib/api");
      const cid = clubId ?? (await chargerMoi()).clubs[0]?.id;
      if (!cid) throw new Error("Aucun club.");
      setClub(cid);
      setFiche(await chargerSoiree(cid, id));
    } catch (e) {
      if (e instanceof SessionExpiree) return router.replace("/connexion");
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setOccupe(false);
    }
  }, [id, clubId]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const couleurA = fiche?.chasubles.a.couleur ?? "#ffffff";
  const couleurB = fiche?.chasubles.b.couleur ?? "#111111";
  const t: Jetons = fiche ? themeTokens(couleurA, couleurB, "dark") : JETONS_NEUTRES;

  async function repondre(statut: StatutReponse) {
    if (!fiche?.presences.monPlayerId || !club || !id) return;
    setEnvoi(true);
    try {
      await repondrePresence(club, id, fiche.presences.monPlayerId, statut);
      await charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setEnvoi(false);
    }
  }

  async function partagerLeMot() {
    if (!fiche?.mot) return;
    // Le partage natif ouvre WhatsApp directement — c'est là que le mot va,
    // tous les mardis matin.
    await Share.share({ message: fiche.mot }).catch(() => {});
  }

  // Quand la fiche arrive, on repart de ce que le serveur dit — y compris le
  // gardien DE LA SOIRÉE (`gardienSoiree`), et non le rôle du joueur. Sans lui,
  // relire puis réécrire effacerait le gardien désigné à chaque enregistrement.
  useEffect(() => {
    if (!fiche) return;
    const c: Record<string, "A" | "B" | null> = {};
    const g: Record<string, boolean> = {};
    for (const j of fiche.compo.joueurs) {
      c[j.playerId] = j.camp;
      g[j.playerId] = j.gardienSoiree;
    }
    setCamps(c);
    setGardiens(g);
    setMotCompo(null);
  }, [fiche]);

  const presences = fiche && (
    <View style={[s.carte, { borderColor: t.cb, backgroundColor: t.cdSolid }]}>
      <Text style={[s.carteTitre, { color: t.ink }]}>{fiche.presences.titre}</Text>
      <Text style={[s.phrase, { color: t.i2 }]}>{fiche.presences.phrase}</Text>

      {fiche.presences.monPlayerId && !fiche.passee && (
        <View style={s.reponses}>
          {(
            [
              ["IN", "Je viens"],
              ["MAYBE", "Peut-être"],
              ["OUT", "Pas là"],
            ] as const
          ).map(([v, l]) => {
            const actif = fiche.presences.maReponse === v;
            return (
              <Pressable
                key={v}
                onPress={() => void repondre(v)}
                disabled={envoi}
                style={[
                  s.reponse,
                  actif
                    ? { backgroundColor: t.bt ?? "#fff", borderColor: "transparent" }
                    : { borderColor: t.cb, backgroundColor: t.seg },
                ]}
              >
                <Text
                  style={[s.reponseTexte, { color: actif ? (t.bf ?? "#111") : t.ink }]}
                  numberOfLines={1}
                >
                  {l}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {fiche.terrain.resume && (
        <Text style={[s.phrase, { color: t.i2, paddingTop: 10 }]}>{fiche.terrain.resume}</Text>
      )}

      {fiche.presences.lignes.map((l, i) => (
        <View
          key={l.playerId}
          style={[s.rangee, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.sep }]}
        >
          <Avatar
            nom={l.nom}
            photo={l.photo}
            t={t}
            anneau={l.camp === "A" ? (t.taR ?? couleurA) : l.camp === "B" ? (t.tbR ?? couleurB) : undefined}
            taille={32}
          />
          <Text style={[s.nomLigne, { color: l.moi ? t.ink : t.i2 }]} numberOfLines={1}>
            {l.nom}
            {l.moi ? " · moi" : ""}
            {l.viaAbonnement ? " · abonné" : ""}
          </Text>
          <Text style={[s.statut, { color: tonCouleur(l.ton, t) }]}>{l.libelle}</Text>
        </View>
      ))}
    </View>
  );

  const resultats = fiche?.bilan && (
    <View style={[s.carte, { borderColor: t.cb, backgroundColor: t.cdSolid }]}>
      <Text style={[s.carteTitre, { color: t.ink }]}>
        Bilan{fiche.bilan.enCours ? " · en cours" : ""}
      </Text>
      <View style={s.bilan}>
        <View style={s.bilanCote}>
          <EcussonChasuble couleur={couleurA} lettre={fiche.chasubles.a.lettre} taille={56} />
          <Text style={[s.bilanChiffre, { color: t.ink }]}>{fiche.bilan.victoiresA}</Text>
          <Text style={[s.bilanUnite, { color: t.i3 }]}>{fiche.bilan.uniteA}</Text>
        </View>
        <View style={s.bilanCote}>
          <EcussonChasuble couleur={couleurB} lettre={fiche.chasubles.b.lettre} taille={56} />
          <Text style={[s.bilanChiffre, { color: t.ink }]}>{fiche.bilan.victoiresB}</Text>
          <Text style={[s.bilanUnite, { color: t.i3 }]}>{fiche.bilan.uniteB}</Text>
        </View>
      </View>
      <Text style={[s.phrase, { color: t.i2, textAlign: "center" }]}>{fiche.bilan.resume}</Text>
      {(fiche.bilan.buteur || fiche.bilan.mvp) && (
        <Text style={[s.phrase, { color: t.i3, textAlign: "center", paddingTop: 4 }]}>
          {fiche.bilan.buteur ? `Buteur : ${fiche.bilan.buteur.nom} (${fiche.bilan.buteur.buts})` : ""}
          {fiche.bilan.buteur && fiche.bilan.mvp ? " · " : ""}
          {fiche.bilan.mvp ? `Homme du match : ${fiche.bilan.mvp.nom}` : ""}
        </Text>
      )}
    </View>
  );

  // --- La composition préparée -------------------------------------------
  //
  // Les équipes décidées trois ou quatre jours avant, sur WhatsApp. Elles
  // vivent sur la SOIRÉE et pas sur un match : une soirée enchaîne quatre à
  // huit matchs avec les deux mêmes équipes, et chacun en hérite.
  //
  // Modifiable par qui peut MARQUER, pas seulement par un gérant — c'est la
  // règle du site (app/actions/compo.ts:31 refuse sur !canScore). Deux droits
  // pour un même geste selon l'appareil n'aurait aucun sens.
  const tousCompo = fiche?.compo.joueurs ?? [];
  const enA = tousCompo.filter((j) => camps[j.playerId] === "A");
  const enB = tousCompo.filter((j) => camps[j.playerId] === "B");
  const horsCompo = tousCompo.filter((j) => !camps[j.playerId]);
  const modifiable = Boolean(fiche?.peutScorer) && !fiche?.annulee;

  // Les trois mêmes avertissements que le site. Ils ne BLOQUENT pas : une compo
  // à sept contre six est parfois ce qu'on veut, et un écran qui refuse
  // d'enregistrer ce qu'on lui demande est pire qu'un écran qui prévient.
  const alertes: string[] = [];
  if (enA.length !== enB.length) {
    alertes.push(`Effectif déséquilibré : ${enA.length} contre ${enB.length}.`);
  }
  if (enA.length === 0 || enB.length === 0) alertes.push("Une équipe est vide.");
  const sansG = [
    enA.length > 0 && !enA.some((j) => gardiens[j.playerId]) ? fiche?.compo.nomA : null,
    enB.length > 0 && !enB.some((j) => gardiens[j.playerId]) ? fiche?.compo.nomB : null,
  ].filter(Boolean);
  if (sansG.length > 0) alertes.push(`Pas de gardien chez ${sansG.join(" et ")}.`);

  /// Un tap fait tourner le joueur : hors compo → A → B → hors compo. Le même
  /// geste que `/compo` et que le site — on ne réinvente pas un geste que le
  /// club connaît déjà.
  function tourner(playerId: string) {
    setCamps((c) => {
      const a = c[playerId];
      return { ...c, [playerId]: a === "A" ? "B" : a === "B" ? null : "A" };
    });
    setMotCompo(null);
  }

  function basculerGardien(playerId: string) {
    setGardiens((g) => ({ ...g, [playerId]: !g[playerId] }));
    setMotCompo(null);
  }

  function equilibrer() {
    const retenus = tousCompo.filter((j) => camps[j.playerId]);
    // Moins de deux joueurs : le moteur rendrait une équipe vide et l'autre
    // pleine. Mieux vaut ne rien faire que défaire ce qui a été posé.
    if (retenus.length < 2) return;
    const r = balanceTeams(
      retenus.map((j) => ({
        id: j.playerId,
        name: j.nom,
        skill: j.niveau,
        isGk: gardiens[j.playerId] ?? j.gardien,
      })),
      { seed: graine },
    );
    const neuf: Record<string, "A" | "B" | null> = { ...camps };
    for (const p of r.teamA) neuf[p.id] = "A";
    for (const p of r.teamB) neuf[p.id] = "B";
    setCamps(neuf);
    setGraine((g) => g + 1);
    setMotCompo(null);
  }

  async function enregistrerLaCompo() {
    if (!fiche || !club) return;
    setEnvoiCompo(true);
    try {
      const joueurs = tousCompo
        .filter((j) => camps[j.playerId] === "A" || camps[j.playerId] === "B")
        .map((j) => ({
          playerId: j.playerId,
          team: camps[j.playerId] as "A" | "B",
          isGk: Boolean(gardiens[j.playerId]),
        }));
      await local.enregistrerCompo(club, fiche.id, joueurs);
      // On relance tout de suite : avec du réseau c'est parti avant que le
      // doigt ait quitté l'écran ; sans réseau, ça attend sans rien perdre.
      void drain.relancer();
      setMotCompo("Compo enregistrée.");
    } catch (e) {
      setMotCompo(e instanceof Error ? e.message : String(e));
    } finally {
      setEnvoiCompo(false);
    }
  }

  const ligneJoueur = (j: (typeof tousCompo)[number], place: boolean) => (
    <View key={j.playerId} style={s.compoJoueur}>
      <Pressable
        onPress={modifiable ? () => tourner(j.playerId) : undefined}
        disabled={!modifiable}
        style={s.compoTape}
        hitSlop={6}
      >
        <Avatar nom={j.nom} photo={j.photo} t={t} taille={24} />
        <Text style={[s.compoJoueurNom, { color: t.i2 }]} numberOfLines={1}>
          {j.nom}
        </Text>
      </Pressable>
      {place && (
        <Pressable
          onPress={modifiable ? () => basculerGardien(j.playerId) : undefined}
          disabled={!modifiable}
          hitSlop={8}
          style={[
            s.compoG,
            gardiens[j.playerId]
              ? { backgroundColor: t.bt ?? "#fff", borderColor: "transparent" }
              : { borderColor: t.cb },
          ]}
        >
          <Text
            style={[
              s.compoGTexte,
              { color: gardiens[j.playerId] ? (t.bf ?? "#111") : t.i3 },
            ]}
          >
            G
          </Text>
        </Pressable>
      )}
    </View>
  );

  const composition = fiche && !fiche.annulee && (
    <View style={[s.carte, { borderColor: t.cb, backgroundColor: t.cdSolid }]}>
      <Text style={[s.carteTitre, { color: t.ink }]}>Composition</Text>

      <View style={s.compo}>
        {[
          { camp: "A" as const, nom: fiche.compo.nomA, couleur: couleurA, lettre: fiche.chasubles.a.lettre, gens: enA },
          { camp: "B" as const, nom: fiche.compo.nomB, couleur: couleurB, lettre: fiche.chasubles.b.lettre, gens: enB },
        ].map((cote) => (
          <View key={cote.camp} style={s.compoCote}>
            <EcussonChasuble couleur={cote.couleur} lettre={cote.lettre} taille={40} />
            <Text style={[s.compoNom, { color: t.ink }]} numberOfLines={1}>
              {cote.nom} · {cote.gens.length}
            </Text>
            {cote.gens.map((j) => ligneJoueur(j, true))}
            {cote.gens.length === 0 && (
              <Text style={[s.phrase, { color: t.i3 }]}>personne</Text>
            )}
          </View>
        ))}
      </View>

      {alertes.length > 0 && (
        <Text style={[s.phrase, { color: t.i3, textAlign: "center", paddingTop: 8 }]}>
          {alertes.join(" ")}
        </Text>
      )}

      {modifiable ? (
        <>
          {horsCompo.length > 0 && (
            <View style={s.compoBanc}>
              <Text style={[s.kicker, { color: t.i3 }]}>
                Hors compo · {horsCompo.length} — touche pour placer
              </Text>
              {horsCompo.map((j) => ligneJoueur(j, false))}
            </View>
          )}

          <View style={s.compoBoutons}>
            <Pressable
              onPress={equilibrer}
              style={[s.compoBouton, { borderColor: t.cb, backgroundColor: t.seg }]}
            >
              <Text style={{ color: t.ink, fontSize: 15, fontWeight: "600" }}>Équilibrer</Text>
            </Pressable>
            <Pressable
              onPress={() => void enregistrerLaCompo()}
              disabled={envoiCompo}
              style={[
                s.compoBouton,
                { backgroundColor: t.bt ?? "#fff", borderColor: "transparent" },
              ]}
            >
              <Text style={{ color: t.bf ?? "#111", fontSize: 15, fontWeight: "700" }}>
                {envoiCompo ? "…" : "Enregistrer la compo"}
              </Text>
            </Pressable>
          </View>

          {motCompo && (
            <Text style={[s.phrase, { color: t.i2, textAlign: "center", paddingTop: 8 }]}>
              {motCompo}
            </Text>
          )}
        </>
      ) : (
        !fiche.compo.faite && (
          <Text style={[s.phrase, { color: t.i2, textAlign: "center" }]}>
            Les équipes ne sont pas encore faites.
          </Text>
        )
      )}
    </View>
  );

  return (
    <Ecran t={t} chasubles={{ a: couleurA, b: couleurB }}>
      <View style={s.barre}>
        <BoutonRond t={t} symbole="‹" etiquette="Retour" onPress={() => router.back()} />
      </View>

      <ScrollView
        contentContainerStyle={s.contenu}
        refreshControl={
          <RefreshControl refreshing={occupe && fiche != null} onRefresh={charger} tintColor={t.i2} />
        }
      >
        {occupe && !fiche && (
          <View style={s.centre}>
            <ActivityIndicator color={t.ink} />
            <Text style={[s.phrase, { color: t.i2 }]}>Un instant…</Text>
          </View>
        )}
        {erreur && <Text style={[s.erreur, { color: "#ff453a" }]}>{erreur}</Text>}

        {fiche && (
          <>
            <View>
              <Text style={[s.titre, { color: t.ink }]}>{fiche.dateLabel}</Text>
              <Text style={[s.phrase, { color: t.i2, paddingTop: 4 }]}>{fiche.sousTitre}</Text>
              {fiche.notes && (
                <Text style={[s.phrase, { color: t.i3, paddingTop: 6 }]}>{fiche.notes}</Text>
              )}
              {fiche.annulee && <Text style={[s.annulee]}>Soirée annulée</Text>}
            </View>

            {/* Dès qu'un match existe, les résultats passent devant la
                préparation : la question n'est plus « qui vient » mais
                « qu'est-ce qui s'est passé ». */}
            {fiche.commencee ? (
              <>
                {resultats}
                {presences}
              </>
            ) : (
              presences
            )}

            {composition}

            {fiche.mot && (
              <View style={[s.carte, { borderColor: t.cb, backgroundColor: t.cdSolid }]}>
                <Text style={[s.carteTitre, { color: t.ink }]}>Le mot de la soirée</Text>
                <Text style={[s.mot, { color: t.i2 }]}>{fiche.mot}</Text>
                <Pressable
                  onPress={partagerLeMot}
                  style={[s.partager, { borderColor: t.cb, backgroundColor: t.seg }]}
                >
                  <Text style={{ color: t.ink, fontSize: 15, fontWeight: "600" }}>Partager</Text>
                </Pressable>
              </View>
            )}

            {fiche.matchs.length > 0 && (
              <View style={[s.carte, { borderColor: t.cb, backgroundColor: t.cdSolid }]}>
                <Text style={[s.carteTitre, { color: t.ink }]}>Les matchs</Text>
                {fiche.matchs.map((m, i) => (
                  <Pressable
                    key={m.id}
                    onPress={() =>
                      router.push(
                        m.direct
                          ? { pathname: "/match/[id]", params: { id: m.id } }
                          : { pathname: "/recap/[id]", params: { id: m.id, clubId: club ?? "" } },
                      )
                    }
                    style={({ pressed }) => [
                      s.match,
                      i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.sep },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <View style={s.matchTete}>
                      <Text style={[s.matchHeure, { color: t.i2 }]}>{m.heure}</Text>
                      <Text style={[s.matchScore, { color: t.ink }]}>
                        {m.nomA} {m.aVenir ? "·" : m.scoreA} – {m.aVenir ? "·" : m.scoreB} {m.nomB}
                      </Text>
                      <Text style={[s.matchEtat, { color: m.direct ? "#ff453a" : t.i3 }]}>
                        {m.etat}
                      </Text>
                    </View>
                    {m.pied && (
                      <Text style={[s.matchPied, { color: t.i3 }]} numberOfLines={2}>
                        {m.pied}
                      </Text>
                    )}
                  </Pressable>
                ))}
              </View>
            )}

            {fiche.cracks.length > 0 && (
              <View style={[s.carte, { borderColor: t.cb, backgroundColor: t.cdSolid }]}>
                <Text style={[s.carteTitre, { color: t.ink }]}>Les cracks du soir</Text>
                {fiche.cracks.map((c, i) => (
                  <View
                    key={c.playerId}
                    style={[s.rangee, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.sep }]}
                  >
                    <Text style={[s.rang, { color: t.i3 }]}>{c.rang}</Text>
                    <Avatar nom={c.nom} photo={c.photo} t={t} taille={28} />
                    <Text style={[s.nomLigne, { color: t.ink }]} numberOfLines={1}>
                      {c.nom}
                      {c.invite ? " (inv.)" : ""}
                    </Text>
                    <Text style={[s.chiffre, { color: t.i2 }]}>{c.buts} b</Text>
                    <Text style={[s.chiffre, { color: t.ink, fontWeight: "700" }]}>{c.points}</Text>
                  </View>
                ))}
              </View>
            )}

            {fiche.terrain.visible && fiche.terrain.prix && (
              <View style={[s.carte, { borderColor: t.cb, backgroundColor: t.cdSolid }]}>
                <Text style={[s.carteTitre, { color: t.ink }]}>Le terrain</Text>
                <Text style={[s.phrase, { color: t.i2, textAlign: "center" }]}>
                  {fiche.terrain.encaisse} encaissés sur {fiche.terrain.prix}
                  {fiche.terrain.part ? ` · ${fiche.terrain.part} chacun` : ""}
                </Text>
                <View style={[s.jauge, { backgroundColor: t.seg }]}>
                  <View
                    style={[
                      s.jaugePleine,
                      { width: `${fiche.terrain.pourcentage}%`, backgroundColor: "#ffd60a" },
                    ]}
                  />
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </Ecran>
  );
}

function tonCouleur(ton: string, t: Jetons): string {
  if (ton === "in") return t.ink;
  if (ton === "maybe") return "#ffd60a";
  if (ton === "out") return "#ff453a";
  if (ton === "attente") return t.i2;
  return t.i3;
}

const s = StyleSheet.create({
  barre: { paddingHorizontal: 14, paddingTop: 8 },
  contenu: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 40, gap: 18 },
  centre: { paddingTop: 60, alignItems: "center", gap: 12 },
  titre: { fontSize: 28, fontWeight: "700", letterSpacing: -0.4 },
  phrase: { fontSize: 15 },
  erreur: { fontSize: 15, textAlign: "center" },
  annulee: { fontSize: 15, fontWeight: "600", color: "#ff453a", paddingTop: 6 },

  carte: {
    borderRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
  },
  carteTitre: { fontSize: 22, fontWeight: "600", textAlign: "center", paddingBottom: 10 },

  reponses: { flexDirection: "row", gap: 8, paddingTop: 4, paddingBottom: 4 },
  reponse: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  reponseTexte: { fontSize: 15, fontWeight: "600" },

  rangee: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52 },
  rang: { width: 18, fontSize: 13 },
  nomLigne: { flex: 1, fontSize: 16 },
  statut: { fontSize: 14, fontWeight: "600" },
  chiffre: { width: 40, fontSize: 14, textAlign: "right" },

  compo: { flexDirection: "row", gap: 12, paddingVertical: 4 },
  compoCote: { flex: 1, alignItems: "center", gap: 8 },
  compoNom: { fontSize: 15, fontWeight: "700" },
  compoJoueur: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "stretch" },
  compoJoueurNom: { flex: 1, fontSize: 14 },
  compoTape: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minHeight: 34 },
  compoG: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  compoGTexte: { fontSize: 12, fontWeight: "700" },
  compoBanc: { paddingTop: 12, gap: 2 },
  kicker: { fontSize: 12, fontWeight: "600", letterSpacing: 0.4, paddingBottom: 4 },
  compoBoutons: { flexDirection: "row", gap: 8, paddingTop: 14 },
  compoBouton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  bilan: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 6 },
  bilanCote: { alignItems: "center", gap: 6 },
  bilanChiffre: { fontSize: 40, fontWeight: "800", letterSpacing: -1.5 },
  bilanUnite: { fontSize: 13 },

  mot: { fontSize: 14, lineHeight: 20, paddingBottom: 12 },
  partager: {
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  match: { paddingVertical: 12, gap: 4 },
  matchTete: { flexDirection: "row", alignItems: "center", gap: 10 },
  matchHeure: { fontSize: 14, width: 46 },
  matchScore: { flex: 1, fontSize: 16, fontWeight: "600" },
  matchEtat: { fontSize: 13, fontWeight: "600" },
  matchPied: { fontSize: 13, paddingLeft: 56 },

  jauge: { height: 8, borderRadius: 4, overflow: "hidden", marginTop: 10 },
  jaugePleine: { height: 8, borderRadius: 4 },
});
