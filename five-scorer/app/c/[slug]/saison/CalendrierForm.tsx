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

// Le générateur de calendrier, replié derrière « Poser toute la saison ».
//
// Il avait sa page à lui ; il vit maintenant au pied du calendrier, là où
// l'on constate qu'il manque des lundis. Fermé, c'est un bouton en verre ;
// ouvert, le formulaire et la liste des dates prennent la suite de la carte.
export default function CalendrierForm({
  slug,
  lieuParDefaut,
  ouvertParDefaut = false,
}: {
  slug: string;
  lieuParDefaut: string | null;
  /// Un club sans aucune soirée n'a pas à chercher le bouton : le
  /// formulaire est déjà ouvert.
  ouvertParDefaut?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState(ouvertParDefaut);

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
      // Le calendrier est juste au-dessus : on y reste, il se recharge.
      setOuvert(false);
      router.push(`/c/${slug}/saison`);
      router.refresh();
    });
  }

  if (!ouvert) {
    return (
      <div className="saison-actions">
        <button
          type="button"
          className="verre grand"
          onClick={() => setOuvert(true)}
        >
          <Icon name="calendar" size={18} />
          Poser toute la saison
        </button>
      </div>
    );
  }

  return (
    <div className="saison-form">
      <div className="saison-form-tete">
        <span className="titre">Poser toute la saison</span>
        <button
          type="button"
          className="verre"
          onClick={() => setOuvert(false)}
        >
          Fermer
        </button>
      </div>
      <p className="saison-form-aide">
        Choisis le jour et l&apos;heure, vérifie la liste : toute la saison est
        en place, il ne restera qu&apos;à préparer les équipes avant chaque
        soirée.
      </p>

      <div className="saison-champs">
        <label className="saison-champ large">
          <span className="libelle">Nom de la saison</span>
          <input value={nom} onChange={(e) => setNom(e.target.value)} />
        </label>

        <label className="saison-champ">
          <span className="libelle">Jour</span>
          <select
            value={jour}
            onChange={(e) => setJour(Number(e.target.value) as JourSemaine)}
          >
            {JOURS.map((j) => (
              <option key={j.v} value={j.v}>
                {j.nom}
              </option>
            ))}
          </select>
        </label>
        <label className="saison-champ">
          <span className="libelle">Heure</span>
          <input
            type="time"
            value={heure}
            onChange={(e) => setHeure(e.target.value)}
          />
        </label>

        <label className="saison-champ">
          <span className="libelle">Du</span>
          <input
            type="date"
            value={debut}
            onChange={(e) => setDebut(e.target.value)}
          />
        </label>
        <label className="saison-champ">
          <span className="libelle">Au</span>
          <input
            type="date"
            value={fin}
            onChange={(e) => setFin(e.target.value)}
          />
        </label>

        <label className="saison-champ">
          <span className="libelle">Lieu</span>
          <input
            value={lieu}
            onChange={(e) => setLieu(e.target.value)}
            placeholder="Urban Soccer…"
          />
        </label>
        <label className="saison-champ">
          <span className="libelle">Titre</span>
          <input
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            placeholder="Soirée"
          />
        </label>
      </div>

      <div className="saison-compte">
        <span>
          À créer — fériés et trêve de Noël retirés d&apos;office, chaque date
          se rétablit d&apos;un tap.
        </span>
        <span>
          <b>{retenues.length}</b> / {occurrences.length}
        </span>
      </div>

      <div className="saison-liste">
        {parMois.map(([mois, jours]) => (
          <div key={mois}>
            <div className="saison-mois">{mois}</div>
            {jours.map((o) => {
              const k = cle(o.date);
              const prise = retenue(k, o.exclu);
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setBascules((b) => ({ ...b, [k]: !prise }))}
                  className={"saison-occ" + (prise ? "" : " retiree")}
                >
                  <span className={"saison-coche" + (prise ? " on" : "")}>
                    {prise && <Icon name="check" size={13} />}
                  </span>
                  <span className="date">
                    {o.date.toLocaleDateString("fr-FR", {
                      weekday: "short",
                      day: "2-digit",
                      month: "short",
                    })}
                  </span>
                  {o.exclu && <span className="motif">{o.exclu}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {error && <p className="saison-erreur">{error}</p>}

      <button
        type="button"
        onClick={soumettre}
        disabled={pending || retenues.length === 0}
        className="plein"
      >
        {pending
          ? "Création…"
          : `Poser ${retenues.length} soirée${retenues.length > 1 ? "s" : ""}`}
      </button>
      <p className="petit">
        Une soirée déjà présente à l&apos;une de ces dates est laissée telle
        quelle — sa compo ne sera pas écrasée.
      </p>
    </div>
  );
}
