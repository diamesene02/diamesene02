"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import LiveMatch from "@/app/c/[slug]/matches/[id]/live/LiveMatch";
import Icon from "@/components/Icon";
import { cn } from "@/lib/cn";
import {
  createMatch,
  getLiveMatchOfClub,
  getLocalClub,
  getLocalMatch,
  pendingOpsForMatch,
} from "@/lib/localMatch";
import { getDb } from "@/lib/db";
import { kickSync } from "@/lib/sync";

// La coquille de match. Elle ne demande RIEN au serveur.
//
// Tout le parcours du lundi soir — coup d'envoi, buts, fin, on rejoue —
// passait par des pages serveur adressées par un identifiant. Or un match
// créé hors-ligne a un identifiant que le serveur ne connaît pas : sa page ne
// pouvait pas exister, et tout cache par URL était impuissant. Cet écran est
// le même pour tous les matchs du club : le service worker le garde en cache
// à chaque visite en ligne, et le match vient de Dexie.
//
// L'identifiant se lit dans ?m=, ou dans le chemin /matches/:id (le service
// worker sert cette page à la place d'une page live injoignable), ou à défaut
// c'est le match LIVE du club — c'est ainsi qu'on retrouve son match après
// que le téléphone a tué l'onglet.

type Settings = {
  trackAssists: boolean;
  trackCards: boolean;
  motmMode: "VOTE" | "ADMIN" | "OFF";
  matchDurationMin: number;
};

type Fiche = {
  id: string;
  name: string;
  nickname: string | null;
  skill: number;
  isGk: boolean;
  isGuest: boolean;
};

function idDepuisUrl(): string | null {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search).get("m");
  if (q) return q;
  const m = window.location.pathname.match(/\/matches\/([^/]+)/);
  return m ? m[1] : null;
}

export default function PlayShell({
  slug,
  clubId,
  settings: settingsServeur,
  vivier,
}: {
  slug: string;
  clubId: string;
  settings: Settings;
  vivier: Fiche[];
}) {
  const [matchId, setMatchId] = useState<string | null>(null);
  const [resolu, setResolu] = useState(false);
  const [phase, setPhase] = useState<"live" | "recap">("live");
  const [settings, setSettings] = useState<Settings>(settingsServeur);

  // Les réglages du club en cache local priment : ce sont eux qui sont à jour
  // hors-ligne, la page HTML en cache pouvant dater.
  useEffect(() => {
    let vivant = true;
    void getLocalClub(clubId).then((c) => {
      if (!vivant || !c) return;
      setSettings({
        trackAssists: c.trackAssists,
        trackCards: c.trackCards,
        motmMode: c.motmMode,
        matchDurationMin: c.matchDurationMin,
      });
    });
    return () => {
      vivant = false;
    };
  }, [clubId]);

  useEffect(() => {
    let vivant = true;
    (async () => {
      const depuisUrl = idDepuisUrl();
      if (depuisUrl) {
        if (vivant) {
          setMatchId(depuisUrl);
          setResolu(true);
        }
        return;
      }
      const live = await getLiveMatchOfClub(clubId);
      if (!vivant) return;
      setMatchId(live?.id ?? null);
      setResolu(true);
    })();
    return () => {
      vivant = false;
    };
  }, [clubId]);

  const onFinished = useCallback((id: string) => {
    setMatchId(id);
    setPhase("recap");
  }, []);

  const rejouer = useCallback(async () => {
    if (!matchId) return;
    const db = getDb();
    const [match, parts] = await Promise.all([
      db.matches.get(matchId),
      db.participants.where("matchId").equals(matchId).toArray(),
    ]);
    if (!match) return;
    const id = await createMatch({
      clubId: match.clubId,
      matchDayId: match.matchDayId ?? null,
      seasonId: match.seasonId ?? null,
      kind: match.kind,
      opponentId: match.opponentId ?? null,
      teamAName: match.teamAName,
      teamBName: match.teamBName,
      teamA: parts
        .filter((p) => p.team === "A")
        .map((p) => ({ playerId: p.playerId, isGk: p.isGk })),
      teamB: parts
        .filter((p) => p.team === "B")
        .map((p) => ({ playerId: p.playerId, isGk: p.isGk })),
    });
    void kickSync();
    window.history.replaceState(null, "", `/c/${slug}/play?m=${id}`);
    setMatchId(id);
    setPhase("live");
  }, [matchId, slug]);

  if (!resolu) {
    return (
      <main className="fixed inset-0 z-[60] grid place-items-center bg-[color:var(--pitch-0)] text-[color:var(--ink-3)]">
        Chargement…
      </main>
    );
  }

  if (!matchId) {
    return (
      <main className="fixed inset-0 z-[60] bg-[color:var(--pitch-0)] px-5 pt-16">
        <div className="bande creuse">
          <h1 className="display-md">Aucun match en cours.</h1>
          <p className="mt-3 text-[color:var(--ink-2)]">
            Rien dans la mémoire de ce téléphone. Le coup d&apos;envoi se donne
            depuis l&apos;accueil du club.
          </p>
          <Link href={`/c/${slug}`} className="btn primary big mt-6 w-full">
            Accueil du club
          </Link>
        </div>
      </main>
    );
  }

  if (phase === "recap") {
    return (
      <RecapLocal
        slug={slug}
        matchId={matchId}
        onRejouer={rejouer}
        onReprendre={() => setPhase("live")}
      />
    );
  }

  return (
    <LiveMatch
      key={matchId}
      slug={slug}
      matchId={matchId}
      clubId={clubId}
      vivier={vivier}
      settings={settings}
      onFinished={onFinished}
    />
  );
}

/// Le récap qu'on lit au bord du terrain, entre deux matchs. Il vient de
/// Dexie ; le récap complet du serveur n'est proposé que lorsque la file
/// d'envoi de ce match est vide — avant, le serveur ne sait pas tout.
function RecapLocal({
  slug,
  matchId,
  onRejouer,
  onReprendre,
}: {
  slug: string;
  matchId: string;
  onRejouer: () => void;
  onReprendre: () => void;
}) {
  const data = useLiveQuery(() => getLocalMatch(matchId), [matchId]);
  const enAttente = useLiveQuery(() => pendingOpsForMatch(matchId), [matchId]);
  const [busy, setBusy] = useState(false);

  if (!data) {
    return (
      <main className="fixed inset-0 z-[60] grid place-items-center bg-[color:var(--pitch-0)] text-[color:var(--ink-3)]">
        Chargement…
      </main>
    );
  }
  const { match, teamA, teamB, events } = data;
  const aGagne = match.scoreA > match.scoreB;
  const bGagne = match.scoreB > match.scoreA;
  const buteurs = events.filter((e) => e.type === "GOAL" || e.type === "OWN_GOAL");
  const tousSyncs = (enAttente ?? 1) === 0;

  return (
    <main className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-[color:var(--pitch-0)]">
      <div className="contexte px-4 pt-[calc(var(--safe-t)+8px)]">
        Fin du match
        {!tousSyncs && (
          <span className="ml-auto normal-case tracking-normal text-[color:var(--gold)]">
            {enAttente} à envoyer
          </span>
        )}
      </div>

      <header className="panneau" style={{ position: "static" }}>
        <div className="panneau-bande A" />
        <div className="panneau-camp A">
          <span className="panneau-code">{match.teamAName}</span>
          <span className={cn("chiffre-panneau panneau-score", bGagne && "perd")}>
            {match.scoreA}
          </span>
        </div>
        <div className="panneau-axe" />
        <div className="panneau-camp B">
          <span className="panneau-code">{match.teamBName}</span>
          <span className={cn("chiffre-panneau panneau-score", aGagne && "perd")}>
            {match.scoreB}
          </span>
        </div>
        <div className="panneau-bande B" />
        <div className="panneau-pied">
          <span className="text-[13px] text-[color:var(--ink-3)]">
            {aGagne
              ? `${match.teamAName} l'emporte`
              : bGagne
                ? `${match.teamBName} l'emporte`
                : "Match nul"}
          </span>
        </div>
      </header>

      <section className="px-4 pt-6">
        <div className="kicker mb-2">Buteurs</div>
        {buteurs.length === 0 ? (
          <p className="text-[color:var(--ink-3)]">Aucun but.</p>
        ) : (
          <ul>
            {buteurs.map((e) => (
              <li key={e.id} className="timeline-row">
                <span className="timeline-minute">
                  {e.minute != null ? `${e.minute}'` : "—"}
                </span>
                <span
                  className={cn(
                    "timeline-scorer",
                    e.team === "A" ? "text-[color:var(--bib-a-ink)]" : "text-[color:var(--bib-b-ink)]"
                  )}
                >
                  {e.playerName ??
                    (e.type === "OWN_GOAL"
                      ? `csc de ${e.team === "B" ? match.teamAName : match.teamBName}`
                      : e.team === "B"
                        ? match.teamBName
                        : match.teamAName)}
                  {e.type === "OWN_GOAL" && e.playerName && " (csc)"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-auto px-4 pb-[calc(var(--safe-b)+16px)] pt-8">
        <button
          onClick={async () => {
            setBusy(true);
            try {
              await onRejouer();
            } finally {
              setBusy(false);
            }
          }}
          disabled={busy || teamA.length === 0 || teamB.length === 0}
          className="btn primary big w-full disabled:opacity-60"
        >
          <Icon name="play" size={16} />
          {busy ? "Coup d'envoi…" : "On rejoue — mêmes équipes"}
        </button>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={onReprendre} className="btn ghost tap">
            Rouvrir le match
          </button>
          {tousSyncs ? (
            <Link href={`/c/${slug}/matches/${matchId}`} className="btn ghost tap">
              Récap complet
            </Link>
          ) : (
            <Link href={`/c/${slug}`} className="btn ghost tap">
              Accueil
            </Link>
          )}
        </div>
        {!tousSyncs && (
          <p className="mt-3 text-center text-[13px] text-[color:var(--ink-3)]">
            Le récap complet arrive dès que tout est envoyé.
          </p>
        )}
      </section>
    </main>
  );
}
