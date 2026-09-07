"use client";

import { useEffect, useState } from "react";

export default function HorsLigneActions() {
  const [enLigne, setEnLigne] = useState(true);
  useEffect(() => {
    setEnLigne(navigator.onLine);
    const on = () => {
      setEnLigne(true);
      window.location.reload();
    };
    const off = () => setEnLigne(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return (
    <div className="mt-6 flex flex-col gap-2">
      <button
        onClick={() => window.location.reload()}
        className="btn primary big w-full"
      >
        Réessayer
      </button>
      <a href="/" className="btn ghost tap w-full">
        Accueil
      </a>
      <p className="mt-2 text-[13px] text-[color:var(--ink-3)]">
        {enLigne
          ? "Le réseau semble là — le serveur ne répond pas encore."
          : "Pas de réseau. La page se relancera toute seule."}
      </p>
    </div>
  );
}
