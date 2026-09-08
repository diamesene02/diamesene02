import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireClub } from "@/lib/guard";
import { nomsChasubles } from "@/lib/color";
import Onglets from "@/components/ios/Onglets";
import Ecusson from "@/components/ios/Ecusson";
import CalendrierForm from "./CalendrierForm";
import ChoixSaison from "./ChoixSaison";
import "./saison.css";

export const dynamic = "force-dynamic";

function euro(cents: number) {
  return (cents / 100).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}

// La saison : le calendrier des soirées et des matchs externes, le tableau
// des adversaires, le bilan. Tout le monde la lit ; l'admin y pose le
// calendrier automatique.
export default async function SaisonPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ saison?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const ctx = await requireClub(slug);
  const clubId = ctx.club.id;

  const saisons = await prisma.season.findMany({
    where: { clubId },
    orderBy: { startsAt: "desc" },
    select: { id: true, name: true, isActive: true },
  });
  const active = saisons.find((s) => s.isActive) ?? saisons[0] ?? null;
  const saison = saisons.find((s) => s.id === sp.saison) ?? active;

  const [moi, soirees, matchs, derniere] = await Promise.all([
    prisma.player.findFirst({ where: { clubId, userId: ctx.user.id }, select: { id: true } }),
    prisma.matchDay.findMany({
      where: { clubId, ...(saison ? { seasonId: saison.id } : {}) },
      orderBy: { date: "asc" },
      include: {
        rsvps: { select: { playerId: true, status: true } },
        lineup: { select: { playerId: true } },
        matches: { select: { id: true, status: true, scoreA: true, scoreB: true, kind: true } },
      },
    }),
    prisma.match.findMany({
      where: { clubId, ...(saison ? { seasonId: saison.id } : {}), status: { in: ["SCHEDULED", "FINISHED", "LIVE"] } },
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

  // ── Le calendrier : soirées et matchs externes, dans l'ordre des dates ──
  type Entree = {
    cle: string;
    date: Date;
    href: string;
    titre: string;
    sous: string;
    etiquette: string;
    ton: "direct" | "appel" | "muet" | "neutre";
    annulee: boolean;
  };
  const entrees: Entree[] = [];
  for (const md of soirees) {
    const heure = md.date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    const joues = md.matches.filter((m) => m.status === "FINISHED").length;
    const direct = md.matches.some((m) => m.status === "LIVE");
    const reponses = md.rsvps.filter((r) => r.status !== null).length;
    const maReponse = moi ? md.rsvps.find((r) => r.playerId === moi.id) : null;
    const passee = md.date.getTime() < now - 6 * 3600_000 && !direct;
    let sous = md.location ?? md.title ?? "";
    let etiquette = "";
    let ton: Entree["ton"] = "neutre";
    if (md.canceledAt) {
      sous = md.cancelReason ? `${md.cancelReason} — annulée` : "Annulée";
      etiquette = "Annulée";
      ton = "muet";
    } else if (direct) {
      sous = [md.location, `${joues} match${joues > 1 ? "s" : ""} joué${joues > 1 ? "s" : ""}`].filter(Boolean).join(" · ");
      etiquette = "En cours";
      ton = "direct";
    } else if (passee) {
      sous = [md.location, joues ? `${joues} match${joues > 1 ? "s" : ""} joué${joues > 1 ? "s" : ""}` : "aucun match"].filter(Boolean).join(" · ");
      etiquette = joues ? "Jouée" : "";
      ton = "muet";
    } else {
      sous = [md.location, `${reponses} réponse${reponses > 1 ? "s" : ""}`, md.lineup.length ? "équipes prêtes" : "équipes à préparer"]
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
      date: md.date,
      href: `/c/${slug}/sessions/${md.id}`,
      titre: `Soirée · ${heure}`,
      sous,
      etiquette,
      ton,
      annulee: !!md.canceledAt,
    });
  }
  for (const m of matchs.filter((x) => x.kind === "EXTERNAL")) {
    const quand = m.scheduledAt ?? m.playedAt;
    const heure = quand.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    const fini = m.status === "FINISHED";
    entrees.push({
      cle: `m-${m.id}`,
      date: quand,
      href: fini || m.status === "LIVE" ? `/c/${slug}/matches/${m.id}` : `/c/${slug}/matches/${m.id}`,
      titre: `${m.opponent?.name ?? m.teamBName} — ${ctx.org.name}`,
      sous: [m.isHome ? "domicile" : "extérieur", m.venue, fini ? `${m.scoreA} – ${m.scoreB}` : heure].filter(Boolean).join(" · "),
      etiquette: m.status === "LIVE" ? "En cours" : fini ? (m.scoreA > m.scoreB ? "Victoire" : m.scoreA < m.scoreB ? "Défaite" : "Nul") : heure,
      ton: m.status === "LIVE" ? "direct" : fini ? "muet" : "neutre",
      annulee: false,
    });
  }
  entrees.sort((a, b) => a.date.getTime() - b.date.getTime());
  // Les soirées passées se replient sous les prochaines : on ouvre le
  // calendrier sur ce qui vient.
  const groupes: { cle: string; titre: string; entrees: Entree[] }[] = [];
  for (const e of entrees) {
    const cle = `${e.date.getFullYear()}-${e.date.getMonth()}`;
    let g = groupes.find((x) => x.cle === cle);
    if (!g) {
      g = { cle, titre: e.date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }), entrees: [] };
      groupes.push(g);
    }
    g.entrees.push(e);
  }

  // ── Les adversaires ────────────────────────────────────────────────────
  const externes = matchs.filter((m) => m.kind === "EXTERNAL" && m.status === "FINISHED");
  const parAdversaire = new Map<string, { nom: string; mj: number; v: number; n: number; d: number; bp: number; bc: number }>();
  let club = { mj: 0, v: 0, n: 0, d: 0, bp: 0, bc: 0 };
  for (const m of externes) {
    const nom = m.opponent?.name ?? m.teamBName;
    const o = parAdversaire.get(nom) ?? { nom, mj: 0, v: 0, n: 0, d: 0, bp: 0, bc: 0 };
    o.mj += 1; club.mj += 1;
    o.bp += m.scoreB; o.bc += m.scoreA; club.bp += m.scoreA; club.bc += m.scoreB;
    if (m.scoreA > m.scoreB) { club.v += 1; o.d += 1; }
    else if (m.scoreA < m.scoreB) { club.d += 1; o.v += 1; }
    else { club.n += 1; o.n += 1; }
    parAdversaire.set(nom, o);
  }
  const pts = (x: { v: number; n: number }) => x.v * ctx.club.pointsWin + x.n * ctx.club.pointsDraw;
  const lignesAdv = [
    { nom: ctx.org.name, ...club, club: true },
    ...[...parAdversaire.values()].map((o) => ({ ...o, club: false })),
  ].sort((a, b) => pts(b) - pts(a) || b.bp - b.bc - (a.bp - a.bc));

  // ── Le bilan ───────────────────────────────────────────────────────────
  const finis = matchs.filter((m) => m.status === "FINISHED");
  const internes = finis.filter((m) => m.kind !== "EXTERNAL");
  const soireesJouees = soirees.filter((md) => md.matches.some((m) => m.status === "FINISHED")).length;
  const buts = finis.reduce((s, m) => s + m.scoreA + m.scoreB, 0);
  let vA = 0, vB = 0, nul = 0;
  for (const m of internes) {
    if (m.scoreA > m.scoreB) vA += 1; else if (m.scoreB > m.scoreA) vB += 1; else nul += 1;
  }
  const plusGros = [...finis].sort((a, b) => b.scoreA + b.scoreB - (a.scoreA + a.scoreB))[0] ?? null;
  const terrain = soirees.reduce((s, md) => s + (md.fieldCostCents ?? 0), 0);
  const soireesPayantes = soirees.filter((md) => (md.fieldCostCents ?? 0) > 0).length;
  // Le nom des chasubles de la saison : celui de la majorité des matchs.
  const nomA = internes[0]?.teamAName ?? noms.a;
  const nomB = internes[0]?.teamBName ?? noms.b;

  const sousTitre = [
    `${soireesJouees} soirée${soireesJouees > 1 ? "s" : ""} jouée${soireesJouees > 1 ? "s" : ""}`,
    `${soirees.length} au calendrier`,
  ].join(" · ");

  const calendrier = (
    <>
      {groupes.length === 0 && (
        <p className="saison-vide">
          Aucune soirée au calendrier pour cette saison.
        </p>
      )}
      {groupes.map((g) => (
        <div key={g.cle}>
          <div className="saison-mois">{g.titre}</div>
          {g.entrees.map((e) => (
            <Link key={e.cle} href={e.href} className={`saison-rangee${e.annulee ? " annulee" : ""}`}>
              <span className="saison-date">
                <span className="jour">{e.date.toLocaleDateString("fr-FR", { weekday: "short" })}</span>
                <span className="numero">{e.date.getDate()}</span>
              </span>
              <span className="saison-corps">
                <span className="titre">{e.titre}</span>
                <span className="sous">{e.sous}</span>
              </span>
              <span className={`saison-etiquette ${e.ton === "neutre" ? "" : e.ton}`}>{e.etiquette}</span>
            </Link>
          ))}
        </div>
      ))}
      {ctx.canScore && (
        <div className="saison-ajout">
          <Link href={`/c/${slug}/matches/new-session`} className="verre grand">
            Ajouter une soirée
          </Link>
          <Link href={`/c/${slug}/matches/schedule`} className="verre grand">
            Programmer un match
          </Link>
        </div>
      )}
      {ctx.canManage && (
        <div className="saison-form">
          <CalendrierForm slug={slug} lieuParDefaut={derniere?.location ?? null} />
        </div>
      )}
    </>
  );

  const adversaires = (
    <>
      {externes.length === 0 ? (
        <p className="saison-vide">
          Pas encore de match contre un autre club cette saison.
          {ctx.canScore && " Programme-en un depuis le calendrier."}
        </p>
      ) : (
        <>
          <div className="saison-tableau-tete">
            <span />
            <span />
            <span>Équipe</span>
            <span>MJ</span>
            <span>V</span>
            <span>N</span>
            <span>D</span>
            <span>DB</span>
            <span>PTS</span>
          </div>
          {lignesAdv.map((o, i) => {
            const db = o.bp - o.bc;
            return (
              <div key={o.nom} className={`saison-tableau-rangee${o.club ? " club" : ""}`}>
                <span>{i + 1}</span>
                <Ecusson camp={o.club ? "A" : "club"} lettre={o.nom.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()} taille={32} />
                <span>{o.nom}</span>
                <span>{o.mj}</span>
                <span>{o.v}</span>
                <span>{o.n}</span>
                <span>{o.d}</span>
                <span>{db > 0 ? `+${db}` : db}</span>
                <span>{pts(o)}</span>
              </div>
            );
          })}
          <p className="saison-note">
            Barème du club : victoire {ctx.club.pointsWin} pt{ctx.club.pointsWin > 1 ? "s" : ""} · nul {ctx.club.pointsDraw} pt{ctx.club.pointsDraw > 1 ? "s" : ""}
          </p>
        </>
      )}
    </>
  );

  const bilan = (
    <>
      <div className="saison-chiffres">
        <div><div className="n">{soireesJouees}</div><div className="l">Soirées</div></div>
        <div><div className="n">{finis.length}</div><div className="l">Matchs</div></div>
        <div><div className="n">{buts}</div><div className="l">Buts</div></div>
      </div>
      {internes.length > 0 && (
        <div className="saison-bilan">
          <span>{nomA} contre {nomB}</span>
          <b>{vA} V · {nul} N · {vB} D</b>
        </div>
      )}
      {externes.length > 0 && (
        <div className="saison-bilan">
          <span>Contre les autres clubs</span>
          <b>{club.v} V · {club.n} N · {club.d} D</b>
        </div>
      )}
      {plusGros && (
        <div className="saison-bilan">
          <span>Plus gros score</span>
          <b>
            {plusGros.scoreA} – {plusGros.scoreB} · {plusGros.playedAt.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
          </b>
        </div>
      )}
      {terrain > 0 && (
        <div className="saison-bilan">
          <span>Terrain</span>
          <b>{euro(terrain)} · {euro(Math.round(terrain / soireesPayantes))} par soirée</b>
        </div>
      )}
    </>
  );

  return (
    <main className="ecran">
      <div className="saison-tete flex items-start justify-between gap-3">
        <div>
          <div className="titre-ecran">Saison</div>
          <div className="sous-titre">{sousTitre}</div>
        </div>
        {saisons.length > 0 && saison && (
          <ChoixSaison saisons={saisons} actuelle={saison.id} />
        )}
      </div>

      <section className="carte saison-carte">
        <Onglets
          onglets={[
            { id: "calendrier", label: "Calendrier", contenu: calendrier },
            { id: "adversaires", label: "Adversaires", contenu: adversaires },
            { id: "bilan", label: "Bilan", contenu: bilan },
          ]}
        />
      </section>
    </main>
  );
}
