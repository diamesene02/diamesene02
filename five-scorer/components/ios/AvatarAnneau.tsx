import { cn } from "@/lib/cn";
import { ini } from "@/lib/ini";

// L'avatar d'un joueur : initiales dans un disque, anneau à la couleur de sa
// chasuble. L'anneau est le seul repère d'équipe — pas de fond coloré.
export default function AvatarAnneau({
  nom,
  camp,
  taille = 36,
  className,
}: {
  nom: string;
  camp?: "A" | "B" | null;
  taille?: number;
  className?: string;
}) {
  return (
    <span
      className={cn("avatar-anneau", camp ?? undefined, className)}
      style={{ width: taille, height: taille, fontSize: Math.round(taille / 3) }}
      aria-hidden
    >
      {ini(nom)}
    </span>
  );
}
