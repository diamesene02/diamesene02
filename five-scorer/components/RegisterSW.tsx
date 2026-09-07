"use client";

import { useEffect } from "react";

// Registers the service worker once the app has mounted on the client.
// No-op in SSR and in non-production environments where SW can thrash HMR.
export default function RegisterSW() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    const register = () => {
      // L'URL porte le numéro du build : un déploiement change l'URL, donc
      // le navigateur réinstalle le service worker et évince l'ancien cache.
      // Sans ça, « v2 » est resté figé pendant des mois.
      const v = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";
      navigator.serviceWorker
        .register(`/sw.js?v=${encodeURIComponent(v)}`, { scope: "/" })
        .catch((err) => console.warn("SW registration failed:", err));
    };

    // Register after the page is idle so we don't compete with first paint.
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
