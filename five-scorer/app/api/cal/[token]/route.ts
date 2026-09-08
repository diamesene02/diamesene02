import { prisma } from "@/lib/prisma";
import { FUSEAU } from "@/lib/dates";

export const dynamic = "force-dynamic";

/// Le calendrier du club, à coller dans le téléphone.
///
/// Le vrai problème d'un five hebdomadaire n'est pas de compter les buts,
/// c'est que dix personnes se souviennent de lundi. Construire des
/// notifications, c'est demander une permission, gérer des jetons, tenir un
/// service. Un abonnement iCal fait la même chose avec un lien : chacun le
/// colle une fois, et c'est SON téléphone qui le rappelle, avec ses propres
/// réglages d'alerte, sur iPhone comme sur Android.
///
/// Le flux est en lecture seule et ne porte aucune donnée personnelle : des
/// dates, un lieu, un titre. Pas de noms de joueurs, pas de présences — un
/// agenda partagé se retrouve vite plus loin qu'on ne croit.

function echappe(v: string): string {
  // Les caractères que la RFC 5545 réserve dans une valeur de texte. Le
  // point-virgule DOIT être précédé d'un antislash : « \; » en JavaScript
  // vaut simplement « ; », l'échappement était donc muet — et un lieu écrit
  // « Terrain 2; Guyancourt » aurait coupé la propriété en deux.
  return v
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/// Les lignes iCal se plient à 75 octets, continuation par une espace.
function plie(ligne: string): string {
  const octets = Buffer.from(ligne, "utf8");
  if (octets.length <= 75) return ligne;
  const out: string[] = [];
  let courant = "";
  for (const c of ligne) {
    const essai = courant + c;
    if (Buffer.byteLength(essai, "utf8") > (out.length === 0 ? 75 : 74)) {
      out.push(courant);
      courant = c;
    } else {
      courant = essai;
    }
  }
  out.push(courant);
  return out.join("\r\n ");
}

function horodatage(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const brut = token.replace(/\.ics$/i, "");
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(brut)) {
    return new Response("Not found", { status: 404 });
  }

  const club = await prisma.club.findFirst({
    where: { calendarToken: brut },
    select: {
      id: true,
      matchDurationMin: true,
      organization: { select: { name: true, slug: true } },
    },
  });
  if (!club) return new Response("Not found", { status: 404 });

  // Une saison devant, une saison derrière : un agenda qui remonte à
  // l'origine du club alourdit le téléphone sans rien apprendre.
  const bornes = {
    gte: new Date(Date.now() - 200 * 86_400_000),
    lte: new Date(Date.now() + 400 * 86_400_000),
  };
  const soirees = await prisma.matchDay.findMany({
    where: { clubId: club.id, date: bornes },
    orderBy: { date: "asc" },
    select: {
      id: true,
      date: true,
      title: true,
      location: true,
      canceledAt: true,
      cancelReason: true,
    },
  });

  const base = process.env.BETTER_AUTH_URL?.replace(/\/$/, "") ?? "";
  const nom = club.organization.name;
  // Deux heures : une soirée de five, ce n'est pas un match de dix minutes.
  const dureeMs = 2 * 3600_000;

  const lignes: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Five Scorer//Calendrier de club//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${echappe(nom)}`,
    `X-WR-TIMEZONE:${FUSEAU}`,
    "X-PUBLISHED-TTL:PT6H",
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
  ];

  for (const s of soirees) {
    const fin = new Date(s.date.getTime() + dureeMs);
    const annulee = s.canceledAt != null;
    lignes.push(
      "BEGIN:VEVENT",
      `UID:${s.id}@five-scorer`,
      `DTSTAMP:${horodatage(new Date())}`,
      `DTSTART:${horodatage(s.date)}`,
      `DTEND:${horodatage(fin)}`,
      plie(
        `SUMMARY:${echappe(annulee ? `${nom} — annulé` : s.title ? `${nom} — ${s.title}` : nom)}`,
      ),
      // Une soirée annulée reste dans le flux, marquée annulée : la retirer
      // laisserait le créneau vide dans l'agenda sans dire pourquoi.
      `STATUS:${annulee ? "CANCELLED" : "CONFIRMED"}`,
      ...(s.location ? [plie(`LOCATION:${echappe(s.location)}`)] : []),
      ...(base
        ? [plie(`URL:${base}/c/${club.organization.slug}/sessions/${s.id}`)]
        : []),
      ...(annulee && s.cancelReason
        ? [plie(`DESCRIPTION:${echappe(s.cancelReason)}`)]
        : []),
      "END:VEVENT",
    );
  }
  lignes.push("END:VCALENDAR");

  return new Response(lignes.join("\r\n") + "\r\n", {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "cache-control": "public, max-age=3600",
      "content-disposition": `inline; filename="${club.organization.slug}.ics"`,
    },
  });
}
