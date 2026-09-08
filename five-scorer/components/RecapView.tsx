"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { lettre } from "@/lib/ini";
import Ecusson from "@/components/ios/Ecusson";
import AvatarAnneau from "@/components/ios/AvatarAnneau";
import PartageFeuille from "@/components/PartageFeuille";
import "./recap.css";

type Player = { id: string; name: string; goals: number; team: "A" | "B" };
type Goal = {
  id: string;
  scorerId: string;
  team: "A" | "B";
  minute: number | null;
  createdAt: string;
  scorerName: string;
  /// Le passeur, quand le club les compte.
  assistName?: string | null;
};
type Match = {
  id: string;
  playedAt: string;
  teamAName: string;
  teamBName: string;
  scoreA: number;
  scoreB: number;
  status: "LIVE" | "FINISHED";
  mvpId: string | null;
};

const Ballon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.4l3.9 2.8-1.5 4.6h-4.8L8.1 10.2z" />
  </svg>
);

// Le récap de match — la feuille sombre de la maquette.
//
// Un seul fond, toujours sombre, quel que soit le thème : c'est une feuille
// de match. Le score en 148px, le perdant grisé, les écussons, les buteurs
// avec leurs minutes, puis trois vues sous un segment : Statistiques (les
// barres de duel), Chronologie (chaque but avec le score courant) et Feuille
// (les deux effectifs). La page qui l'appelle glisse ses actions en bas.
export default function RecapView({
  match,
  mvpName,
  mvpHref,
  votes,
  teamA,
  teamB,
  goals,
  cartons,
  bilanA,
  bilanB,
  contexte,
  showLiveResumeLink = false,
  liveHref,
  showActions = true,
  publicShareUrl,
  club,
  children,
}: {
  match: Match;
  mvpName: string | null;
  mvpHref?: string;
  votes?: { pour: number; total: number } | null;
  teamA: Player[];
  teamB: Player[];
  goals: Goal[];
  cartons?: { a: number; b: number } | null;
  /// « 9-2-3 » : le bilan de la saison de chaque chasuble.
  bilanA?: string | null;
  bilanB?: string | null;
  /// « Soirée du 7 sept. · Match 1 »
  contexte?: string;
  showLiveResumeLink?: boolean;
  liveHref?: string;
  showActions?: boolean;
  publicShareUrl?: string;
  club?: { name: string; colorA: string | null; colorB: string | null };
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [vue, setVue] = useState<"stats" | "chrono" | "feuille">("stats");
  const [partage, setPartage] = useState(false);
  const [condense, setCondense] = useState(false);

  useEffect(() => {
    const fn = () => setCondense(window.scrollY > 300);
    fn();
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const winA = match.scoreA > match.scoreB;
  const winB = match.scoreB > match.scoreA;
  const fini = match.status === "FINISHED";

  // La chronologie doit être CHRONOLOGIQUE. Les buts arrivent ordonnés par
  // date de saisie : bon ordre pendant le match, faux dès qu'on rattrape un
  // but oublié. Un but sans minute hérite de celle du but qui le précède.
  const ordonnes = (() => {
    let derniere = 0;
    return goals
      .map((g, i) => {
        if (g.minute != null) derniere = g.minute;
        return { g, cle: derniere, i };
      })
      .sort((x, y) => x.cle - y.cle || x.i - y.i)
      .map((x) => x.g);
  })();

  // « Karim 3′, 11′, 15′ » par camp, dans l'ordre du match.
  const buteurs = (t: "A" | "B") => {
    const out: { name: string; mins: string[] }[] = [];
    for (const g of ordonnes.filter((g) => g.team === t)) {
      const s = out.find((x) => x.name === g.scorerName);
      const m = g.minute != null ? `${g.minute}′` : "";
      if (s) s.mins.push(m);
      else out.push({ name: g.scorerName, mins: [m] });
    }
    return out;
  };
  const buteursA = buteurs("A");
  const buteursB = buteurs("B");

  const cscA = goals.filter((g) => g.team === "B" && g.scorerId === "" ).length;
  const cscB = goals.filter((g) => g.team === "A" && g.scorerId === "").length;
  const passesA = goals.filter((g) => g.team === "A" && g.assistName).length;
  const passesB = goals.filter((g) => g.team === "B" && g.assistName).length;
  const avecPasses = goals.some((g) => g.assistName !== undefined);

  const publicUrl =
    publicShareUrl ||
    (typeof window !== "undefined" ? `${window.location.origin}/r/${match.id}` : "");

  const dateCourte = new Date(match.playedAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
  const dateLongue = new Date(match.playedAt).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  const duel = (label: string, a: number, b: number, or = false) => {
    const tot = a + b;
    return (
      <div className="duel-stat" key={label}>
        <div className="chiffres">
          <span>{a}</span>
          <span>{label}</span>
          <span>{b}</span>
        </div>
        <div className="barres">
          <span>
            <i style={{ width: tot ? `${Math.round((a / tot) * 100)}%` : 0 }} />
          </span>
          <span>
            <i style={{ width: tot ? `${Math.round((b / tot) * 100)}%` : 0, background: or ? "#ffd60a" : undefined }} />
          </span>
        </div>
      </div>
    );
  };

  const retour = () => {
    if (window.history.length > 1) router.back();
    else router.push("/");
  };

  return (
    <div className="recap fond-match">
      {/* L'en-tête qui se condense au défilement. */}
      <div className={cn("recap-entete", condense && "visible")} aria-hidden>
        <div className="recap-entete-ligne">
          <div className="recap-entete-camp">
            <Ecusson camp="A" lettre={lettre(match.teamAName)} taille={40} />
            <span className={cn("recap-entete-chiffre", winB && "perd")}>{match.scoreA}</span>
          </div>
          <div className="recap-entete-milieu">
            <div className="etat">{fini ? "Terminé" : "En direct"}</div>
            <div className="date">{dateCourte}</div>
          </div>
          <div className="recap-entete-camp B">
            <span className={cn("recap-entete-chiffre", winA && "perd")}>{match.scoreB}</span>
            <Ecusson camp="B" lettre={lettre(match.teamBName)} taille={40} />
          </div>
        </div>
      </div>

      <div className="grabber" style={{ background: "rgba(255,255,255,.3)" }} />
      <div className="recap-barre">
        <button type="button" onClick={retour} aria-label="Retour" className="verre rond">
          <svg width="12" height="20" viewBox="0 0 12 20" fill="none" aria-hidden>
            <path d="M10 2L2 10l8 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="recap-legende">{contexte ?? dateLongue}</span>
        <button type="button" onClick={() => setPartage(true)} aria-label="Partager" className="verre rond">
          <svg width="20" height="22" viewBox="0 0 20 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M10 13V2" /><path d="M6 6l4-4 4 4" /><path d="M4 10v9h12v-9" />
          </svg>
        </button>
      </div>

      <div className="recap-marque">
        <div className={cn("recap-chiffre", winB && "perd")}>
          <span className="score-lourd">{match.scoreA}</span>
        </div>
        <div className="recap-etat">
          {fini ? (
            <>
              <span className="etat">Terminé</span>
              <span className="date">{dateCourte}</span>
            </>
          ) : (
            <span className="etat direct">En direct</span>
          )}
        </div>
        <div className={cn("recap-chiffre", winA && "perd")}>
          <span className="score-lourd">{match.scoreB}</span>
        </div>
      </div>

      <div className="recap-equipes">
        <div className="recap-equipe">
          <Ecusson camp="A" lettre={lettre(match.teamAName)} taille={76} />
          <span className="nom">{match.teamAName}</span>
          {bilanA && <span className="bilan">{bilanA}</span>}
        </div>
        <div className="recap-equipe">
          <Ecusson camp="B" lettre={lettre(match.teamBName)} taille={76} />
          <span className="nom">{match.teamBName}</span>
          {bilanB && <span className="bilan">{bilanB}</span>}
        </div>
      </div>

      {(buteursA.length > 0 || buteursB.length > 0) && (
        <div className="recap-buteurs">
          <div>
            {buteursA.length > 0 && <Ballon />}
            <div>
              {buteursA.map((s) => (
                <div key={s.name}>
                  {s.name} <span className="mins">{s.mins.filter(Boolean).join(", ")}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="B">
            <div>
              {buteursB.map((s) => (
                <div key={s.name}>
                  {s.name} <span className="mins">{s.mins.filter(Boolean).join(", ")}</span>
                </div>
              ))}
            </div>
            {buteursB.length > 0 && <Ballon />}
          </div>
        </div>
      )}

      {showLiveResumeLink && (
        <div className="recap-reprendre">
          <Link href={liveHref ?? `/matches/${match.id}/live`} className="plein" style={{ width: "100%" }}>
            Reprendre le match en cours
          </Link>
        </div>
      )}

      <div className="recap-segment" role="tablist">
        {(
          [
            ["stats", "Statistiques"],
            ["chrono", "Chronologie"],
            ["feuille", "Feuille"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={vue === id}
            className={cn("recap-onglet", vue === id && "actif")}
            onClick={() => setVue(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {mvpName &&
        (mvpHref ? (
          <Link href={mvpHref} className="carte recap-motm">
            <AvatarAnneau nom={mvpName} camp={teamA.some((p) => p.id === match.mvpId) ? "A" : teamB.some((p) => p.id === match.mvpId) ? "B" : null} taille={60} />
            <span className="corps">
              <span className="legende">Homme du match</span>
              <span className="nom">{mvpName}</span>
              <span className="detail">
                {[...teamA, ...teamB].find((p) => p.id === match.mvpId)?.goals
                  ? `${[...teamA, ...teamB].find((p) => p.id === match.mvpId)!.goals} but${[...teamA, ...teamB].find((p) => p.id === match.mvpId)!.goals > 1 ? "s" : ""}`
                  : null}
                {votes && votes.total > 0 && <>{" · "}{votes.pour} vote{votes.pour > 1 ? "s" : ""} sur {votes.total}</>}
              </span>
            </span>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="#ffd60a" stroke="#ffd60a" strokeWidth="1.5" aria-hidden>
              <path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8L3.5 9.7l5.9-.9z" />
            </svg>
          </Link>
        ) : (
          <div className="carte recap-motm">
            <AvatarAnneau nom={mvpName} taille={60} />
            <span className="corps">
              <span className="legende">Homme du match</span>
              <span className="nom">{mvpName}</span>
            </span>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="#ffd60a" stroke="#ffd60a" strokeWidth="1.5" aria-hidden>
              <path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8L3.5 9.7l5.9-.9z" />
            </svg>
          </div>
        ))}

      {vue === "stats" && (
        <section className="carte">
          <div className="carte-titre">Statistiques</div>
          <div className="recap-carte-corps">
            {duel("Buts", match.scoreA, match.scoreB)}
            {avecPasses && duel("Passes décisives", passesA, passesB)}
            {duel("Contre son camp", cscA, cscB)}
            {cartons && duel("Cartons", cartons.a, cartons.b, true)}
          </div>
        </section>
      )}

      {vue === "chrono" && (
        <section className="carte">
          <div className="carte-titre">Chronologie</div>
          <div className="recap-carte-corps">
            {ordonnes.length === 0 ? (
              <div className="recap-vide">Aucun but.</div>
            ) : (
              (() => {
                let a = 0, b = 0;
                const lignes = ordonnes.map((g) => {
                  if (g.team === "A") a += 1;
                  else b += 1;
                  return { g, a, b };
                });
                return [...lignes].reverse().map(({ g, a, b }) => (
                  <div key={g.id} className="recap-chrono">
                    <span className="minute">{g.minute != null ? `${g.minute}′` : "—"}</span>
                    <span className="qui">
                      <span className={cn("point", g.team)} />
                      <span className="truncate">
                        {g.scorerName}
                        {g.assistName && <span className="note"> — passe de {g.assistName}</span>}
                      </span>
                    </span>
                    <span className="marque">{a}–{b}</span>
                  </div>
                ));
              })()
            )}
          </div>
        </section>
      )}

      {vue === "feuille" && (
        <section className="carte">
          <div className="carte-titre">Feuille de match</div>
          <div className="recap-effectifs">
            {(
              [
                ["A", match.teamAName, teamA],
                ["B", match.teamBName, teamB],
              ] as const
            ).map(([camp, nom, joueurs]) => (
              <div key={camp}>
                <div className="recap-effectif-tete">
                  <Ecusson camp={camp} lettre={lettre(nom)} taille={22} />
                  <span className="truncate">{nom}</span>
                </div>
                {joueurs.length === 0 && <div className="recap-vide">—</div>}
                {joueurs.map((p) => (
                  <div key={p.id} className="recap-joueur">
                    <AvatarAnneau nom={p.name} camp={camp} taille={30} />
                    <span className="nom">{p.name}</span>
                    {p.goals > 0 && <span className="buts">{p.goals}</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {showActions && (
        <div className="recap-actions">
          <button type="button" onClick={() => setPartage(true)} className="plein">
            Partager
          </button>
        </div>
      )}

      {children && <div className="recap-suite">{children}</div>}

      <PartageFeuille
        open={partage}
        onClose={() => setPartage(false)}
        match={match}
        mvpName={mvpName}
        teamA={teamA}
        teamB={teamB}
        goals={goals}
        club={club}
        publicUrl={publicUrl}
        contexte={contexte ?? dateLongue}
      />
    </div>
  );
}
