"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createMatch, saveRoster } from "@/lib/localMatch";
import { kickSync } from "@/lib/sync";
import Icon from "@/components/Icon";

type Joueur = {
  id: string;
  name: string;
  nickname?: string | null;
  skill: number;
  /// Gardien attitré du club — attribut permanent du joueur.
  estGardien: boolean;
  /// Gardien DANS le match qu'on rejoue — rôle d'un soir. Les deux étaient
  /// confondus : le rôle du match était recopié dans le cache roster et
  /// écrasait le statut permanent, si bien qu'un joueur de champ ayant pris
  /// les gants une fois devenait gardien attitré pour le générateur d'équipes.
  gardienCeMatch: boolean;
  isGuest: boolean;
  team: "A" | "B";
};

/// « On rejoue » — le geste le plus fréquent d'une soirée, et le seul qui
/// n'existait pas.
///
/// Une soirée de five, c'est quatre à huit matchs. L'app n'en connaissait
/// qu'un : chaque match suivant repassait par l'écran de composition complet,
/// alors que les équipes venaient d'être décidées et jouées. Le coût du
/// premier match était payé autant de fois qu'il y avait de matchs.
///
/// Le nouveau match hérite de la soirée, de la saison, des noms d'équipe et
/// de la composition exacte. Il naît LIVE : plus rien entre le tap et le
/// coup d'envoi.
export default function RematchButton({
  clubId,
  slug,
  players,
  teamAName,
  teamBName,
  kind,
  opponentId,
  matchDayId,
  seasonId,
  label = "On rejoue — mêmes équipes",
  hint,
}: {
  clubId: string;
  slug: string;
  players: Joueur[];
  teamAName: string;
  teamBName: string;
  kind: "INTERNAL" | "EXTERNAL";
  opponentId: string | null;
  matchDayId: string | null;
  seasonId: string | null;
  /// Le même geste sert deux endroits : « on rejoue » au bas d'un récap, et le
  /// coup d'envoi depuis l'accueil quand personne n'a fait la feuille.
  label?: string;
  /// Qui va jouer, annoncé avant le tap : un lancement en un geste ne doit pas
  /// être un lancement à l'aveugle.
  hint?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function rejouer() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      // Le cache roster hors-ligne n'était amorcé que par l'écran de
      // composition. Un match lancé d'ici sans passer par lui affichait des
      // tuiles nommées « ? ». On l'amorce donc avec les joueurs de la page.
      await saveRoster(
        clubId,
        players.map((p) => ({
          id: p.id,
          name: p.name,
          nickname: p.nickname ?? null,
          skill: p.skill,
          isGk: p.estGardien,
          isGuest: p.isGuest,
        })),
      );
      const matchId = await createMatch({
        clubId,
        matchDayId,
        seasonId,
        kind,
        opponentId,
        teamAName,
        teamBName,
        teamA: players
          .filter((p) => p.team === "A")
          .map((p) => ({ playerId: p.id, isGk: p.gardienCeMatch })),
        teamB: players
          .filter((p) => p.team === "B")
          .map((p) => ({ playerId: p.id, isGk: p.gardienCeMatch })),
      });
      void kickSync();
      router.replace(`/c/${slug}/matches/${matchId}/live`);
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }

  return (
    <div className="mt-3">
      <button
        onClick={rejouer}
        disabled={busy}
        className="btn primary big w-full disabled:opacity-60"
      >
        <Icon name="play" size={16} />
        {busy ? "Coup d'envoi…" : label}
      </button>
      {hint && (
        <p className="mt-2 text-center text-sm text-[color:var(--ink-2)]">
          {hint}
        </p>
      )}
      {error && (
        <p className="mt-2 text-center text-sm text-[color:var(--loss)]">
          {error}
        </p>
      )}
    </div>
  );
}
