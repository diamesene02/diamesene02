import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClub } from "@/lib/guard";
import CalendrierForm from "./CalendrierForm";

export const dynamic = "force-dynamic";

export default async function SaisonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireClub(slug);
  if (!ctx.canManage) notFound();

  // Le lieu de la dernière soirée : on rejoue presque toujours au même endroit.
  const derniere = await prisma.matchDay.findFirst({
    where: { clubId: ctx.club.id, location: { not: null } },
    orderBy: { date: "desc" },
    select: { location: true },
  });

  return (
    <main className="mx-auto max-w-2xl">
      <span className="kicker">Calendrier</span>
      <h1 className="display-md mt-2">Poser la saison</h1>
      <p className="mt-3 text-[color:var(--ink-2)]">
        Un club qui joue toutes les semaines n&apos;a pas à créer ses soirées
        une par une. Choisis le jour et l&apos;heure, vérifie la liste, et toute
        la saison est en place — il ne restera qu&apos;à préparer les équipes
        avant chaque soirée.
      </p>
      <div className="mt-6">
        <CalendrierForm slug={slug} lieuParDefaut={derniere?.location ?? null} />
      </div>
    </main>
  );
}
