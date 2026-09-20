import { cn } from "@/lib/cn";
import "./succes.css";

// La barre fine d'un palier ou d'un niveau, aux couleurs du club.
//
// Le dégradé va de la chasuble A à la B sur TOUTE la piste, et la barre n'en
// découvre que sa part : une barre courte est de la couleur A, une barre
// presque pleine vire à la B. Un dégradé comprimé dans la seule partie pleine
// montrerait les deux couleurs à 5 % comme à 95 %, et la barre ne dirait plus
// rien de loin. Les couleurs sont celles des anneaux d'avatar (--taR, --tbR),
// déjà rapprochées du contraste : une chasuble noire ne disparaît pas sur la
// piste du thème sombre.
export default function BarreProgression({
  part,
  label,
  hauteur = 5,
  className,
}: {
  /// 0..1
  part: number;
  /// Ce que la barre mesure, pour un lecteur d'écran : « Vers le niveau 5 ».
  label?: string;
  hauteur?: number;
  className?: string;
}) {
  const p = Number.isFinite(part) ? Math.min(1, Math.max(0, part)) : 0;
  const pct = Math.round(p * 100);
  return (
    <span
      className={cn("barre-succes", className)}
      style={{ "--h": `${hauteur}px` } as React.CSSProperties}
      {...(label
        ? { role: "progressbar", "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": pct, "aria-label": label }
        : { "aria-hidden": true })}
    >
      {p > 0 && (
        <i
          style={{
            width: `${p * 100}%`,
            backgroundSize: `${100 / p}% 100%`,
          }}
        />
      )}
    </span>
  );
}
