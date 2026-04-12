import { prisma } from "@/lib/prisma";
import NewMatchForm from "./NewMatchForm";

export const dynamic = "force-dynamic";

export default async function NewMatchPage() {
  const players = await prisma.player.findMany({
    orderBy: [{ isGuest: "asc" }, { name: "asc" }],
  });
  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="mb-6 text-2xl font-bold">Nouveau match</h1>
      <NewMatchForm players={players} />
    </main>
  );
}
