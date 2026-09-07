import { cn } from "@/lib/cn";

// La carte translucide à grand rayon — l'unité de composition de l'app.
export default function Carte({
  titre,
  children,
  className,
  style,
}: {
  titre?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <section className={cn("carte", className)} style={style}>
      {titre && <div className="carte-titre">{titre}</div>}
      {children}
    </section>
  );
}
