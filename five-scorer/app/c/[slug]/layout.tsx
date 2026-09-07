import { cookies } from "next/headers";
import { requireClub } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import ClubTheme from "@/components/ClubTheme";
import OfflinePrimer from "@/components/OfflinePrimer";
import BarreClub from "@/components/ios/BarreClub";

// Le cadre de chaque écran du club.
//
// Le fond est calculé depuis les deux chasubles (ClubTheme), en sombre ou en
// clair selon le cookie. Une seule barre en haut : « Five Scorer » et la
// pilule du club sur l'accueil, le retour et la pilule ailleurs. Plus de
// barre d'onglets en bas, plus d'en-tête de marque : le menu en verre porte
// toute la navigation, comme sur la maquette.
export default async function ClubLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [ctx, jar] = await Promise.all([requireClub(slug), cookies()]);
  const theme = parseTheme(jar.get(THEME_COOKIE)?.value);

  const moi = await prisma.player.findFirst({
    where: { clubId: ctx.club.id, userId: ctx.user.id },
    select: { id: true },
  });

  // Le nom court : « FC Lundi Soir » devient « Lundi Soir » dans la pilule.
  const clubShort = ctx.org.name.replace(/^(FC|AS|US|SC|Five)\s+/i, "");

  return (
    <div data-club-theme data-theme={theme} className="relative">
      <ClubTheme colorA={ctx.club.colorA} colorB={ctx.club.colorB} theme={theme} />
      <OfflinePrimer
        club={{
          id: ctx.club.id,
          slug,
          name: ctx.org.name,
          colorA: ctx.club.colorA,
          colorB: ctx.club.colorB,
          trackAssists: ctx.club.trackAssists,
          trackCards: ctx.club.trackCards,
          motmMode: ctx.club.motmMode,
          matchDurationMin: ctx.club.matchDurationMin,
        }}
      />

      <div className="relative mx-auto min-h-dvh max-w-[520px] pb-12">
        <BarreClub
          slug={slug}
          clubShort={clubShort}
          userName={ctx.user.name}
          myPlayerId={moi?.id ?? null}
          canManage={ctx.canManage}
          publicUrl={ctx.club.isPublic ? `/p/${slug}` : null}
        />
        <div className="px-[14px] pt-4">{children}</div>
      </div>
    </div>
  );
}
