import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClubApiContext } from "@/lib/guard";
import { getLeaderboard } from "@/lib/stats";

// Export CSV (Excel FR : séparateur « ; », BOM UTF-8).
// GET /api/clubs/[clubId]/export?type=leaderboard|matches&saison=<seasonId|all>

// Les noms de joueurs, d'équipes et d'adversaires viennent du client. Excel et
// LibreOffice traitent toute cellule commençant par = + - @ (ou une tabulation)
// comme une FORMULE : un membre pouvait nommer une équipe `=WEBSERVICE(...)` et
// la faire exécuter dans le tableur de l'admin à l'ouverture de l'export. On
// neutralise le premier caractère avant tout le reste.
const DEBUT_FORMULE = /^[=+\-@\t\r]/;

function csvField(v: string | number): string {
  const s = String(v);
  if (DEBUT_FORMULE.test(s)) {
    return `"'${s.replace(/"/g, '""')}"`;
  }
  if (s.includes(";") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvResponse(
  rows: (string | number)[][],
  filename: string
): Response {
  const body =
    "\uFEFF" + rows.map((r) => r.map(csvField).join(";")).join("\r\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const { clubId } = await params;
  const ctx = await getClubApiContext(clubId);
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "leaderboard";
  const saison = url.searchParams.get("saison") ?? "all";
  const seasonId = saison === "all" ? null : saison;
  const suffix = seasonId ? `saison-${seasonId}` : "toutes-saisons";

  if (type === "leaderboard") {
    const rows = await getLeaderboard({ clubId, seasonId });
    const lines: (string | number)[][] = [
      [
        "Joueur",
        "J",
        "V",
        "N",
        "D",
        "%V",
        "Buts",
        "Passes",
        "CSC",
        "Jaunes",
        "Rouges",
        "MVP",
        "Élo",
      ],
    ];
    for (const r of rows) {
      lines.push([
        r.name,
        r.matchesPlayed,
        r.wins,
        r.draws,
        r.losses,
        r.winPct,
        r.goals,
        r.assists,
        r.ownGoals,
        r.yellow,
        r.red,
        r.mvpCount,
        r.elo,
      ]);
    }
    return csvResponse(lines, `five-scorer-classement-${suffix}.csv`);
  }

  if (type === "matches") {
    const matches = await prisma.match.findMany({
      where: {
        clubId,
        status: "FINISHED",
        ...(seasonId ? { seasonId } : {}),
      },
      orderBy: { playedAt: "asc" },
      include: {
        opponent: { select: { name: true } },
        mvp: { select: { name: true } },
      },
    });
    const lines: (string | number)[][] = [
      ["Date", "Type", "ÉquipeA", "ÉquipeB", "ScoreA", "ScoreB", "MVP"],
    ];
    for (const m of matches) {
      const external = m.kind === "EXTERNAL";
      lines.push([
        m.playedAt.toISOString().slice(0, 10),
        external ? "Externe" : "Interne",
        external ? ctx.org.name : m.teamAName,
        external ? (m.opponent?.name ?? "Adversaire") : m.teamBName,
        m.scoreA,
        m.scoreB,
        m.mvp?.name ?? "",
      ]);
    }
    return csvResponse(lines, `five-scorer-matchs-${suffix}.csv`);
  }

  return NextResponse.json({ error: "invalid type" }, { status: 400 });
}
