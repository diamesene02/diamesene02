"use client";

import { useEffect, useState } from "react";
import { fmt } from "@/lib/clock";

// L'horloge du match en direct sur l'accueil. Le chrono vrai (pauses
// comprises) vit dans Dexie sur le téléphone qui score ; ici on n'a que le
// coup d'envoi — on affiche donc le temps écoulé depuis. Rendu vide côté
// serveur : l'heure du serveur et celle du client ne s'accorderaient pas.
export default function HorlogeDirect({ depuis }: { depuis: string }) {
  const [texte, setTexte] = useState("");
  useEffect(() => {
    const t0 = Date.parse(depuis);
    const tic = () => setTexte(fmt(Date.now() - t0));
    tic();
    const id = setInterval(tic, 1000);
    return () => clearInterval(id);
  }, [depuis]);
  return <>{texte}</>;
}
