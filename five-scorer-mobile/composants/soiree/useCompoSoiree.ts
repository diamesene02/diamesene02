import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { balanceTeams } from "../../lib/noyau/balance";
import { useNoyau } from "../Noyau";
import { choix, leger, succes } from "../../lib/haptique";
import { messageErreur } from "../../lib/erreurs";
import type { FicheSoiree } from "../../lib/api";
import { avecDelai, compoModifiee, type Camp, type Statut } from "./logique";

type Reference = {
  joueurs: { playerId: string; camp: Camp | null; gardienSoiree: boolean }[];
  nomA: string;
  nomB: string;
};

export type MessageCompo = { texte: string; ton: "ok" | "attente" | "erreur" };

/// La compo préparée d'une soirée, telle qu'on la touche à l'écran.
///
/// Elle vit ici et pas dans la carte : l'écran en a besoin pour demander,
/// avant de partir, si on garde ce qu'on vient de composer.
///
/// Elle part dans la file d'attente à l'ENREGISTREMENT, pas à chaque tap :
/// composer est un brouillon, et un brouillon ne doit pas produire quinze
/// opérations. La file protège le réseau qui tombe entre la composition et
/// l'enregistrement — le métro, l'ascenseur.
///
/// « Modifiée » se juge contre la DERNIÈRE compo connue — celle du serveur,
/// ou celle qu'on vient d'enregistrer et qui attend encore dans la file. Une
/// fiche relue du serveur avant que la file se soit vidée montrerait
/// l'ancienne compo : on ne la reprend donc pas tant qu'un envoi attend.
export function useCompoSoiree({
  fiche,
  clubId,
  recharger,
}: {
  fiche: FicheSoiree | null;
  clubId: string | null;
  recharger: () => unknown;
}) {
  const { local, drain } = useNoyau();
  const [camps, setCamps] = useState<Record<string, Camp | null>>({});
  const [gardiens, setGardiens] = useState<Record<string, boolean>>({});
  const [nomA, setNomA] = useState("");
  const [nomB, setNomB] = useState("");
  const [reference, setReference] = useState<Reference | null>(null);
  const [cible, setCible] = useState<Camp>("A");
  // Le générateur est déterministe : repartir de la même graine à chaque
  // ouverture rejouerait le tirage de la fois d'avant.
  const [graine, setGraine] = useState(() => Math.floor(Math.random() * 1_000_000) + 1);
  const [tire, setTire] = useState(false);
  const [eclair, setEclair] = useState<{ playerId: string; n: number } | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState<MessageCompo | null>(null);
  /// Une compo enregistrée qui n'est pas encore arrivée au serveur.
  const enFile = useRef(false);
  /// « Compo précédente » : la prochaine fiche remplace l'écran, retouches
  /// comprises.
  const forcer = useRef(false);

  const joueurs = useMemo(() => fiche?.compo.joueurs ?? [], [fiche]);

  const modifie = reference
    ? compoModifiee({ camps, gardiens, nomA, nomB }, reference)
    : false;
  const modifieRef = useRef(modifie);
  modifieRef.current = modifie;

  // La fiche arrive (ou revient) : on reprend ce que le serveur dit — y
  // compris le gardien DE LA SOIRÉE, sans quoi relire puis réécrire effacerait
  // le gardien désigné. Jamais par-dessus des retouches en cours.
  const signature = fiche
    ? fiche.compo.joueurs.map((j) => `${j.playerId}:${j.camp ?? "-"}:${j.gardienSoiree ? 1 : 0}`).join("|") +
      `|${fiche.compo.nomA}|${fiche.compo.nomB}`
    : "";
  useEffect(() => {
    if (!fiche) return;
    if (!forcer.current && (modifieRef.current || enFile.current)) return;
    forcer.current = false;
    const c: Record<string, Camp | null> = {};
    const g: Record<string, boolean> = {};
    for (const j of fiche.compo.joueurs) {
      c[j.playerId] = j.camp;
      // Un joueur pas encore placé entrera avec son rôle du club : le
      // gardien attitré arrive gardien, on le retire d'un tap s'il joue devant.
      g[j.playerId] = j.camp ? j.gardienSoiree : j.gardien;
    }
    setCamps(c);
    setGardiens(g);
    setNomA(fiche.compo.nomA);
    setNomB(fiche.compo.nomB);
    setReference({
      joueurs: fiche.compo.joueurs.map((j) => ({
        playerId: j.playerId,
        camp: j.camp,
        gardienSoiree: j.gardienSoiree,
      })),
      nomA: fiche.compo.nomA,
      nomB: fiche.compo.nomB,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  // La file s'est vidée : ce qu'on a enregistré est au serveur, on relit.
  useEffect(
    () =>
      drain.abonner((e) => {
        if (!enFile.current || e.enAttente > 0 || e.bloquees > 0) return;
        enFile.current = false;
        void recharger();
      }),
    [drain, recharger],
  );

  const presenceDe = useMemo(() => {
    const m = new Map<string, { statut: Statut | null; enAttente: boolean }>();
    for (const l of fiche?.presences.lignes ?? []) {
      m.set(l.playerId, { statut: l.statut, enAttente: l.enAttente });
    }
    return m;
  }, [fiche]);

  const retoucher = () => setMessage(null);
  const eclairer = (playerId: string) => setEclair((e) => ({ playerId, n: (e?.n ?? 0) + 1 }));

  /// Sur la pelouse : un tap, et il passe dans l'autre équipe.
  function changerDEquipe(playerId: string) {
    retoucher();
    choix();
    setCamps((c) => ({ ...c, [playerId]: c[playerId] === "A" ? "B" : "A" }));
    eclairer(playerId);
  }

  /// Hors compo : il entre dans l'équipe choisie en tête de carte.
  function faireEntrer(playerId: string) {
    retoucher();
    choix();
    setCamps((c) => ({ ...c, [playerId]: cible }));
    eclairer(playerId);
  }

  function retirer(playerId: string) {
    retoucher();
    leger();
    setCamps((c) => ({ ...c, [playerId]: null }));
  }

  function basculerGardien(playerId: string) {
    retoucher();
    choix();
    setGardiens((g) => ({ ...g, [playerId]: !g[playerId] }));
  }

  const placesDans = (camp: Camp) => joueurs.filter((j) => camps[j.playerId] === camp);

  /// Répartit les joueurs déjà retenus. Ne convoque personne : qui joue est
  /// une décision, pas un calcul.
  function equilibrer(): string | null {
    const retenus = joueurs.filter((j) => camps[j.playerId]);
    if (retenus.length < 2) return "Retiens d'abord les joueurs de la soirée.";
    retoucher();
    choix();
    const r = balanceTeams(
      retenus.map((j) => ({
        id: j.playerId,
        name: j.nom,
        skill: j.niveau,
        isGk: Boolean(gardiens[j.playerId]),
      })),
      { seed: graine },
    );
    setCamps((c) => {
      const n = { ...c };
      for (const p of r.teamA) n[p.id] = "A";
      for (const p of r.teamB) n[p.id] = "B";
      return n;
    });
    setGraine((g) => g + 1);
    setTire(true);
    return null;
  }

  /// Ceux qui ont dit présent et ne sont pas encore sur le terrain.
  const presentsDehors = joueurs.filter((j) => {
    const p = presenceDe.get(j.playerId);
    return !camps[j.playerId] && p?.statut === "IN" && !p.enAttente;
  });

  /// Le premier jet de la compo en un tap. Terrain vide : les présents sont
  /// aussitôt répartis. Compo commencée : chacun rejoint l'équipe la moins
  /// fournie, sans défaire ce que le capitaine a placé à la main.
  function placerLesPresents() {
    if (presentsDehors.length === 0) return;
    retoucher();
    choix();
    const a0 = placesDans("A").length;
    const b0 = placesDans("B").length;
    if (a0 + b0 === 0 && presentsDehors.length >= 2) {
      const r = balanceTeams(
        presentsDehors.map((j) => ({
          id: j.playerId,
          name: j.nom,
          skill: j.niveau,
          isGk: Boolean(gardiens[j.playerId]),
        })),
        { seed: graine },
      );
      setCamps((c) => {
        const n = { ...c };
        for (const p of r.teamA) n[p.id] = "A";
        for (const p of r.teamB) n[p.id] = "B";
        return n;
      });
      setGraine((g) => g + 1);
      setTire(true);
      return;
    }
    let a = a0;
    let b = b0;
    const ajouts: Record<string, Camp> = {};
    for (const j of presentsDehors) {
      const camp: Camp = a < b ? "A" : b < a ? "B" : cible;
      ajouts[j.playerId] = camp;
      if (camp === "A") a += 1;
      else b += 1;
    }
    setCamps((c) => ({ ...c, ...ajouts }));
  }

  /// Écrit la compo dans la file, puis tente de l'envoyer. Rend `true` dès
  /// qu'elle est sur le téléphone : à partir de là, rien ne se perd.
  const enregistrer = useCallback(async (): Promise<boolean> => {
    if (!fiche || !clubId) return false;
    if (!nomA.trim() || !nomB.trim()) {
      setMessage({ texte: "Donne un nom à chaque équipe.", ton: "erreur" });
      return false;
    }
    setEnvoi(true);
    setMessage(null);
    try {
      const liste = fiche.compo.joueurs
        .filter((j) => camps[j.playerId])
        .map((j) => ({
          playerId: j.playerId,
          team: camps[j.playerId] as Camp,
          isGk: Boolean(gardiens[j.playerId]),
        }));
      await local.enregistrerCompo(clubId, fiche.id, liste, {
        teamAName: nomA.trim(),
        teamBName: nomB.trim(),
      });
      enFile.current = true;
      setReference({
        joueurs: fiche.compo.joueurs.map((j) => ({
          playerId: j.playerId,
          camp: camps[j.playerId] ?? null,
          gardienSoiree: camps[j.playerId] ? Boolean(gardiens[j.playerId]) : false,
        })),
        nomA: nomA.trim(),
        nomB: nomB.trim(),
      });
      succes();
      // Avec du réseau, c'est parti avant que le doigt ait quitté l'écran ;
      // sans, ça attend dans la file sans rien perdre — et on le dit.
      await avecDelai(drain.relancer(), 6000).catch(() => {});
      const e = drain.etat();
      setMessage(
        e.enAttente > 0 || e.bloquees > 0 || !e.enLigne
          ? { texte: "Compo gardée sur le téléphone : elle partira dès que le réseau revient.", ton: "attente" }
          : { texte: "Compo enregistrée.", ton: "ok" },
      );
      return true;
    } catch (e) {
      setMessage({ texte: messageErreur(e), ton: "erreur" });
      return false;
    } finally {
      setEnvoi(false);
    }
  }, [fiche, clubId, camps, gardiens, nomA, nomB, local, drain]);

  /// Rend l'écran à la dernière compo connue.
  function jeter() {
    if (!reference) return;
    const c: Record<string, Camp | null> = {};
    const g: Record<string, boolean> = { ...gardiens };
    for (const j of reference.joueurs) {
      c[j.playerId] = j.camp;
      if (j.camp) g[j.playerId] = j.gardienSoiree;
    }
    setCamps(c);
    setGardiens(g);
    setNomA(reference.nomA);
    setNomB(reference.nomB);
  }

  /// « Compo précédente » vient de remplacer la compo côté serveur : la
  /// prochaine fiche s'impose, retouches comprises.
  function reprendreDuServeur() {
    forcer.current = true;
    enFile.current = false;
  }

  return {
    joueurs,
    camps,
    gardiens,
    nomA,
    nomB,
    setNomA: (v: string) => {
      retoucher();
      setNomA(v);
    },
    setNomB: (v: string) => {
      retoucher();
      setNomB(v);
    },
    cible,
    setCible: (c: Camp) => {
      if (c !== cible) choix();
      setCible(c);
    },
    tire,
    eclair,
    envoi,
    message,
    setMessage,
    modifie,
    presenceDe,
    presentsDehors,
    changerDEquipe,
    faireEntrer,
    retirer,
    basculerGardien,
    equilibrer,
    placerLesPresents,
    enregistrer,
    jeter,
    reprendreDuServeur,
  };
}

export type CompoSoiree = ReturnType<typeof useCompoSoiree>;
