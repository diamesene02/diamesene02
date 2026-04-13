import LiveMatch from "./LiveMatch";

// Fully client-side page: reads from Dexie so it works offline.
export default async function LiveMatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LiveMatch matchId={id} />;
}
