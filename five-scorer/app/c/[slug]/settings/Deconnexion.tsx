"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";

export default function Deconnexion() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="plein danger"
      onClick={async () => {
        // Le cache du service worker garde les pages de CET utilisateur ; sur
        // un appareil partagé, la personne suivante les verrait hors-ligne.
        navigator.serviceWorker?.controller?.postMessage({ type: "PURGE" });
        await signOut();
        router.push("/login");
        router.refresh();
      }}
    >
      Se déconnecter
    </button>
  );
}
