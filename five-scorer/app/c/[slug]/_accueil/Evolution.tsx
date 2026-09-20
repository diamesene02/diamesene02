import { cn } from "@/lib/cn";

// Les places gagnées ou perdues au tableau depuis la dernière soirée : « ▲2 »,
// « ▼1 ». Le moteur des succès rend 0 quand rien n'a bougé et null quand il
// n'y a pas de point de comparaison (première soirée, nouveau venu) : le
// tableau tait le 0 pour rester léger, la carte « Ma saison » le dit (« = »).
export default function Evolution({
  places,
  zero = false,
  className,
}: {
  places: number | null | undefined;
  zero?: boolean;
  className?: string;
}) {
  if (places == null || (places === 0 && !zero)) return null;
  const n = Math.abs(places);
  const dit =
    places > 0
      ? `${n} place${n > 1 ? "s" : ""} gagnée${n > 1 ? "s" : ""} depuis la dernière soirée`
      : places < 0
        ? `${n} place${n > 1 ? "s" : ""} perdue${n > 1 ? "s" : ""} depuis la dernière soirée`
        : "même place qu'avant la dernière soirée";
  return (
    <span
      className={cn("evolution", places > 0 ? "haut" : places < 0 ? "bas" : "egal", className)}
      title={dit}
    >
      <span aria-hidden>
        {places > 0 ? "▲" : places < 0 ? "▼" : "="}
        {places !== 0 && n}
      </span>
      <span className="sr-only">{dit}</span>
    </span>
  );
}
