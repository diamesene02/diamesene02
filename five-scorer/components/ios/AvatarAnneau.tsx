import { cn } from "@/lib/cn";
import { ini } from "@/lib/ini";

// L'avatar d'un joueur : sa photo si elle existe, ses initiales sinon, dans
// un disque cerclé à la couleur de sa chasuble. L'anneau est le seul repère
// d'équipe — pas de fond coloré.
export default function AvatarAnneau({
  nom,
  photo,
  camp,
  taille = 36,
  className,
}: {
  nom: string;
  /// Data-URL de la photo (cf. PhotoJoueur). Absente : on retombe sur les
  /// initiales, qui ont toujours été le dessin par défaut.
  photo?: string | null;
  camp?: "A" | "B" | null;
  taille?: number;
  className?: string;
}) {
  return (
    <span
      className={cn("avatar-anneau", camp ?? undefined, photo && "photo", className)}
      style={{ width: taille, height: taille, fontSize: Math.round(taille / 3) }}
      aria-hidden
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" loading="lazy" decoding="async" />
      ) : (
        ini(nom)
      )}
    </span>
  );
}
