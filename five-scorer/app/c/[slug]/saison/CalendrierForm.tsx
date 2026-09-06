"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { creerCalendrier } from "@/app/actions/calendrier";
import {
  cle,
  genererCalendrier,
  saisonParDefaut,
  type JourSemaine,
} from "@/lib/calendrier";
import Icon from "@/components/Icon";

const JOURS: { v: JourSemaine; nom: string }[] = [
  { v: 1, nom: "Lundi" },
  { v: 2, nom: "Mardi" },
  { v: 3, nom: "Mercredi" },
  { v: 4, nom: "Jeudi" },
  { v: 5, nom: "Vendredi" },
  { v: 6, nom: "Samedi" },
  { v: 0, nom: "Dimanche" },
];

function inputDate(d: Date): string {
  return cle(d);
}

export default function CalendrierForm({
  slug,
  lieuParDefaut,
}: {
  slug: string;
  lieuParDefaut: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Bornes proposées : la saison en cours si on est dedans, jamais dans le passé.
  const defauts = useMemo(() => saisonParDefaut(new Date()), []);
  const [nom, setNom] = useState(defauts.nom);
  const [debut, setDebut] = useState(inputDate(defauts.debut));
  const [fin, setFin] = useState(inputDate(defauts.fin));
  const [jour, setJour] = useState<JourSemaine>(1);
  const [heure, setHeure] = useState("20:00");
  const [lieu, setLieu] = useState(lieuParDefaut ?? "");
  const [titre, setTitre] = useState("");
  // Dates que l'utilisateur a retirées ou rétablies à la main, par-dessus les
  // exclusions automatiques. Une règle ne prévoit pas tout : terrain fermé,
  // vacances, tournoi. La liste doit rester la sienne.
  const [bascules, setBascules] = useState<Record<string, boolean>>({});

  const occurrences = useMemo(() => {
    const d = new Date(`${debut}T12:00:00`);
    const f = new Date(`${fin}T12:00:00`);
    if (Number.isNaN(d.getTime()) || Number.isNaN(f.getTime()) || f < d) return [];
    const [h, mn] = heure.split(":").map((x) => parseInt(x, 10));
    return genererCalendrier({
      debut: d,
      fin: f,
      jourSemaine: jour,
      heures: Number.isFinite(h) ? h : 20,
      minutes: Number.isFinite(mn) ? mn : 0,
    });
  }, [debut, fin, jour, heure]);

  const retenue = (k: string, exclu: string | null) =>
    bascules[k] !== undefined ? bascules[k] : exclu === null;

  const retenues = occurrences.filter((o) => retenue(cle(o.date), o.exclu));

  // Regroupées par mois : quarante-sept lignes d'affilée sur un téléphone ne se
  // relisent pas.
  const parMois = useMemo(() => {
    const m = new Map<string, typeof occurrences>();
    for (const o of occurrences) {
      const k = o.date.toLocaleDateString("fr-FR", {
        month: "long",
        year: "numeric",
      });
      m.set(k, [...(m.get(k) ?? []), o]);
    }
    return [...m.entries()];
  }, [occurrences]);

  function soumettre() {
    setError(null);
    if (retenues.length === 0) {
      setError("Aucune date retenue.");
      return;
    }
    startTransition(async () => {
      const res = await creerCalendrier(slug, {
        nomSaison: nom,
        dates: retenues.map((o) => o.date.toISOString()),
        titre: titre || undefined,
        lieu: lieu || undefined,
      });
      if (!res.ok) {
        setError(res.error ?? "Erreur");
        return;
      }
      router.push(`/c/${slug}/sessions`);
      router.refresh();
    });
  }

  const champ =
    "mt-1 w-full rounded-lg border border-[color:var(--stroke)] bg-[color:var(--bg-2)] px-3 py-2 outline-none focus:border-[color:var(--lime)]";
  const etiquette = "kicker";

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-3xl border border-[color:var(--stroke)] bg-[color:var(--bg-1)] p-5">
        <label className="block">
          <span className={etiquette}>Nom de la saison</span>
          <input
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            className={champ}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={etiquette}>Jour</span>
            <select
              value={jour}
              onChange={(e) => setJour(Number(e.target.value) as JourSemaine)}
              className={champ}
            >
              {JOURS.map((j) => (
                <option key={j.v} value={j.v}>
                  {j.nom}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={etiquette}>Heure</span>
            <input
              type="time"
              value={heure}
              onChange={(e) => setHeure(e.target.value)}
              className={champ}
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={etiquette}>Du</span>
            <input
              type="date"
              value={debut}
              onChange={(e) => setDebut(e.target.value)}
              className={champ}
            />
          </label>
          <label className="block">
            <span className={etiquette}>Au</span>
            <input
              type="date"
              value={fin}
              onChange={(e) => setFin(e.target.value)}
              className={champ}
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={etiquette}>Lieu</span>
            <input
              value={lieu}
              onChange={(e) => setLieu(e.target.value)}
              placeholder="Urban Soccer…"
              className={champ}
            />
          </label>
          <label className="block">
            <span className={etiquette}>Titre</span>
            <input
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Five du lundi"
              className={champ}
            />
          </label>
        </div>
      </section>

      <section className="rounded-3xl border border-[color:var(--stroke)] bg-[color:var(--bg-1)] p-5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="kicker">À créer</span>
          <span className="text-sm tabular-nums text-[color:var(--ink-2)]">
            <strong className="text-[color:var(--ink-1)]">
              {retenues.length}
            </strong>{" "}
            sur {occurrences.length}
          </span>
        </div>
        <p className="mt-2 text-sm text-[color:var(--ink-2)]">
          Les jours fériés et la trêve de Noël sont retirés d&apos;office, avec
          leur motif. Tu peux rétablir ou retirer n&apos;importe quelle date.
        </p>

        <div className="mt-4 space-y-4">
          {parMois.map(([mois, jours]) => (
            <div key={mois}>
              <div className="mb-1.5 text-[11px] font-black uppercase tracking-wider text-[color:var(--ink-3)]">
                {mois}
              </div>
              <ul className="space-y-1">
                {jours.map((o) => {
                  const k = cle(o.date);
                  const prise = retenue(k, o.exclu);
                  return (
                    <li key={k}>
                      <button
                        type="button"
                        onClick={() =>
                          setBascules((b) => ({ ...b, [k]: !prise }))
                        }
                        className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-[color:var(--bg-2)]"
                      >
                        <span
                          className={
                            "grid h-5 w-5 shrink-0 place-items-center rounded border " +
                            (prise
                              ? "border-transparent bg-[color:var(--ink-1)] text-[color:var(--pitch-0)]"
                              : "border-[color:var(--stroke-hi)]")
                          }
                        >
                          {prise && <Icon name="check" size={12} />}
                        </span>
                        <span
                          className={
                            "flex-1 text-sm tabular-nums " +
                            (prise
                              ? "text-[color:var(--ink-1)]"
                              : "text-[color:var(--ink-3)] line-through")
                          }
                        >
                          {o.date.toLocaleDateString("fr-FR", {
                            weekday: "short",
                            day: "2-digit",
                            month: "short",
                          })}
                        </span>
                        {o.exclu && (
                          <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-[color:var(--gold)]">
                            {o.exclu}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {error && (
        <p className="text-center text-sm text-[color:var(--loss)]">{error}</p>
      )}

      <button
        onClick={soumettre}
        disabled={pending || retenues.length === 0}
        className="btn primary big w-full disabled:opacity-60"
      >
        {pending
          ? "Création…"
          : `Créer ${retenues.length} soirée${retenues.length > 1 ? "s" : ""}`}
      </button>
      <p className="text-center text-xs text-[color:var(--ink-3)]">
        Une soirée déjà présente à l&apos;une de ces dates est laissée telle
        quelle — sa compo ne sera pas écrasée.
      </p>
    </div>
  );
}
