import Link from "next/link";
import * as D from "@/lib/dates";
import AvatarAnneau from "@/components/ios/AvatarAnneau";
import Carte from "@/components/ios/Carte";
import type { ClubRecords } from "@/lib/stats";

// Les records du club.
//
// Un classement dit qui est premier. Il ne dit pas « la plus grosse fessée »,
// « qui a mis quatre buts en un match », « avec qui je gagne ». C'est
// pourtant ce dont on parle en se rhabillant. Chaque record renvoie à
// l'endroit où il s'est produit — le match, la soirée, la fiche du joueur.
//
// Un record n'apparaît que le jour où il existe : pas de ligne vide, pas de
// « — » en attendant. Une carte de records à moitié pleine dit mieux la
// jeunesse du club qu'une carte pleine de tirets.

type Ligne = {
  cle: string;
  titre: string;
  valeur: React.ReactNode;
  contexte?: React.ReactNode;
  href?: string;
  avatar?: { nom: string; photo: string | null };
};

export default function Records({
  slug,
  records,
}: {
  slug: string;
  records: ClubRecords;
}) {
  const r = records;
  const lignes: Ligne[] = [];

  if (r.plusLargeVictoire) {
    const m = r.plusLargeVictoire;
    lignes.push({
      cle: "ecart",
      titre: "La plus large victoire",
      valeur: `${m.scoreA} – ${m.scoreB}`,
      // L'écart n'a pas besoin d'être écrit : le score le dit.
      contexte: `${m.nomA} contre ${m.nomB} · ${D.jourCourt(m.date)}`,
      href: `/c/${slug}/matches/${m.matchId}`,
    });
  }
  if (r.matchLePlusFou) {
    const m = r.matchLePlusFou;
    lignes.push({
      cle: "fou",
      titre: "Le match le plus fou",
      valeur: `${m.total} buts`,
      contexte: `${m.nomA} ${m.scoreA} – ${m.scoreB} ${m.nomB} · ${D.jourCourt(m.date)}`,
      href: `/c/${slug}/matches/${m.matchId}`,
    });
  }
  if (r.soireeLaPlusFolle) {
    const s = r.soireeLaPlusFolle;
    lignes.push({
      cle: "soiree",
      titre: "La soirée la plus prolifique",
      valeur: `${s.buts} buts`,
      contexte: `${s.matchs} matchs · ${D.jourLong(s.date)}`,
      href: `/c/${slug}/sessions/${s.matchDayId}`,
    });
  }
  if (r.leCarton) {
    const c = r.leCarton;
    lignes.push({
      cle: "carton",
      titre: "Le carton d'un soir",
      valeur: `${c.valeur} buts`,
      contexte: `${c.name} · en un match${c.date ? ` · ${D.jourCourt(c.date)}` : ""}`,
      href: c.matchId ? `/c/${slug}/matches/${c.matchId}` : `/c/${slug}/players/${c.playerId}`,
      avatar: { nom: c.name, photo: c.photo },
    });
  }
  if (r.laSoireeDUnHomme) {
    const c = r.laSoireeDUnHomme;
    lignes.push({
      cle: "homme-soiree",
      titre: "La soirée d'un homme",
      valeur: `${c.valeur} buts`,
      contexte: `${c.name} · sur la soirée${c.date ? ` · ${D.jourCourt(c.date)}` : ""}`,
      href: `/c/${slug}/sessions/${c.matchDayId}`,
      avatar: { nom: c.name, photo: c.photo },
    });
  }
  if (r.laPlusLongueSerie) {
    const c = r.laPlusLongueSerie;
    lignes.push({
      cle: "serie",
      titre: "La plus longue série",
      valeur: `${c.valeur} victoires`,
      contexte: `${c.name} · d'affilée`,
      href: `/c/${slug}/players/${c.playerId}`,
      avatar: { nom: c.name, photo: c.photo },
    });
  }
  if (r.laPaire) {
    const p = r.laPaire;
    lignes.push({
      cle: "paire",
      titre: "La paire",
      valeur: `${p.pct} %`,
      contexte: `${p.a.name} et ${p.b.name} · ${p.victoires} V en ${p.ensemble} matchs ensemble`,
      href: `/c/${slug}/players/${p.a.playerId}`,
      avatar: { nom: p.a.name, photo: p.a.photo },
    });
  }
  if (r.linoxydable) {
    const c = r.linoxydable;
    lignes.push({
      cle: "inox",
      titre: "L'inoxydable",
      valeur: `${c.valeur} matchs`,
      contexte: `${c.name} · toujours là`,
      href: `/c/${slug}/players/${c.playerId}`,
      avatar: { nom: c.name, photo: c.photo },
    });
  }

  if (lignes.length === 0) return null;

  return (
    <Carte className="stats-records" titre="Les records du club">
      {lignes.map((l) => {
        const corps = (
          <>
            {l.avatar ? (
              <AvatarAnneau nom={l.avatar.nom} photo={l.avatar.photo} taille={38} />
            ) : (
              <span className="pastille" aria-hidden />
            )}
            <span className="bloc">
              <span className="titre">{l.titre}</span>
              {l.contexte && <span className="contexte">{l.contexte}</span>}
            </span>
            <span className="valeur">{l.valeur}</span>
          </>
        );
        return l.href ? (
          <Link key={l.cle} href={l.href} className="record">
            {corps}
          </Link>
        ) : (
          <div key={l.cle} className="record">
            {corps}
          </div>
        );
      })}
      {r.matchsPrisEnCompte < 10 && (
        <p className="record-jeune">
          Sur {r.matchsPrisEnCompte} match{r.matchsPrisEnCompte > 1 ? "s" : ""} joué
          {r.matchsPrisEnCompte > 1 ? "s" : ""} — ça va bouger vite.
        </p>
      )}
    </Carte>
  );
}
