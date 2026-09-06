// Canvas renderer for match recap shareable image (1080x1080).

type Player = { id: string; name: string; goals: number; team: "A" | "B" };
type Goal = { id: string; scorerId: string; team: "A" | "B"; minute: number | null; createdAt: string };
type Match = {
  playedAt: string;
  teamAName: string;
  teamBName: string;
  scoreA: number;
  scoreB: number;
};

// Palette « craie sur gazon », alignée sur app/globals.css. Les valeurs
// sont dupliquées ici parce qu'un canvas ne lit pas les variables CSS ;
// elles doivent bouger avec les jetons.
const TOK = {
  bg0: "#0E1211", bg1: "#141917",
  ink0: "#F4F6F3", ink1: "#C8CFCB", ink2: "#ADB5B2",
  a: "#FF6B2C", aLight: "#FF996D",
  b: "#3D8BFF", bLight: "#83B5FF",
  gold: "#FFC24D",
};

// Archivo porte toute la typographie de l'app ; son axe de chasse donne
// aux scores l'allure d'un numéro de maillot. `font-stretch` n'existant
// pas dans l'API canvas, on passe par la syntaxe raccourcie de ctx.font,
// qui l'accepte.
const UI = '"Archivo", system-ui, sans-serif';
const NUM = '62% "Archivo", system-ui, sans-serif';

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function renderShareCard({
  match,
  teamA,
  teamB,
  goals,
  mvpName,
}: {
  match: Match;
  teamA: Player[];
  teamB: Player[];
  goals: Goal[];
  mvpName?: string | null;
}): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, 1080);
  bg.addColorStop(0, TOK.bg1);
  bg.addColorStop(1, TOK.bg0);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1080, 1080);

  const aWash = ctx.createLinearGradient(0, 0, 540, 0);
  aWash.addColorStop(0, "rgba(34,197,94,0.16)");
  aWash.addColorStop(1, "transparent");
  ctx.fillStyle = aWash;
  ctx.fillRect(0, 0, 540, 1080);

  const bWash = ctx.createLinearGradient(1080, 0, 540, 0);
  bWash.addColorStop(0, "rgba(56,189,248,0.16)");
  bWash.addColorStop(1, "transparent");
  ctx.fillStyle = bWash;
  ctx.fillRect(540, 0, 540, 1080);

  // Header
  ctx.fillStyle = TOK.ink1;
  ctx.font = `600 28px ${UI}`;
  ctx.textAlign = "center";
  ctx.fillText("⚽ FIVE SCORER", 540, 90);

  ctx.fillStyle = TOK.ink2;
  ctx.font = `500 22px ${UI}`;
  const date = new Date(match.playedAt).toLocaleDateString("fr-FR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });
  ctx.fillText(date, 540, 130);

  // Team names
  ctx.font = `700 44px ${UI}`;
  ctx.fillStyle = TOK.aLight;
  ctx.fillText(match.teamAName.toUpperCase(), 290, 260);
  ctx.fillStyle = TOK.bLight;
  ctx.fillText(match.teamBName.toUpperCase(), 790, 260);

  // Score
  const winA = match.scoreA > match.scoreB;
  const winB = match.scoreB > match.scoreA;

  ctx.font = `800 220px ${NUM}`;
  ctx.fillStyle = winA ? TOK.gold : TOK.ink1;
  if (winA) { ctx.shadowColor = "rgba(245,179,1,0.5)"; ctx.shadowBlur = 40; }
  ctx.fillText(String(match.scoreA), 290, 440);
  ctx.shadowBlur = 0;

  ctx.fillStyle = TOK.ink2;
  ctx.font = `500 140px ${NUM}`;
  ctx.fillText(":", 540, 430);

  ctx.font = `800 220px ${NUM}`;
  ctx.fillStyle = winB ? TOK.gold : TOK.ink1;
  if (winB) { ctx.shadowColor = "rgba(245,179,1,0.5)"; ctx.shadowBlur = 40; }
  ctx.fillText(String(match.scoreB), 790, 440);
  ctx.shadowBlur = 0;

  // MVP pill
  if (mvpName) {
    const mvpText = "⭐ MVP : " + mvpName.toUpperCase();
    ctx.font = `700 32px ${UI}`;
    const tw = ctx.measureText(mvpText).width;
    const pillW = tw + 60;
    const pillX = (1080 - pillW) / 2;
    ctx.fillStyle = TOK.gold;
    drawRoundedRect(ctx, pillX, 495, pillW, 56, 28);
    ctx.fill();
    ctx.fillStyle = "#0E1211";
    ctx.fillText(mvpText, 540, 534);
  }

  const goalCount: Record<string, number> = {};
  goals.forEach((g) => {
    goalCount[g.scorerId] = (goalCount[g.scorerId] ?? 0) + 1;
  });
  const allPlayers = [...teamA, ...teamB];
  const scorers = allPlayers
    .filter((p) => goalCount[p.id])
    .sort((a, b) => goalCount[b.id] - goalCount[a.id])
    .slice(0, 5);

  const startY = mvpName ? 640 : 600;
  ctx.textAlign = "left";
  ctx.fillStyle = TOK.ink1;
  ctx.font = `700 22px ${UI}`;
  ctx.fillText("BUTEURS", 140, startY);

  scorers.forEach((p, i) => {
    const y = startY + 50 + i * 60;
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "·";
    ctx.font = `700 28px ${UI}`;
    ctx.fillStyle = TOK.ink0;
    ctx.fillText(`${medal}  ${p.name}`, 140, y);
    const count = goalCount[p.id];
    ctx.fillStyle = TOK.gold;
    ctx.font = `800 40px ${NUM}`;
    ctx.fillText(String(count), 560, y);
    ctx.fillStyle = TOK.ink1;
    ctx.font = `600 26px ${UI}`;
    const teamName = p.team === "A" ? match.teamAName : match.teamBName;
    ctx.fillText(teamName, 760, y);
  });

  // Watermark
  ctx.fillStyle = TOK.ink2;
  ctx.font = `500 18px ${UI}`;
  ctx.textAlign = "center";
  ctx.fillText("FIVE SCORER · urban foot", 540, 1030);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png", 0.92));
}

export async function shareMatchImage(
  data: Parameters<typeof renderShareCard>[0],
  publicUrl?: string
): Promise<void> {
  const blob = await renderShareCard(data);
  if (!blob) return;
  const file = new File([blob], `five-scorer-${Date.now()}.png`, { type: "image/png" });
  const nav = navigator as Navigator & {
    canShare?: (d: { files?: File[]; url?: string; text?: string }) => boolean;
  };

  // 1. Try sharing the image as a file (best UX on supported mobiles)
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Match Five Scorer" });
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
  }

  // 2. Try sharing just the public URL (works everywhere share is supported)
  if (publicUrl && nav.canShare && nav.canShare({ url: publicUrl })) {
    try {
      await navigator.share({ title: "Match Five Scorer", url: publicUrl });
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
  }

  // 3. Fallback: open the image in a new tab so the user can save/share manually
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (!win) {
    // popup blocked → download
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
