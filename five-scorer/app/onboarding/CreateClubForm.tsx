"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { authClient } from "@/lib/auth-client";
import { updateClubSettings } from "@/app/actions/club";
import { slugify, withSuffix } from "@/lib/slugify";
import { nomsChasubles } from "@/lib/color";
import { themeVars } from "@/lib/theme";
import { lettre } from "@/lib/ini";
import Ecusson from "@/components/ios/Ecusson";
import LigneScore from "@/components/ios/LigneScore";

type Format = "FIVE" | "FUTSAL" | "SEVEN" | "ELEVEN";
const FORMATS: [Format, string][] = [
  ["FIVE", "Five"],
  ["FUTSAL", "Futsal"],
  ["SEVEN", "Foot à 7"],
  ["ELEVEN", "Foot à 11"],
];
const SWATCHES = ["#FF6B2C", "#3D8BFF", "#E5243B", "#1DB954", "#FFD60A", "#8E44AD", "#FFFFFF", "#111111"];

// « Ton club » — l'écran de création de la maquette. Les couleurs des
// chasubles habillent toute l'app : le fond de cette page change sous le
// doigt pendant qu'on les choisit, avant même que le club existe.
export default function CreateClubForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [format, setFormat] = useState<Format>("FIVE");
  const [colorA, setColorA] = useState("#FF6B2C");
  const [colorB, setColorB] = useState("#3D8BFF");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const noms = nomsChasubles(colorA, colorB);

  useEffect(() => {
    const el = document.querySelector<HTMLElement>("[data-club-theme]");
    if (!el) return;
    el.style.cssText = themeVars(colorA, colorB, "dark");
    return () => {
      el.style.cssText = "";
    };
  }, [colorA, colorB]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const cleanName = name.trim();
    const base = slugify(cleanName);
    if (cleanName.length < 2 || !base) {
      setError("Donne un vrai nom à ton club.");
      return;
    }
    setLoading(true);
    // Le slug peut être pris : on retente avec un suffixe (-2 … -5).
    for (let n = 1; n <= 5; n++) {
      const slug = n === 1 ? base : withSuffix(base, n);
      const res = await authClient.organization.create({ name: cleanName, slug });
      if (!res.error) {
        // Le club est créé avec les réglages par défaut ; on y pose tout de
        // suite les chasubles et le format choisis.
        await updateClubSettings(slug, { colorA, colorB, format });
        router.push(`/c/${slug}`);
        return;
      }
      const msg = `${res.error.code ?? ""} ${res.error.message ?? ""}`.toLowerCase();
      if (!msg.includes("slug")) {
        setError("Impossible de créer le club. Réessaie dans un instant.");
        setLoading(false);
        return;
      }
    }
    setError("Ce nom de club est déjà très demandé — essaie une variante.");
    setLoading(false);
  }

  const swatches = (side: "A" | "B") => {
    const courante = (side === "A" ? colorA : colorB).toUpperCase();
    const poser = side === "A" ? setColorA : setColorB;
    return (
      <div className="bv-swatches">
        {SWATCHES.map((hex) => (
          <button
            key={hex}
            type="button"
            aria-label={hex}
            aria-pressed={courante === hex}
            className={cn("bv-swatch", courante === hex && "actif")}
            style={{ background: hex }}
            onClick={() => poser(hex)}
          />
        ))}
      </div>
    );
  };

  return (
    <form onSubmit={onSubmit}>
      <section className="carte bv-carte">
        <div className="bv-logo">
          <Ecusson camp="A" lettre={name.trim() ? lettre(name) : "?"} taille={104} />
        </div>
        <div className="bv-rangee" style={{ marginTop: 16 }}>
          <span>Nom</span>
          <input
            type="text"
            name="clubName"
            required
            placeholder="FC Lundi Soir"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Nom du club"
          />
        </div>
        <div className="bv-format" style={{ marginTop: 16 }} role="radiogroup" aria-label="Format">
          {FORMATS.map(([f, l]) => (
            <button key={f} type="button" role="radio" aria-checked={format === f} className={cn(format === f && "actif")} onClick={() => setFormat(f)}>
              {l}
            </button>
          ))}
        </div>
      </section>

      <section className="carte bv-carte">
        <div className="bv-chasuble" style={{ marginTop: 0 }}>
          <span>Chasuble A</span>
          <span>{noms.a}</span>
        </div>
        {swatches("A")}
        <div className="bv-chasuble">
          <span>Chasuble B</span>
          <span>{noms.b}</span>
        </div>
        {swatches("B")}
        <div className="bv-apercu">
          <LigneScore nomA={noms.a} nomB={noms.b} scoreA={4} scoreB={2} etat="Aperçu" />
        </div>
      </section>

      {error && <p className="bv-erreur">{error}</p>}
      <div className="bv-actions" style={{ marginTop: 18 }}>
        <button type="submit" disabled={loading} className="plein">
          {loading ? "Création…" : "Créer le club"}
        </button>
      </div>
    </form>
  );
}
