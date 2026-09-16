import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClub } from "@/lib/guard";
import { rattrapable } from "@/lib/matches";
import * as D from "@/lib/dates";
import CorrigerForm from "./CorrigerForm";

export const dynamic = "force-dynamic";

// L'écran de correction d'un match terminé (spec 0001). Rendu par le
// serveur, il lit la base — jamais le miroir local du navigateur, qui n'est
// rempli que sur l'appareil qui a saisi — et écrit par des actions serveur,
// sans file d'attente (Q4). Il vit à côté de /edit, qui garde les à-côtés.
export default async function CorrigerPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const ctx = await requireClub(slug);
  const recap = `/c/${slug}/matches/${id}`;
  // Le récap dit déjà au membre pourquoi il ne peut rien corriger (APRES-12).
  if (!ctx.canManage) redirect(recap);

  const match = await prisma.match.findFirst({
    where: { id, clubId: ctx.club.id },
    include: {
      participants: { include: { player: { select: { id: true, name: true } } } },
      events: {
        orderBy: { createdAt: "asc" },
        include: {
          player: { select: { id: true, name: true } },
          assistPlayer: { select: { id: true, name: true } },
        },
      },
      season: { select: { name: true, isActive: true } },
      correctedBy: { select: { name: true } },
      opponent: { select: { name: true } },
    },
  });
  if (!match) notFound();
  // Un CANCELED se rétablit d'abord, un LIVE se corrige sur sa feuille.
  if (match.status !== "FINISHED") redirect(recap);

  // Deux déclencheurs indépendants (Q2, APRES-14) : passé six semaines, le
  // classement a déjà été lu ; une saison clôturée, ses chiffres aussi.
  const horsFenetre = !rattrapable(match.playedAt.getTime(), Date.now());
  const saisonClose = !!match.season && !match.season.isActive;

  const nomB = match.kind === "EXTERNAL" && match.opponent ? match.opponent.name : match.teamBName;
  const participants = match.participants
    .map((p) => ({ id: p.player.id, name: p.player.name, team: p.team as "A" | "B" }))
    .sort((a, b) => a.team.localeCompare(b.team) || a.name.localeCompare(b.name));

  return (
    <main className="mx-auto max-w-2xl">
      <span className="kicker">Correction</span>
      <h1 className="display-md mt-1">Corriger le match</h1>
      <p className="mt-2 text-sm text-[color:var(--ink-2)]">
        {match.teamAName} <b className="text-[color:var(--ink-1)]">{match.scoreA}–{match.scoreB}</b> {nomB} ·{" "}
        {D.jourLong2(match.playedAt)} à {D.heure(match.playedAt)}
        {match.season ? ` · ${match.season.name}` : ""}
      </p>

      {match.correctedAt && (
        <p className="mt-2 text-sm text-[color:var(--ink-2)]">
          Corrigé le {D.dateComplete(match.correctedAt)} à {D.heure(match.correctedAt)}
          {match.correctedBy ? ` par ${match.correctedBy.name}` : ""}.
        </p>
      )}

      <div className="mt-6">
        <CorrigerForm
          slug={slug}
          matchId={match.id}
          kind={match.kind}
          nomA={match.teamAName}
          nomB={nomB}
          trackAssists={ctx.club.trackAssists}
          participants={participants}
          events={match.events.map((e) => ({
            id: e.id,
            type: e.type,
            team: e.team as "A" | "B",
            minute: e.minute,
            playerId: e.player?.id ?? null,
            playerName: e.player?.name ?? null,
            assistId: e.assistPlayer?.id ?? null,
            assistName: e.assistPlayer?.name ?? null,
          }))}
          gardes={{ horsFenetre, saisonClose, saisonNom: match.season?.name ?? null }}
        />
      </div>

      <p className="mt-6 flex flex-wrap gap-4 text-sm text-[color:var(--ink-2)]">
        <Link href={recap} className="hover:text-white">
          ← Retour au récap
        </Link>
        <Link href={`${recap}/edit`} className="hover:text-white">
          Modifier les infos (noms, date, saison, notes)
        </Link>
      </p>
    </main>
  );
}
