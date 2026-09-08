"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { updateClubSettings, type ClubSettingsInput } from "@/app/actions/club";
import { nomsChasubles } from "@/lib/color";
import { themeVars, type Theme } from "@/lib/theme";
import { lettre } from "@/lib/ini";
import Ecusson from "@/components/ios/Ecusson";
import Interrupteur from "@/components/ios/Interrupteur";
import LigneScore from "@/components/ios/LigneScore";
import ThemeSwitch from "@/components/ios/ThemeSwitch";

type Format = "FIVE" | "FUTSAL" | "SEVEN" | "ELEVEN" | "OTHER";
type Motm = "VOTE" | "ADMIN" | "OFF";

type Values = {
  name: string;
  colorA: string;
  colorB: string;
  format: Format;
  matchDurationMin: number;
  minJoueurs: number;
  capaciteSoiree: number;
  pointsWin: number;
  pointsDraw: number;
  trackAssists: boolean;
  trackCards: boolean;
  membersCanScore: boolean;
  motmMode: Motm;
  isPublic: boolean;
};

const FORMATS: [Format, string][] = [
  ["FIVE", "Five"],
  ["FUTSAL", "Futsal"],
  ["SEVEN", "Foot à 7"],
  ["ELEVEN", "Foot à 11"],
  ["OTHER", "Autre"],
];
const MOTM: [Motm, string][] = [
  ["VOTE", "Vote des membres"],
  ["ADMIN", "Choix du marqueur"],
  ["OFF", "Désactivé"],
];
const SWATCHES = ["#FF6B2C", "#3D8BFF", "#E5243B", "#1DB954", "#FFD60A", "#8E44AD", "#FFFFFF", "#111111"];

// Les réglages du club en listes groupées, comme sur la maquette. Chaque
// ligne enregistre TOUTE SEULE : un interrupteur, un choix ou un champ qu'on
// quitte part au serveur sans bouton « Enregistrer » — c'est le geste iOS, et
// c'est ce qui évite de perdre un réglage changé puis oublié.
export default function ClubSettingsForm({
  slug,
  initial,
  theme,
  saisonActive,
  saisonsCount,
}: {
  slug: string;
  initial: Values;
  theme: Theme;
  saisonActive: string | null;
  saisonsCount: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<Values>(initial);
  const [etat, setEtat] = useState<{ texte: string; erreur?: boolean } | null>(null);
  const [chasublesOuvertes, setChasublesOuvertes] = useState(false);
  const enregistre = useRef<Values>(initial);

  const noms = nomsChasubles(values.colorA, values.colorB);

  // Les chasubles habillent l'app EN DIRECT pendant qu'on choisit : le fond
  // se recalcule sous le doigt, avant même d'enregistrer.
  useEffect(() => {
    const el = document.querySelector<HTMLElement>("[data-club-theme]");
    if (!el) return;
    const t = (el.dataset.theme === "light" ? "light" : "dark") as Theme;
    if (values.colorA !== enregistre.current.colorA || values.colorB !== enregistre.current.colorB) {
      el.style.cssText = themeVars(values.colorA, values.colorB, t);
    } else {
      el.style.cssText = "";
    }
    return () => {
      el.style.cssText = "";
    };
  }, [values.colorA, values.colorB]);

  function sauver(diff: ClubSettingsInput) {
    if (Object.keys(diff).length === 0) return;
    setEtat({ texte: "Enregistrement…" });
    startTransition(async () => {
      const res = await updateClubSettings(slug, diff);
      if (!res.ok) {
        setEtat({ texte: res.error ?? "Erreur", erreur: true });
        return;
      }
      enregistre.current = { ...enregistre.current, ...(diff as Partial<Values>) };
      setEtat({ texte: "Enregistré" });
      router.refresh();
      setTimeout(() => setEtat((e) => (e?.texte === "Enregistré" ? null : e)), 1500);
    });
  }

  /// Change une valeur ET l'enregistre tout de suite (interrupteurs, choix).
  function poser<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    sauver({ [key]: value } as ClubSettingsInput);
  }
  /// Change une valeur sans l'envoyer (champs texte) ; `valider` l'envoie.
  function taper<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }
  function valider<K extends keyof Values>(key: K) {
    if (values[key] !== enregistre.current[key]) sauver({ [key]: values[key] } as ClubSettingsInput);
  }

  const swatches = (side: "A" | "B") => {
    const courante = (side === "A" ? values.colorA : values.colorB).toUpperCase();
    const cle = side === "A" ? "colorA" : "colorB";
    return (
      <div className="reg-swatches">
        {SWATCHES.map((hex) => (
          <button
            key={hex}
            type="button"
            aria-label={hex}
            aria-pressed={courante === hex}
            className={cn("reg-swatch", courante === hex && "actif")}
            style={{ background: hex }}
            onClick={() => poser(cle, hex)}
          />
        ))}
        <span className={cn("reg-swatch libre", !SWATCHES.includes(courante) && "actif")} title="Autre couleur">
          <input
            type="color"
            value={courante.length === 7 ? courante : "#888888"}
            onChange={(e) => taper(cle, e.target.value.toUpperCase())}
            onBlur={() => valider(cle)}
            aria-label={`Couleur libre de la chasuble ${side}`}
          />
        </span>
      </div>
    );
  };

  return (
    <div className="reg-groupe">
      <div className="section-ios">Club</div>
      <section className="carte">
        <label className="rangee-ios">
          <span className="libelle">Nom</span>
          <Ecusson camp="A" lettre={lettre(values.name)} taille={30} style={{ borderRadius: 8 }} />
          <input
            className="reg-champ nom"
            value={values.name}
            onChange={(e) => taper("name", e.target.value)}
            onBlur={() => valider("name")}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            required
            aria-label="Nom du club"
          />
        </label>
        <button type="button" className="rangee-ios" onClick={() => setChasublesOuvertes((o) => !o)} aria-expanded={chasublesOuvertes}>
          <span className="libelle">Chasubles</span>
          <span className="reg-pastilles" aria-hidden>
            <span className="reg-pastille" style={{ background: "var(--taG)" }} />
            <span className="reg-pastille" style={{ background: "var(--tbG)" }} />
          </span>
          <span className="valeur">
            {noms.a} · {noms.b}
          </span>
          <span className="chevron">{chasublesOuvertes ? "⌃" : "›"}</span>
        </button>
        {chasublesOuvertes && (
          <div className="reg-chasubles">
            <div className="titre">
              <span>Chasuble A</span>
              <span>{noms.a}</span>
            </div>
            {swatches("A")}
            <div className="titre">
              <span>Chasuble B</span>
              <span>{noms.b}</span>
            </div>
            {swatches("B")}
            <div className="reg-apercu">
              <LigneScore nomA={noms.a} nomB={noms.b} scoreA={4} scoreB={2} etat="Aperçu" />
            </div>
          </div>
        )}
        <div className="rangee-ios">
          <span className="libelle">Format</span>
          <span className="reg-select">
            {FORMATS.find(([f]) => f === values.format)?.[1]}
            <span className="chevron">›</span>
            <select value={values.format} onChange={(e) => poser("format", e.target.value as Format)} aria-label="Format">
              {FORMATS.map(([f, l]) => (
                <option key={f} value={f}>
                  {l}
                </option>
              ))}
            </select>
          </span>
        </div>
        <label className="rangee-ios">
          <span className="libelle">Durée d&apos;un match</span>
          <input
            className="reg-champ court"
            type="number"
            min={1}
            max={120}
            value={values.matchDurationMin}
            onChange={(e) => taper("matchDurationMin", Number(e.target.value) || 1)}
            onBlur={() => valider("matchDurationMin")}
            aria-label="Durée d'un match en minutes"
          />
          <span className="valeur">min</span>
        </label>
        <div className="rangee-ios">
          <span className="libelle">Apparence</span>
          <ThemeSwitch initial={theme} />
        </div>
      </section>

      {/* LA SOIRÉE TIENT-ELLE ?
          Une soirée n'avait que deux états : elle existait, ou elle avait été
          jouée. Entre les deux, la question « on est combien ? » repartait sur
          WhatsApp chaque semaine. */}
      <div className="section-ios">La soirée</div>
      <section className="carte">
        <label className="rangee-ios">
          <span className="libelle">
            Il faut au moins
            <span className="aide">
              En dessous, la soirée s&apos;annonce comme menacée.
            </span>
          </span>
          <input
            className="reg-champ court"
            type="number"
            min={2}
            max={30}
            value={values.minJoueurs}
            onChange={(e) => taper("minJoueurs", Number(e.target.value) || 2)}
            onBlur={() => valider("minJoueurs")}
            aria-label="Nombre minimum de joueurs pour que la soirée ait lieu"
          />
          <span className="valeur">joueurs</span>
        </label>
        <label className="rangee-ios">
          <span className="libelle">
            Le terrain tient
            <span className="aide">
              Au-delà, les suivants passent en liste d&apos;attente. 0 pour ne
              jamais limiter.
            </span>
          </span>
          <input
            className="reg-champ court"
            type="number"
            min={0}
            max={40}
            value={values.capaciteSoiree}
            onChange={(e) => taper("capaciteSoiree", Number(e.target.value) || 0)}
            onBlur={() => valider("capaciteSoiree")}
            aria-label="Capacité de la soirée"
          />
          <span className="valeur">joueurs</span>
        </label>
      </section>

      <div className="section-ios">Match</div>
      <section className="carte">
        <div className="rangee-ios">
          <span className="libelle">
            Passes décisives
            <span className="aide">Demander le passeur après un but</span>
          </span>
          <Interrupteur on={values.trackAssists} onChange={(v) => poser("trackAssists", v)} label="Passes décisives" />
        </div>
        <div className="rangee-ios">
          <span className="libelle">
            Cartons
            <span className="aide">Jaunes et rouges dans la chronologie</span>
          </span>
          <Interrupteur on={values.trackCards} onChange={(v) => poser("trackCards", v)} label="Cartons" />
        </div>
        <div className="rangee-ios">
          <span className="libelle">
            Les membres peuvent scorer
            <span className="aide">Sinon, admins uniquement</span>
          </span>
          <Interrupteur on={values.membersCanScore} onChange={(v) => poser("membersCanScore", v)} label="Les membres peuvent scorer" />
        </div>
        <div className="rangee-ios">
          <span className="libelle">Homme du match</span>
          <span className="reg-select">
            {MOTM.find(([m]) => m === values.motmMode)?.[1]}
            <span className="chevron">›</span>
            <select value={values.motmMode} onChange={(e) => poser("motmMode", e.target.value as Motm)} aria-label="Homme du match">
              {MOTM.map(([m, l]) => (
                <option key={m} value={m}>
                  {l}
                </option>
              ))}
            </select>
          </span>
        </div>
      </section>

      <div className="section-ios">Saison</div>
      <section className="carte">
        <Link href={`/c/${slug}/saison`} className="rangee-ios">
          <span className="libelle">Saison active</span>
          <span className="valeur">{saisonActive ?? "aucune"}</span>
          <span className="chevron">›</span>
        </Link>
        <div className="rangee-ios">
          <span className="libelle">
            Barème
            <span className="aide">victoire · nul</span>
          </span>
          <input
            className="reg-champ court"
            type="number"
            min={1}
            max={10}
            value={values.pointsWin}
            onChange={(e) => taper("pointsWin", Number(e.target.value) || 1)}
            onBlur={() => valider("pointsWin")}
            aria-label="Points par victoire"
          />
          <input
            className="reg-champ court"
            type="number"
            min={0}
            max={5}
            value={values.pointsDraw}
            onChange={(e) => taper("pointsDraw", Number(e.target.value) || 0)}
            onBlur={() => valider("pointsDraw")}
            aria-label="Points par nul"
          />
        </div>
        <Link href={`/c/${slug}/saison`} className="rangee-ios">
          <span className="libelle">Calendrier automatique</span>
          <span className="valeur">
            {saisonsCount} saison{saisonsCount > 1 ? "s" : ""}
          </span>
          <span className="chevron">›</span>
        </Link>
      </section>

      <div className="section-ios">Vitrine</div>
      <section className="carte">
        <div className="rangee-ios">
          <span className="libelle">
            Page publique
            <span className="aide">
              {values.isPublic ? (
                <a href={`/p/${slug}`} target="_blank" rel="noreferrer" style={{ color: "var(--ink)" }}>
                  /p/{slug}
                </a>
              ) : (
                "Classement et résultats en lecture seule"
              )}
            </span>
          </span>
          <Interrupteur on={values.isPublic} onChange={(v) => poser("isPublic", v)} label="Page publique" />
        </div>
      </section>

      <div className={cn("reg-etat", etat?.erreur && "erreur")} aria-live="polite">
        {isPending ? "Enregistrement…" : etat?.texte}
      </div>
    </div>
  );
}
