"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateClubSettings,
  type ClubSettingsInput,
} from "@/app/actions/club";

type Format = "FIVE" | "FUTSAL" | "SEVEN" | "ELEVEN" | "OTHER";
type Motm = "VOTE" | "ADMIN" | "OFF";

type Values = {
  name: string;
  colorA: string;
  colorB: string;
  format: Format;
  matchDurationMin: number;
  pointsWin: number;
  pointsDraw: number;
  trackAssists: boolean;
  trackCards: boolean;
  membersCanScore: boolean;
  motmMode: Motm;
  isPublic: boolean;
};

const FORMAT_LABELS: [Format, string][] = [
  ["FIVE", "Five à 5"],
  ["FUTSAL", "Futsal"],
  ["SEVEN", "Foot à 7"],
  ["ELEVEN", "Foot à 11"],
  ["OTHER", "Autre"],
];

const MOTM_LABELS: [Motm, string][] = [
  ["VOTE", "Vote des membres"],
  ["ADMIN", "Choix du marqueur"],
  ["OFF", "Désactivé"],
];

export default function ClubSettingsForm({
  slug,
  initial,
}: {
  slug: string;
  initial: Values;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<Values>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setSaved(false);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const diff: ClubSettingsInput = {};
    if (values.name !== initial.name) diff.name = values.name;
    if (values.colorA !== initial.colorA) diff.colorA = values.colorA;
    if (values.colorB !== initial.colorB) diff.colorB = values.colorB;
    if (values.format !== initial.format) diff.format = values.format;
    if (values.matchDurationMin !== initial.matchDurationMin)
      diff.matchDurationMin = values.matchDurationMin;
    if (values.pointsWin !== initial.pointsWin)
      diff.pointsWin = values.pointsWin;
    if (values.pointsDraw !== initial.pointsDraw)
      diff.pointsDraw = values.pointsDraw;
    if (values.trackAssists !== initial.trackAssists)
      diff.trackAssists = values.trackAssists;
    if (values.trackCards !== initial.trackCards)
      diff.trackCards = values.trackCards;
    if (values.membersCanScore !== initial.membersCanScore)
      diff.membersCanScore = values.membersCanScore;
    if (values.motmMode !== initial.motmMode) diff.motmMode = values.motmMode;
    if (values.isPublic !== initial.isPublic) diff.isPublic = values.isPublic;

    if (Object.keys(diff).length === 0) {
      setSaved(true);
      return;
    }
    startTransition(async () => {
      const res = await updateClubSettings(slug, diff);
      if (!res.ok) {
        setError(res.error ?? "Erreur");
      } else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  const inputCls =
 "mt-1 min-h-[44px] w-full rounded-[2px] border border-[color:var(--rule)] bg-[color:var(--pitch-2)] px-3 py-2 outline-none focus:border-[color:var(--ink-1)]";

  const toggleCls =
 "flex min-h-[44px] cursor-pointer items-center justify-between gap-3 rounded-none border border-[color:var(--rule)] bg-[color:var(--pitch-2)] px-3 py-2.5";

  return (
    <section className="bande">
      <h2 className="kicker">Club</h2>
      <form onSubmit={submit} className="mt-4 space-y-5">
        {/* Les couleurs de chasubles habillent toute l'app : barres
            d'équipe, scores, classements, page publique. C'est l'identité
            du club — l'interface, elle, reste neutre. */}
        <div>
          <span className="text-xs font-bold text-[color:var(--ink-1)]">
            Couleurs des chasubles
          </span>
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <BibPicker
              label="Équipe A"
              value={values.colorA}
              onChange={(v) => set("colorA", v)}
            />
            <BibPicker
              label="Équipe B"
              value={values.colorB}
              onChange={(v) => set("colorB", v)}
            />
          </div>
          <p className="mt-2 text-[11px] text-[color:var(--ink-3)]">
            Elles habillent l&apos;app entière. La nuance qui porte le texte
            est calculée automatiquement pour rester lisible sur fond sombre.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-bold text-[color:var(--ink-1)]">
              Nom du club
            </span>
            <input
              value={values.name}
              onChange={(e) => set("name", e.target.value)}
              required
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-[color:var(--ink-1)]">
              Format
            </span>
            <select
              value={values.format}
              onChange={(e) => set("format", e.target.value as Format)}
              className={inputCls}
            >
              {FORMAT_LABELS.map(([f, label]) => (
                <option key={f} value={f}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="text-xs font-bold text-[color:var(--ink-1)]">
              Durée d&apos;un match (min)
            </span>
            <input
              type="number"
              min={1}
              max={120}
              value={values.matchDurationMin}
              onChange={(e) =>
                set("matchDurationMin", Number(e.target.value) || 1)
              }
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-[color:var(--ink-1)]">
              Points victoire
            </span>
            <input
              type="number"
              min={1}
              max={10}
              value={values.pointsWin}
              onChange={(e) => set("pointsWin", Number(e.target.value) || 1)}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-[color:var(--ink-1)]">
              Points nul
            </span>
            <input
              type="number"
              min={0}
              max={5}
              value={values.pointsDraw}
              onChange={(e) => set("pointsDraw", Number(e.target.value) || 0)}
              className={inputCls}
            />
          </label>
        </div>
        <p className="-mt-3 text-xs text-[color:var(--ink-2)]">
          Le barème sert au bilan contre adversaires.
        </p>

        <div className="grid gap-2 sm:grid-cols-2">
          <label className={toggleCls}>
            <span className="text-sm font-bold">Passes décisives</span>
            <input
              type="checkbox"
              checked={values.trackAssists}
              onChange={(e) => set("trackAssists", e.target.checked)}
              className="h-5 w-5 accent-[color:var(--ink-1)]"
            />
          </label>
          <label className={toggleCls}>
            <span className="text-sm font-bold">Cartons</span>
            <input
              type="checkbox"
              checked={values.trackCards}
              onChange={(e) => set("trackCards", e.target.checked)}
              className="h-5 w-5 accent-[color:var(--ink-1)]"
            />
          </label>
          <label className={toggleCls}>
            <span className="text-sm font-bold">
              Les membres peuvent scorer
            </span>
            <input
              type="checkbox"
              checked={values.membersCanScore}
              onChange={(e) => set("membersCanScore", e.target.checked)}
              className="h-5 w-5 accent-[color:var(--ink-1)]"
            />
          </label>
          <label className={toggleCls}>
            <span className="text-sm font-bold">Page publique</span>
            <input
              type="checkbox"
              checked={values.isPublic}
              onChange={(e) => set("isPublic", e.target.checked)}
              className="h-5 w-5 accent-[color:var(--ink-1)]"
            />
          </label>
        </div>

        {values.isPublic && (
          <p className="text-xs text-[color:var(--ink-1)]">
            Vitrine du club en lecture seule :{" "}
            <a
              href={`/p/${slug}`}
              target="_blank"
              rel="noreferrer"
              className="font-bold text-[color:var(--ink-1)] underline underline-offset-2"
            >
              /p/{slug}
            </a>
          </p>
        )}

        <label className="block sm:max-w-xs">
          <span className="text-xs font-bold text-[color:var(--ink-1)]">
            MVP du match
          </span>
          <select
            value={values.motmMode}
            onChange={(e) => set("motmMode", e.target.value as Motm)}
            className={inputCls}
          >
            {MOTM_LABELS.map(([m, label]) => (
              <option key={m} value={m}>
                {label}
              </option>
            ))}
          </select>
        </label>

        {error && <p className="text-sm text-[color:var(--loss)]">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex min-h-[56px] items-center rounded-[2px] bg-[color:var(--ink-1)] px-6 text-sm font-black text-[color:var(--pitch-0)] disabled:opacity-50"
          >
            {isPending ? "Enregistrement…" : "Enregistrer"}
          </button>
          {saved && !isPending && (
            <span className="text-sm font-bold text-[color:var(--bib-a-ink)]">
              Enregistré
            </span>
          )}
        </div>
      </form>
    </section>
  );
}

/// Sélecteur de couleur de chasuble : la pastille montre l'aplat, le champ
/// accepte un hex tapé à la main (utile pour reprendre exactement la
/// couleur d'un maillot).
function BibPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-2.5">
      <span
        className="relative h-11 w-11 shrink-0 overflow-hidden rounded-[2px]"
        style={{ background: value }}
      >
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          aria-label={`Couleur ${label}`}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-[13px] font-semibold text-[color:var(--ink-3)]">
          {label}
        </span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          spellCheck={false}
          className="w-24 rounded-[2px] border border-[color:var(--rule)] bg-[color:var(--pitch-2)] px-2 py-1 text-[13px] tabular-nums outline-none focus:border-[color:var(--rule-hi)]"
        />
      </span>
    </label>
  );
}
