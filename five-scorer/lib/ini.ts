/// Les initiales d'un avatar : deux lettres, comme sur la maquette.
export function ini(nom: string): string {
  const n = (nom ?? "").trim();
  if (!n) return "?";
  const mots = n.split(/\s+/).filter(Boolean);
  if (mots.length >= 2) return (mots[0][0] + mots[1][0]).toUpperCase();
  return n.slice(0, 2).toUpperCase();
}

/// La lettre d'un écusson d'équipe : la première du nom de chasuble.
export function lettre(nom: string): string {
  const n = (nom ?? "").trim();
  return n ? n[0].toUpperCase() : "?";
}
