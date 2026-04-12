import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CORE_ROSTER = [
  "Diame",
  "Moussa",
  "Idrissa",
  "Omar",
  "Cheikh",
  "Ibrahima",
  "Pape",
  "Modou",
  "Serigne",
  "Aliou",
];

async function main() {
  for (const name of CORE_ROSTER) {
    await prisma.player.upsert({
      where: { id: `seed-${name.toLowerCase()}` },
      update: {},
      create: {
        id: `seed-${name.toLowerCase()}`,
        name,
        isGuest: false,
      },
    });
  }
  console.log(`Seeded ${CORE_ROSTER.length} core players.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
