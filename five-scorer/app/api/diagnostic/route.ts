import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserSession } from "@/lib/guard";

export const dynamic = "force-dynamic";

/// « Pourquoi c'est lent ? »
///
/// La réponse ne se devine pas : elle dépend d'où tourne la fonction et d'où
/// vit la base. Une page qui fait dix allers-retours vers une base située de
/// l'autre côté de l'Atlantique met deux secondes sans qu'aucune requête ne
/// soit lente. Cette route mesure ce qui compte, et rien d'autre.
///
/// Elle ne renvoie JAMAIS l'URL de connexion ni l'identifiant : seulement la
/// région déduite du nom d'hôte, et des durées.
function regionDeLaBase(): string {
  const url = process.env.DATABASE_URL ?? "";
  const hote = url.match(/@([^/:?]+)/)?.[1] ?? "";
  // Neon : ep-xxx-123456.eu-central-1.aws.neon.tech
  const m = hote.match(/\.([a-z]{2}-[a-z]+-\d)\.[a-z]+\.neon\.tech/);
  if (m) return m[1];
  if (hote.includes("localhost") || hote.includes("127.0.0.1")) return "local";
  return "inconnue";
}

export async function GET() {
  const session = await getUserSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Premier appel : il paie l'ouverture de connexion si l'instance est froide.
  const t0 = Date.now();
  await prisma.$queryRaw`SELECT 1`;
  const premier = Date.now() - t0;

  // Les suivants : le coût d'un aller-retour sur une connexion établie.
  const t1 = Date.now();
  for (let i = 0; i < 5; i++) await prisma.$queryRaw`SELECT 1`;
  const parAllerRetour = Math.round((Date.now() - t1) / 5);

  return NextResponse.json({
    regionFonction: process.env.VERCEL_REGION ?? "local",
    regionBase: regionDeLaBase(),
    premierAllerRetourMs: premier,
    allerRetourMs: parAllerRetour,
  });
}
