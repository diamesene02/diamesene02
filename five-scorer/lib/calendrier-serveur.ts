import "server-only";

import { prisma } from "@/lib/prisma";
import { idsValides } from "@/lib/ids";

/// Le calendrier d'une saison, posé d'un bloc.
///
/// Vit ici et non dans `app/actions/calendrier.ts` parce que DEUX appelants en
/// ont besoin : la server action du site et la route `POST .../saison/calendrier`
/// que l'app mobile appelle. Le mettre dans le fichier « use server » aurait
/// exposé une fonction prenant un `clubId` en paramètre — donc appelable par
/// n'importe quel client, sans garde. Ici, chaque appelant pose la sienne
/// AVANT d'entrer.

const MAX_SOIREES = 120; // une saison hebdomadaire en compte ~44

export type EntreeCalendrier = {
  nomSaison: string;
  /// Dates ISO, calculées côté client dans le fuseau de la personne.
  dates: string[];
  titre?: string;
  lieu?: string;
  /// Rattacher à une saison existante plutôt que d'en créer une.
  seasonId?: string | null;
};

export type ResultatCalendrier = {
  ok: boolean;
  error?: string;
  crees?: number;
  ignores?: number;
  seasonId?: string;
};

/// Crée (ou complète) une saison et ses soirées. La garde d'accès est du
/// ressort de l'appelant.
///
/// Idempotent par date : une soirée existant déjà au même jour est laissée
/// telle quelle. Relancer le calendrier après avoir ajouté quelques semaines
/// ne duplique donc rien, et ne touche pas aux compos déjà préparées.
export async function poserCalendrier(
  clubId: string,
  input: EntreeCalendrier,
): Promise<ResultatCalendrier> {
  const nom = input.nomSaison?.trim();
  if (!nom || nom.length < 2) return { ok: false, error: "Nom de saison trop court." };

  if (input.seasonId != null && !idsValides(input.seasonId)) {
    return { ok: false, error: "Saison invalide." };
  }

  const dates = (input.dates ?? [])
    .map((s) => new Date(s))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  if (dates.length === 0) return { ok: false, error: "Aucune date à créer." };
  if (dates.length > MAX_SOIREES) {
    return { ok: false, error: `Trop de dates (${dates.length}).` };
  }

  const titre = input.titre?.trim() || null;
  const lieu = input.lieu?.trim() || null;

  const { seasonId, crees, ignores } = await prisma.$transaction(async (tx) => {
    let seasonId = input.seasonId ?? null;
    if (seasonId) {
      // Re-vérifiée contre le club : l'identifiant vient du client.
      const s = await tx.season.findFirst({
        where: { id: seasonId, clubId: clubId },
        select: { id: true },
      });
      if (!s) throw new Error("saison_hors_club");
    } else {
      // On COMPLÈTE la saison active, on n'en ouvre pas une seconde.
      //
      // La branche précédente refermait la saison en cours et en créait une
      // neuve à chaque passage sur l'écran. Or les soirées et les matchs déjà
      // joués gardent leur ancienne saison : l'accueil, qui lit la saison
      // active, retombait à zéro match, zéro but, classement vide. Un admin
      // revenant en janvier ajouter trois lundis effaçait ainsi tout le
      // classement de sa saison, sans rien pour l'en avertir.
      const active = await tx.season.findFirst({
        where: { clubId: clubId, isActive: true },
        select: { id: true, startsAt: true, endsAt: true },
      });
      if (active) {
        seasonId = active.id;
        // La saison s'étire pour englober les nouvelles dates.
        const debut = dates[0];
        const fin = dates[dates.length - 1];
        await tx.season.update({
          where: { id: active.id },
          data: {
            startsAt: active.startsAt < debut ? active.startsAt : debut,
            endsAt:
              active.endsAt && active.endsAt > fin ? active.endsAt : fin,
          },
        });
      } else {
        const s = await tx.season.create({
          data: {
            clubId: clubId,
            name: nom,
            startsAt: dates[0],
            endsAt: dates[dates.length - 1],
            isActive: true,
          },
          select: { id: true },
        });
        seasonId = s.id;
      }
    }

    // Les soirées déjà présentes sur ces journées ne sont pas retouchées : une
    // compo préparée ne doit jamais être écrasée par une régénération.
    //
    // La fenêtre porte sur des JOURNÉES ENTIÈRES, pas sur les horodatages des
    // dates générées : une soirée déjà créée à 19h00 échappait à un `gte`
    // calé sur 20h00, et une seconde soirée naissait le même jour.
    const bornes = {
      gte: debutDeJournee(dates[0]),
      lte: finDeJournee(dates[dates.length - 1]),
    };
    const existantes = await tx.matchDay.findMany({
      where: { clubId: clubId, date: bornes },
      select: { date: true },
    });
    const prises = new Set(existantes.map((m) => jourCle(m.date)));

    const aCreer = dates.filter((d) => !prises.has(jourCle(d)));
    if (aCreer.length > 0) {
      await tx.matchDay.createMany({
        data: aCreer.map((date) => ({
          clubId: clubId,
          seasonId,
          date,
          title: titre,
          location: lieu,
        })),
      });
    }
    return {
      seasonId: seasonId!,
      crees: aCreer.length,
      ignores: dates.length - aCreer.length,
    };
  });

  return { ok: true, crees, ignores, seasonId };
}

/// Deux soirées le même jour n'ont pas de sens : la clé de comparaison est le
/// jour civil, pas l'horodatage.
///
/// Le jour est celui du SERVEUR et non UTC : `toISOString()` faisait basculer
/// une soirée de fin de soirée dans le jour suivant, et l'anti-doublon tombait
/// à côté.
function jourCle(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function debutDeJournee(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function finDeJournee(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

