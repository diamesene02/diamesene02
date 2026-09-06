/// Slug URL-safe pour les clubs : "FC Les Potos du Jeudi !" → "fc-les-potos-du-jeudi".
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // accents décomposés
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
}

/// Variante suffixée quand le slug est déjà pris : "fc-potos" → "fc-potos-2".
export function withSuffix(slug: string, n: number): string {
  return `${slug}-${n}`;
}
