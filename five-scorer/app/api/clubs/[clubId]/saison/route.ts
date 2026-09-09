import { NextResponse } from "next/server";
import * as D from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { getClubApiContext } from "@/lib/guard";
import { nomsChasubles } from "@/lib/color";
import { calculerPresences, phraseEtat } from "@/lib/presences";
import { ini } from "@/lib/ini";

export const dynamic = "force-dynamic";

function euro(cents: number) {
  return (cents / 100).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}

/// L'écran « Saison », en un aller-retour.
///
/// Le calendrier des soirées et des matchs extérieurs, le tableau des
/// adversaires, le bilan — la même matière que `app/c/[slug]/saison/page.tsx`,
/// assemblée ici pour que l'app n'ait plus qu'à dessiner. Les étiquettes
/// (« Répondre », « Saisir », « En cours »), les phrases d'état, les euros et
/// les dates arrivent écrits : ce sont des règles du club, elles ne peuvent
/// pas vivre en deux exemplaires.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  const { clubId } = await params;
  const ctx = await getClubApiContext(clubId);
  if (!ctx) return NextResponse.json({ error: "introuvable" }, { status: 404 });

  const saisons = await prisma.season.findMany({
    where: { clubId },
    orderBy: { startsAt: "desc" },
    select: { id: true, name: true, isActive: true },
  });
  const active = saisons.find((s) => s.isActive) ?? saisons[0] ?? null;
  const demande = new URL(req.url).searchParams.get("saison") ?? undefined;
  const saison = saisons.find((s) => s.id === demande) ?? active;

  const [moi, vivier, soirees, matchs, derniere] = await Promise.all([
    prisma.player.findFirst({
      where: { clubId, userId: ctx.user.id },
      select: { id: true },
    }),
    prisma.player.findMany({
      where: { clubId, isArchived: false },
      select: { id: true, abonne: true },
    }),
    prisma.matchDay.findMany({
      where: { clubId, ...(saison ? { seasonId: saison.id } : {}) },
      orderBy: { date: "asc" },
      include: {
        rsvps: { select: { playerId: true, status: true, respondedAt: true } },
        lineup: { select: { playerId: true } },
        matches: { select: { id: true, status: true, scoreA: true, scoreB: true, kind: true } },
      },
    }),
    prisma.match.findMany({
      where: {
        clubId,
        ...(saison ? { seasonId: saison.id } : {}),
        status: { in: ["SCHEDULED", "FINISHED", "LIVE"] },
      },
      orderBy: { playedAt: "asc" },
      include: { opponent: true },
    }),
    prisma.matchDay.findFirst({
      where: { clubId, location: { not: null } },
      orderBy: { date: "desc" },
      select: { location: true },
    }),
  ]);

  const noms = nomsChasubles(ctx.club.colorA, ctx.club.colorB);
  const now = Date.now();

  type Cible = { quoi: "soiree" | "match" | "saisir"; id: string; date?: string };
  type Entree = {
    cle: string;
    ts: number;
    jour: string;
    numero: number;
    titre: string;
    sous: string;
    etiquette: string;
    ton: "direct" | "appel" | "muet" | "neutre";
    annulee: boolean;
    cible: Cible;
  };
  const entrees: Entree[] = [];

  for (const md of soirees) {
    const heure = D.heure(md.date);
    const joues = md.matches.filter((m) => m.status === "FINISHED").length;
    const direct = md.matches.some((m) => m.status === "LIVE");
    const maReponse = moi ? md.rsvps.find((r) => r.playerId === moi.id) : null;
    const passee = md.date.getTime() < now - 6 * 3600_000 && !direct;
    let sous = md.location ?? md.title ?? "";
    let etiquette = "";
    let ton: Entree["ton"] = "neutre";
    let cible: Cible = { quoi: "soiree", id: md.id };

    if (md.canceledAt) {
      sous = md.cancelReason ? `${md.cancelReason} — annulée` : "Annulée";
      etiquette = "Annulée";
      ton = "muet";
    } else if (direct) {
      sous = [md.location, `${joues} match${joues > 1 ? "s" : ""} joué${joues > 1 ? "s" : ""}`]
        .filter(Boolean)
        .join(" · ");
      etiquette = "En cours";
      ton = "direct";
    } else if (passee) {
      sous = [md.location, joues ? `${joues} match${joues > 1 ? "s" : ""} joué${joues > 1 ? "s" : ""}` : "aucun match"]
        .filter(Boolean)
        .join(" · ");
      etiquette = joues ? "Jouée" : "";
      ton = "muet";
      // Une soirée jouée sans feuille ne disparaît pas en silence : le
      // calendrier la réclame, et la rangée mène droit à la saisie, datée du
      // bon lundi. Au-delà de six semaines on se tait — le score, plus
      // personne ne l'a en tête.
      const rattrapable = now - md.date.getTime() < 42 * 86400_000;
      if (!joues && rattrapable && ctx.canScore) {
        etiquette = "Saisir";
        ton = "appel";
        cible = { quoi: "saisir", id: md.id, date: md.date.toISOString() };
      }
    } else {
      // « 3 réponses » ne dit pas si la soirée tient. L'état, oui — et il
      // compte les abonnés, qui n'ont rien à répondre (cf. lib/presences).
      const etat = calculerPresences({
        entrees: vivier.map((j) => {
          const r = md.rsvps.find((x) => x.playerId === j.id);
          return {
            playerId: j.id,
            reponse: r?.status ?? null,
            repondueLe: r?.respondedAt ?? null,
            abonne: j.abonne,
          };
        }),
        creeeLe: md.createdAt,
        minJoueurs: ctx.club.minJoueurs,
        capacite: ctx.club.capaciteSoiree,
      }).etat;
      sous = [md.location, phraseEtat(etat), md.lineup.length ? "équipes prêtes" : "équipes à préparer"]
        .filter(Boolean)
        .join(" · ");
      // « Répondre » n'appelle que pour les deux prochaines semaines : sur un
      // calendrier de quarante lundis, le même mot répété jusqu'en juillet ne
      // dit plus rien.
      const bientot = md.date.getTime() - now < 15 * 86400_000;
      if (moi && !maReponse && bientot) {
        etiquette = "Répondre";
        ton = "appel";
      } else {
        etiquette = heure;
      }
    }

    entrees.push({
      cle: `md-${md.id}`,
      ts: md.date.getTime(),
      jour: D.jourSemaine(md.date),
      numero: D.quantieme(md.date),
      titre: `Soirée · ${heure}`,
      sous,
      etiquette,
      ton,
      annulee: !!md.canceledAt,
      cible,
    });
  }

  for (const m of matchs.filter((x) => x.kind === "EXTERNAL")) {
    const quand = m.scheduledAt ?? m.playedAt;
    const heure = D.heure(quand);
    const fini = m.status === "FINISHED";
    entrees.push({
      cle: `m-${m.id}`,
      ts: quand.getTime(),
      jour: D.jourSemaine(quand),
      numero: D.quantieme(quand),
      titre: `${m.opponent?.name ?? m.teamBName} — ${ctx.org.name}`,
      sous: [m.isHome ? "domicile" : "extérieur", m.venue, fini ? `${m.scoreA} – ${m.scoreB}` : heure]
        .filter(Boolean)
        .join(" · "),
      etiquette:
        m.status === "LIVE"
          ? "En cours"
          : fini
            ? m.scoreA > m.scoreB
              ? "Victoire"
              : m.scoreA < m.scoreB
                ? "Défaite"
                : "Nul"
            : heure,
      ton: m.status === "LIVE" ? "direct" : fini ? "muet" : "neutre",
      annulee: false,
      cible: { quoi: "match", id: m.id },
    });
  }

  entrees.sort((a, b) => a.ts - b.ts);
  const groupes: { cle: string; titre: string; entrees: Entree[] }[] = [];
  for (const e of entrees) {
    const d = new Date(e.ts);
    const cle = `${d.getFullYear()}-${d.getMonth()}`;
    let g = groupes.find((x) => x.cle === cle);
    if (!g) {
      g = { cle, titre: D.moisAnnee(d), entrees: [] };
      groupes.push(g);
    }
    g.entrees.push(e);
  }

  // ── Les adversaires ────────────────────────────────────────────────────
  const externes = matchs.filter((m) => m.kind === "EXTERNAL" && m.status === "FINISHED");
  const parAdversaire = new Map<
    string,
    { nom: string; mj: number; v: number; n: number; d: number; bp: number; bc: number }
  >();
  const nous = { mj: 0, v: 0, n: 0, d: 0, bp: 0, bc: 0 };
  for (const m of externes) {
    const nom = m.opponent?.name ?? m.teamBName;
    const o = parAdversaire.get(nom) ?? { nom, mj: 0, v: 0, n: 0, d: 0, bp: 0, bc: 0 };
    o.mj += 1;
    nous.mj += 1;
    o.bp += m.scoreB;
    o.bc += m.scoreA;
    nous.bp += m.scoreA;
    nous.bc += m.scoreB;
    if (m.scoreA > m.scoreB) {
      nous.v += 1;
      o.d += 1;
    } else if (m.scoreA < m.scoreB) {
      nous.d += 1;
      o.v += 1;
    } else {
      nous.n += 1;
      o.n += 1;
    }
    parAdversaire.set(nom, o);
  }
  const pts = (x: { v: number; n: number }) =>
    x.v * ctx.club.pointsWin + x.n * ctx.club.pointsDraw;
  const lignesAdv = [
    { nom: ctx.org.name, ...nous, club: true },
    ...[...parAdversaire.values()].map((o) => ({ ...o, club: false })),
  ].sort((a, b) => pts(b) - pts(a) || b.bp - b.bc - (a.bp - a.bc));

  // ── Le bilan ───────────────────────────────────────────────────────────
  const finis = matchs.filter((m) => m.status === "FINISHED");
  const internes = finis.filter((m) => m.kind !== "EXTERNAL");
  const soireesJouees = soirees.filter((md) => md.matches.some((m) => m.status === "FINISHED")).length;
  const buts = finis.reduce((s, m) => s + m.scoreA + m.scoreB, 0);
  let vA = 0;
  let vB = 0;
  let nul = 0;
  for (const m of internes) {
    if (m.scoreA > m.scoreB) vA += 1;
    else if (m.scoreB > m.scoreA) vB += 1;
    else nul += 1;
  }
  const plusGros = [...finis].sort((a, b) => b.scoreA + b.scoreB - (a.scoreA + a.scoreB))[0] ?? null;
  const terrain = soirees.reduce((s, md) => s + (md.fieldCostCents ?? 0), 0);
  const soireesPayantes = soirees.filter((md) => (md.fieldCostCents ?? 0) > 0).length;
  const nomA = internes[0]?.teamAName ?? noms.a;
  const nomB = internes[0]?.teamBName ?? noms.b;

  const lignesBilan: { libelle: string; valeur: string }[] = [];
  if (internes.length > 0) {
    lignesBilan.push({ libelle: `${nomA} contre ${nomB}`, valeur: `${vA} V · ${nul} N · ${vB} D` });
  }
  if (externes.length > 0) {
    lignesBilan.push({
      libelle: "Contre les autres clubs",
      valeur: `${nous.v} V · ${nous.n} N · ${nous.d} D`,
    });
  }
  if (plusGros) {
    lignesBilan.push({
      libelle: "Plus gros score",
      valeur: `${plusGros.scoreA} – ${plusGros.scoreB} · ${D.jourCourt(plusGros.playedAt)}`,
    });
  }
  if (terrain > 0) {
    lignesBilan.push({
      libelle: "Terrain",
      valeur: `${euro(terrain)} · ${euro(Math.round(terrain / soireesPayantes))} par soirée`,
    });
  }

  return NextResponse.json({
    saisons: {
      choisie: saison?.id ?? null,
      choix: saisons.map((s) => ({ id: s.id, libelle: s.name, active: s.isActive })),
    },
    chasubles: { a: ctx.club.colorA, b: ctx.club.colorB },
    droits: { peutScorer: ctx.canScore, peutGerer: ctx.canManage },
    sousTitre: [
      `${soireesJouees} soirée${soireesJouees > 1 ? "s" : ""} jouée${soireesJouees > 1 ? "s" : ""}`,
      `${soirees.length} au calendrier`,
    ].join(" · "),
    calendrier: {
      groupes: groupes.map((g) => ({
        cle: g.cle,
        titre: g.titre,
        entrees: g.entrees.map(({ ts: _ts, ...e }) => e),
      })),
      vide: groupes.length === 0 ? "Aucune soirée au calendrier pour cette saison." : null,
    },
    adversaires: {
      lignes: lignesAdv.map((o, i) => ({
        rang: i + 1,
        nom: o.nom,
        initiales: ini(o.nom),
        club: o.club,
        mj: o.mj,
        v: o.v,
        n: o.n,
        d: o.d,
        db: o.bp - o.bc > 0 ? `+${o.bp - o.bc}` : String(o.bp - o.bc),
        pts: pts(o),
      })),
      note: `Barème du club : victoire ${ctx.club.pointsWin} pt${ctx.club.pointsWin > 1 ? "s" : ""} · nul ${ctx.club.pointsDraw} pt${ctx.club.pointsDraw > 1 ? "s" : ""}`,
      vide:
        externes.length === 0
          ? "Pas encore de match contre un autre club cette saison." +
            (ctx.canScore ? " Programme-en un depuis le calendrier." : "")
          : null,
    },
    bilan: {
      chiffres: [
        { n: soireesJouees, l: "Soirées" },
        { n: finis.length, l: "Matchs" },
        { n: buts, l: "Buts" },
      ],
      lignes: lignesBilan,
    },
    // Le lieu du dernier lundi connu : c'est celui que le générateur de
    // calendrier proposera par défaut. On joue toujours au même endroit.
    lieuParDefaut: derniere?.location ?? null,
  });
}
