"use client";

import { useEffect } from "react";
import { saveClubSettings } from "@/lib/localMatch";

// À chaque visite EN LIGNE d'une page du club : les réglages vont dans Dexie,
// la coquille de match et l'accueil vont dans le cache du service worker, et
// le stockage demande à être persistant. C'est le seul moment où l'on est sûr
// d'avoir le réseau — et c'est ce qui rend le lundi soir possible sans lui.
export default function OfflinePrimer({
  club,
}: {
  club: {
    id: string;
    slug: string;
    name: string;
    colorA: string | null;
    colorB: string | null;
    trackAssists: boolean;
    trackCards: boolean;
    motmMode: "VOTE" | "ADMIN" | "OFF";
    matchDurationMin: number;
  };
}) {
  useEffect(() => {
    void saveClubSettings(club);

    // Sans persistance, le système peut purger IndexedDB sur un téléphone
    // plein — et avec lui le match du soir.
    if (navigator.storage?.persist) void navigator.storage.persist();

    if (!("serviceWorker" in navigator)) return;
    let annule = false;
    void navigator.serviceWorker.ready.then((reg) => {
      if (annule || !reg.active) return;
      reg.active.postMessage({ type: "LAST_CLUB", slug: club.slug });
      reg.active.postMessage({
        type: "PRECACHE",
        urls: [`/c/${club.slug}/play`, `/c/${club.slug}`],
      });
    });
    return () => {
      annule = true;
    };
    // Les champs sont des primitives : on ne ré-amorce que si l'un change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    club.id,
    club.slug,
    club.name,
    club.colorA,
    club.colorB,
    club.trackAssists,
    club.trackCards,
    club.motmMode,
    club.matchDurationMin,
  ]);

  return null;
}
