import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClubApiContext } from "@/lib/guard";
import { calculerPresences } from "@/lib/presences";
import { heure, jourSemaineNumero, minuit, moisAnnee } from "@/lib/dates";

export const dynamic = "force-dynamic";

/// Le calendrier du club, en un aller-retour.
///
/// Trois blocs comme sur le site : les six prochaines, le reste à venir sous
/// un dépliant, et le passé. Chacun groupé par mois.
///
/// Les libellés de date sont calculés ici, en Europe/Paris. Le moteur
/// JavaScript de React Native n'embarque pas les fuseaux : un `getMonth()`
/// répondrait dans le fuseau du processus et rangerait une soirée du 1er à
/// 00 h 30 au mois précédent.
///
/// Le nombre de présents suit la règle du club — un abonné qui n'a rien dit
/// vient — via `calculerPresences`, la même fonction que l'accueil et la fiche
/// d'une soirée. Le site compte ici les réponses « IN » brutes ; c'est le même
/// club, ce doit être le même chiffre.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  const { clubId } = await params;
  const ctx = await getClubApiContext(clubId);
  if (!ctx) return NextResponse.json({ error: "introuvable" }, { status: 404 });

  const debut = new Date(minuit(new Date()));

  const [soirees, joueurs] = await Promise.all([
    prisma.matchDay.findMany({
      where: { clubId },
      orderBy: { date: "asc" },
      select: {
        id: true,
        date: true,
        title: true,
        location: true,
        canceledAt: true,
        cancelReason: true,
        createdAt: true,
        fieldCostCents: true,
        rsvps: { select: { playerId: true, status: true, respondedAt: true, hasPaid: true } },
        matches: { select: { scoreA: true, scoreB: true } },
      },
    }),
    prisma.player.findMany({
      where: { clubId, isArchived: false },
      select: { id: true, abonne: true },
    }),
  ]);

  const euros = (cents: number) =>
    (cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2).replace(".", ","));

  const versLigne = (m: (typeof soirees)[number]) => {
    const aVenir = m.date >= debut;
    const reponses = new Map(
      m.rsvps.map((r) => [r.playerId, { statut: r.status, le: r.respondedAt }]),
    );
    const presences = calculerPresences({
      entrees: joueurs.map((j) => {
        const r = reponses.get(j.id);
        return {
          playerId: j.id,
          abonne: j.abonne,
          reponse: r?.statut ?? null,
          repondueLe: r?.le ?? null,
        };
      }),
      creeeLe: m.createdAt,
      minJoueurs: ctx.club.minJoueurs,
      capacite: ctx.club.capaciteSoiree,
      annulee: m.canceledAt != null,
    });
    const presents = presences.titulaires.length;
    const payes = m.rsvps.filter((r) => r.status === "IN" && r.hasPaid).length;
    const attendus = m.rsvps.filter((r) => r.status === "IN").length;

    return {
      id: m.id,
      date: m.date.toISOString(),
      jour: jourSemaineNumero(m.date),
      heure: heure(m.date),
      aVenir,
      annulee: m.canceledAt != null,
      motifAnnulation: m.cancelReason,
      lieu: m.location,
      libelle: m.title,
      presents,
      matchs: m.matches.length,
      buts: m.matches.reduce((n, x) => n + x.scoreA + x.scoreB, 0),
      prixCents: m.fieldCostCents || null,
      prix: m.fieldCostCents ? `${euros(m.fieldCostCents)} €` : null,
      toutRegle: attendus > 0 && payes === attendus,
    };
  };

  type Ligne = ReturnType<typeof versLigne>;

  /// Groupe par mois, en gardant l'ordre d'entrée.
  const parMois = (lignes: Ligne[]) => {
    const par = new Map<string, { cle: string; titre: string; compte: number; soirees: Ligne[] }>();
    for (const l of lignes) {
      const d = new Date(l.date);
      const cle = new Date(minuit(d)).toISOString().slice(0, 7);
      const g = par.get(cle);
      if (g) {
        g.soirees.push(l);
        g.compte++;
      } else {
        par.set(cle, { cle, titre: moisAnnee(d), compte: 1, soirees: [l] });
      }
    }
    return Array.from(par.values());
  };

  const lignes = soirees.map(versLigne);
  const aVenir = lignes.filter((l) => l.aVenir);
  const passees = lignes.filter((l) => !l.aVenir).reverse();
  const reste = aVenir.slice(6);

  return NextResponse.json({
    club: {
      id: ctx.org.id,
      slug: ctx.org.slug,
      peutMarquer: ctx.canScore,
      peutGerer: ctx.canManage,
    },
    aujourdhui: debut.toISOString(),
    prochaines: parMois(aVenir.slice(0, 6)),
    reste: parMois(reste),
    resteTotal: reste.length,
    passees: parMois(passees),
    vide: lignes.length === 0,
  });
}
