"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { NOMS_MATIERES, TEINTES_MATIERES, type Matiere } from "@/lib/succes-icones";
import Medaille from "./Medaille";
import { cleVu, marquerVus, nouveauxDeblocages } from "./vus";
import type { DeblocageAffiche } from "./types";
import "./succes.css";

// L'annonce d'un succès neuf : une carte en verre au milieu de l'écran, la
// médaille qui grossit, quelques éclats aux couleurs du club. Elle ne se
// montre qu'une fois par palier et par appareil (./vus.ts), jamais au premier
// passage, et jamais pour dire qu'on a perdu quelque chose.
//
// À monter UNIQUEMENT pour le joueur lié à l'utilisateur connecté : sur la
// fiche d'un autre, elle lui annoncerait les succès de quelqu'un d'autre — et
// les marquerait vus à sa place.
//
// `deblocages` à `null` tant que les données ne sont pas là : un tableau vide
// pendant le chargement passerait pour « aucun succès », le premier passage
// l'enregistrerait, et tout serait annoncé au chargement suivant (la marge
// d'une semaine de ./vus.ts en rattraperait l'essentiel, pas tout).

/// Les éclats : douze, à angles réguliers décalés, trois couleurs. Fixes
/// plutôt qu'aléatoires — le rendu serveur et le client doivent tomber
/// d'accord, et le hasard ne se remarque pas à cette vitesse.
const ECLATS = Array.from({ length: 12 }, (_, i) => ({
  angle: i * 30 + (i % 2 ? 11 : -7),
  distance: 72 + ((i * 37) % 30),
  couleur: i % 3 === 0 ? "var(--ta)" : i % 3 === 1 ? "var(--tb)" : "var(--eclat-m)",
  delai: 120 + (i % 4) * 25,
}));

function teinte(m: Matiere): string {
  return m === "legende" ? "var(--ta)" : TEINTES_MATIERES[m].base;
}

export default function AnnonceSucces({
  clubId,
  playerId,
  slug,
  deblocages,
  href,
}: {
  clubId: string;
  playerId: string;
  slug: string;
  /// `SuccesJoueur.deblocages`, ou `null` tant qu'ils ne sont pas chargés.
  deblocages: readonly DeblocageAffiche[] | null;
  /// Où mène « Voir mes succès ». Par défaut, la fiche du joueur.
  href?: string;
}) {
  const [liste, setListe] = useState<DeblocageAffiche[]>([]);
  const [cible, setCible] = useState<Element | null>(null);
  const carte = useRef<HTMLDivElement>(null);
  const voir = useRef<HTMLAnchorElement>(null);
  const avant = useRef<Element | null>(null);

  // La signature plutôt que le tableau : un parent client qui reconstruit la
  // liste à chaque rendu ne doit pas relancer la lecture du stockage.
  const signature = deblocages ? deblocages.map(cleVu).join(",") : null;
  const courants = useRef(deblocages);
  useEffect(() => {
    courants.current = deblocages;
  });

  useEffect(() => {
    const d = courants.current;
    if (signature === null || !d) return;
    setListe(nouveauxDeblocages(clubId, playerId, d));
  }, [clubId, playerId, signature]);

  const ouvert = liste.length > 0;

  const fermer = useCallback(() => {
    marquerVus(clubId, playerId, (courants.current ?? []).map(cleVu));
    setListe([]);
    const retour = avant.current;
    if (retour instanceof HTMLElement) retour.focus();
  }, [clubId, playerId]);

  useEffect(() => {
    if (!ouvert) return;
    // Dans le conteneur du thème, pas dans <body> : les jetons du club
    // (--mn, --ta, --tb…) sont posés sur [data-club-theme].
    setCible(document.querySelector("[data-club-theme]") ?? document.body);
    avant.current = document.activeElement;
    const racine = document.documentElement;
    const debordement = racine.style.overflow;
    racine.style.overflow = "hidden";
    return () => {
      racine.style.overflow = debordement;
    };
  }, [ouvert]);

  useEffect(() => {
    if (ouvert && cible) voir.current?.focus();
  }, [ouvert, cible]);

  const auClavier = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      fermer();
      return;
    }
    if (e.key !== "Tab" || !carte.current) return;
    // Le focus reste dans la carte : deux commandes, on boucle de l'une à
    // l'autre.
    const f = carte.current.querySelectorAll<HTMLElement>("a[href], button");
    if (f.length === 0) return;
    const premier = f[0];
    const dernier = f[f.length - 1];
    if (e.shiftKey && document.activeElement === premier) {
      e.preventDefault();
      dernier.focus();
    } else if (!e.shiftKey && document.activeElement === dernier) {
      e.preventDefault();
      premier.focus();
    }
  };

  if (!ouvert || !cible) return null;
  const [tete, ...autres] = liste;
  const lien = href ?? `/c/${slug}/players/${playerId}`;

  return createPortal(
    <div className="annonce-cadre" onKeyDown={auClavier}>
      <div className="annonce-fond" onClick={fermer} aria-hidden />
      <div
        ref={carte}
        className="annonce"
        role="dialog"
        aria-modal="true"
        aria-labelledby="annonce-succes-nom"
        aria-describedby="annonce-succes-libelle"
      >
        <button type="button" className="verre rond annonce-fermer" onClick={fermer} aria-label="Fermer">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>

        <div
          className="annonce-scene"
          style={{ "--halo": teinte(tete.matiere), "--eclat-m": teinte(tete.matiere) } as React.CSSProperties}
          aria-hidden
        >
          <span className="annonce-halo" />
          <span className="annonce-eclats">
            {ECLATS.map((e, i) => (
              <i
                key={i}
                style={
                  {
                    "--a": `${e.angle}deg`,
                    "--d": `${e.distance}px`,
                    "--c": e.couleur,
                    animationDelay: `${e.delai}ms`,
                  } as React.CSSProperties
                }
              />
            ))}
          </span>
          <Medaille icone={tete.icone} matiere={tete.matiere} taille={112} className="annonce-medaille" />
        </div>

        <p className="annonce-sur">
          {liste.length > 1 ? `${liste.length} nouveaux succès` : "Nouveau succès"}
        </p>
        <h2 id="annonce-succes-nom" className="annonce-nom">
          {tete.nom}
        </h2>
        <p id="annonce-succes-libelle" className="annonce-libelle">
          {NOMS_MATIERES[tete.matiere]} · {tete.libelle}
        </p>

        {autres.length > 0 && (
          <ul className="annonce-autres">
            {autres.slice(0, 3).map((d) => (
              <li key={cleVu(d)}>
                <Medaille icone={d.icone} matiere={d.matiere} taille={32} />
                <span>
                  <b>{d.nom}</b> · {d.libelle}
                </span>
              </li>
            ))}
            {autres.length > 3 && (
              <li className="plus">
                et {autres.length - 3} autre{autres.length - 3 > 1 ? "s" : ""}
              </li>
            )}
          </ul>
        )}

        <Link ref={voir} href={lien} className="plein annonce-voir" onClick={fermer}>
          Voir mes succès
        </Link>
      </div>
    </div>,
    cible,
  );
}
