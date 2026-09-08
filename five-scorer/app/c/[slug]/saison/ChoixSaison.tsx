"use client";

import { useRouter, usePathname } from "next/navigation";

// Le sélecteur de saison : une pilule en verre « Saison 26–27 ▾ » qui cache
// un vrai <select> — le clavier et le lecteur d'écran y accèdent, le doigt
// voit la pilule.
export default function ChoixSaison({
  saisons,
  actuelle,
}: {
  saisons: { id: string; name: string }[];
  actuelle: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const nom = saisons.find((s) => s.id === actuelle)?.name ?? "Saison";
  return (
    <span className="saison-choix">
      <span className="verre lueur" aria-hidden>
        {nom}
        <span style={{ color: "var(--i2)", fontSize: 13 }}>▾</span>
      </span>
      <select
        aria-label="Choisir la saison"
        value={actuelle}
        onChange={(e) => router.push(`${pathname}?saison=${encodeURIComponent(e.target.value)}`)}
      >
        {saisons.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </span>
  );
}
