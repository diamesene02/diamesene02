"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export default function ClubNav({
  slug,
  canManage,
}: {
  slug: string;
  canManage: boolean;
}) {
  const pathname = usePathname();
  const base = `/c/${slug}`;

  const tabs = [
    { href: base, label: "Accueil", exact: true },
    { href: `${base}/matches`, label: "Matchs" },
    { href: `${base}/sessions`, label: "Soirées" },
    { href: `${base}/stats`, label: "Stats" },
    { href: `${base}/players`, label: "Joueurs" },
    ...(canManage ? [{ href: `${base}/settings`, label: "Réglages" }] : []),
  ];

  return (
    <nav className="scrollbar-none mt-4 hidden gap-1 overflow-x-auto rounded-none border border-[color:var(--rule)] bg-[color:var(--pitch-1)] p-1 sm:flex">
      {tabs.map((t) => {
        const active = t.exact
          ? pathname === t.href
          : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
 "whitespace-nowrap rounded-[2px] px-3.5 py-2 text-[13px] font-semibold transition-colors",
              active
                ? "bg-[color:var(--ink-1)] text-[color:var(--pitch-0)]"
                : "text-[color:var(--ink-1)] hover:bg-white/5 hover:text-white"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
