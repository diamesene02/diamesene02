import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Roster Urban Foot — équipes attribuées au moment du setup du match,
// pas stockées au niveau du joueur.
const CORE_ROSTER: { name: string; nickname?: string }[] = [
  { name: "Christophe" },
  { name: "Halim" },
  { name: "Philippe" },
  { name: "Thierry" },
  { name: "Olivier" },
  { name: "Marc" },
  { name: "Hicham" },
  { name: "Diame" },
  { name: "Erkan" },
  { name: "Oussama" },
  { name: "Petit Nico" },
  { name: "Antoine" },
  { name: "Nicolas" },
  { name: "Benjamin" },
];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  const seedIds = CORE_ROSTER.map((p) => `seed-${slugify(p.name)}`);

  for (const p of CORE_ROSTER) {
    const id = `seed-${slugify(p.name)}`;
    await prisma.player.upsert({
      where: { id },
      update: { name: p.name, nickname: p.nickname ?? null, isGuest: false },
      create: { id, name: p.name, nickname: p.nickname ?? null, isGuest: false },
    });
  }

  // Nettoie les anciens seeds qui ne sont plus dans le roster
  // (mais seulement ceux préfixés "seed-" pour ne jamais toucher aux
  // invités créés depuis l'UI).
  const removed = await prisma.player.deleteMany({
    where: {
      id: { startsWith: "seed-", notIn: seedIds },
    },
  });

  console.log(
    `Seeded ${CORE_ROSTER.length} core players. Removed ${removed.count} obsolete seed player(s).`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
