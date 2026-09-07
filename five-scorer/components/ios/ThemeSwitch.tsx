"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { THEME_COOKIE, type Theme } from "@/lib/theme";

// Sombre / Clair. Le choix est écrit dans un cookie (lu au rendu serveur,
// donc sans flash au prochain chargement) ET appliqué tout de suite sur le
// conteneur du club : l'app se rhabille sous le doigt.
export default function ThemeSwitch({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);
  const router = useRouter();

  useEffect(() => {
    const el = document.querySelector<HTMLElement>("[data-club-theme]");
    if (el) el.dataset.theme = theme;
  }, [theme]);

  const choisir = (t: Theme) => {
    setTheme(t);
    document.cookie = `${THEME_COOKIE}=${t}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  };

  return (
    <div className="segment" role="radiogroup" aria-label="Apparence">
      <button
        type="button"
        role="radio"
        aria-checked={theme === "dark"}
        className={cn(theme === "dark" && "actif")}
        onClick={() => choisir("dark")}
      >
        Sombre
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={theme === "light"}
        className={cn(theme === "light" && "actif")}
        onClick={() => choisir("light")}
      >
        Clair
      </button>
    </div>
  );
}
