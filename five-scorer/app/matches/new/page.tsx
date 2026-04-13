import { prisma } from "@/lib/prisma";
import NewMatchForm from "./NewMatchForm";

export const dynamic = "force-dynamic";

export default async function NewMatchPage() {
  // Best-effort SSR of the roster. The client form then syncs it into Dexie
  // so the page keeps working when offline.
  let players: {
    id: string;
    name: string;
    nickname: string | null;
    isGuest: boolean;
  }[] = [];
  try {
    const rows = await prisma.player.findMany({
      orderBy: [{ isGuest: "asc" }, { name: "asc" }],
    });
    players = rows.map((p) => ({
      id: p.id,
      name: p.name,
      nickname: p.nickname,
      isGuest: p.isGuest,
    }));
  } catch {
    // Server/DB not reachable from this Next instance: the client will load
    // the roster from Dexie.
  }
  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="mb-6 text-2xl font-bold">Nouveau match</h1>
      <NewMatchForm initialPlayers={players} />
    </main>
  );
}
