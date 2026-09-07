import Link from "next/link";
import { requireClub } from "@/lib/guard";
import SyncBadge from "@/components/SyncBadge";
import UserMenu from "@/components/UserMenu";
import ClubNav from "@/components/ClubNav";
import BottomNav from "@/components/BottomNav";
import Icon from "@/components/Icon";
import ClubTheme from "@/components/ClubTheme";

export default async function ClubLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireClub(slug);

  return (
    <div data-club-theme className="relative min-h-screen">
      {/* Les couleurs de chasubles du club redéfinissent les jetons
          d'équipe pour tout ce qui est rendu en dessous. */}
      <ClubTheme colorA={ctx.club.colorA} colorB={ctx.club.colorB} />

      <div className="pointer-events-none fixed inset-0 opacity-30">
        <div className="pitch-motif absolute inset-0" />
      </div>

      {/* Plein cadre : les bandes touchent les deux bords de l'écran, et c'est
          leur contenu qui est rembourré. Un contenu flottant entre deux marges
          fait une pile de cartes, pas un panneau. */}
      <div className="relative mx-auto max-w-4xl px-5 pb-24 pt-4">
        <header className="flex items-center justify-between gap-3">
          <Link href={`/c/${slug}`} className="brand-pill max-w-[55vw]">
            <Icon name="ball" size={14} />
            <span className="min-w-0 truncate">{ctx.org.name}</span>
          </Link>
          <div className="flex items-center gap-2">
            <SyncBadge compact />
            <UserMenu
              name={ctx.user.name}
              slug={slug}
              canManage={ctx.canManage}
            />
          </div>
        </header>

        <ClubNav slug={slug} canManage={ctx.canManage} />

        <div className="mt-6">{children}</div>

        {/* Spacer : dégage la BottomNav fixe sur mobile */}
        <div aria-hidden className="h-20 sm:hidden" />
      </div>

      <BottomNav
        slug={slug}
        canScore={ctx.canScore}
        canManage={ctx.canManage}
      />
    </div>
  );
}
