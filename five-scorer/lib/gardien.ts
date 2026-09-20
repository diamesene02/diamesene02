// Le gardien d'une soirée. Rien d'autre — et surtout aucune importation de
// la base : l'écran de compo est un composant client, et importer
// `lib/compo.ts` (donc `lib/prisma.ts`) depuis le navigateur embarquait le
// moteur Prisma dans le bundle de la soirée.

/// Qui garde CE soir-là. Dès que la compo DÉSIGNE quelqu'un, elle fait loi :
/// le capitaine met les gants à un joueur de champ le lundi où le gardien
/// attitré ne vient pas, et cette désignation vit sur la ligne de compo
/// (`matchDayLineup.isGk`), pas sur le joueur.
///
/// Tant qu'elle ne désigne personne — une compo écrite avant que l'app sache
/// le dire, un joueur qu'on ajoute à l'instant et qui n'a pas encore de
/// ligne —, on s'en remet au gardien attitré du club (`Player.isGk`). Sans ce
/// repli, toutes les compos déjà en base se seraient retrouvées sans gardien
/// du jour au lendemain.
///
/// La règle vit dans UN endroit parce que les deux écrans qui enregistrent
/// une compo doivent en dire la même chose. Le site relisait `Player.isGk`
/// pour TOUT LE MONDE au moment d'enregistrer : le gardien désigné depuis
/// l'app était effacé à la première retouche faite depuis le site.
export function estGardienDuSoir(
  compo: readonly { playerId: string; isGk?: boolean }[],
): (joueur: { id: string; isGk: boolean }) => boolean {
  const designe = new Map(compo.map((l) => [l.playerId, Boolean(l.isGk)]));
  const quelquUnDesigne = [...designe.values()].some(Boolean);
  if (!quelquUnDesigne) return (joueur) => joueur.isGk;
  return (joueur) => designe.get(joueur.id) ?? joueur.isGk;
}
