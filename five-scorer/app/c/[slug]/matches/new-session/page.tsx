import { redirect } from "next/navigation";
import { requireClub } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { cleJour, debutDuJour } from "@/lib/dates";
import { prochaineDateDeJeu } from "@/lib/quand";
import NewSessionForm from "./NewSessionForm";

export const dynamic = "force-dynamic";

export default async function NewSessionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireClub(slug);
  if (!ctx.canScore) redirect(`/c/${slug}`);

  // Le formulaire partait de « demain 19 h » et d'un lieu vide, quel que soit
  // le club. Le club du lundi à Five Renault corrigeait les deux à chaque
  // fois : on part de sa dernière soirée — son jour, son heure, son terrain.
  const [derniere, avenir] = await Promise.all([
    prisma.matchDay.findFirst({
      where: { clubId: ctx.club.id, canceledAt: null },
      orderBy: { date: "desc" },
      select: { date: true, location: true },
    }),
    prisma.matchDay.findMany({
      where: { clubId: ctx.club.id, date: { gte: debutDuJour() } },
      select: { date: true },
    }),
  ]);
  const dateProposee = prochaineDateDeJeu({
    modele: derniere?.date ?? null,
    prises: avenir.map((md) => cleJour(md.date)),
    maintenant: new Date(),
  });

  return (
    <main className="mx-auto max-w-xl">
      <span className="kicker">Organisation</span>
      <h1 className="display-md mt-1">Programmer une soirée</h1>
      <p className="mt-3 text-sm text-[color:var(--ink-1)]">
        La soirée five : une date, un lieu, et chacun répond présent.
      </p>

      <div className="mt-6">
        <NewSessionForm
          slug={slug}
          dateProposee={dateProposee.toISOString()}
          lieuParDefaut={derniere?.location ?? ""}
        />
      </div>
    </main>
  );
}
