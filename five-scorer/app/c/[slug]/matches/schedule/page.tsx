import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClub } from "@/lib/guard";
import ScheduleMatchForm from "./ScheduleMatchForm";
import { nomsChasubles } from "@/lib/color";

export const dynamic = "force-dynamic";

export default async function ScheduleMatchPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireClub(slug);
  if (!ctx.canScore) redirect(`/c/${slug}`);

  const opponents = await prisma.opponent.findMany({
    where: { clubId: ctx.club.id },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <main className="mx-auto max-w-2xl">
      <span className="kicker">Convocation</span>
      <h1 className="display-md mt-1 mb-6">Programmer un match</h1>
      <ScheduleMatchForm slug={slug} opponents={opponents} nomsParDefaut={nomsChasubles(ctx.club.colorA, ctx.club.colorB)} />
    </main>
  );
}
