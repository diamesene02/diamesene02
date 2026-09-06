// Avatar joueur : initiales sur fond déterministe dérivé de l'id.
// Server-compatible (aucun hook) — utilisable côté RSC comme côté client.

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0][0]}${parts[1][0]}`;
}

const SIZES = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-9 w-9 text-xs",
  lg: "h-14 w-14 text-lg",
} as const;

export default function PlayerAvatar({
  name,
  id,
  size = "md",
}: {
  name: string;
  id: string;
  size?: "sm" | "md" | "lg";
}) {
  const hue = hashId(id) % 360;
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full font-black uppercase leading-none ${SIZES[size]}`}
      style={{
        backgroundColor: `hsl(${hue} 45% 28%)`,
        color: `hsl(${hue} 80% 70%)`,
        border: `1px solid hsl(${hue} 60% 40%)`,
      }}
    >
      {initialsOf(name)}
    </span>
  );
}
