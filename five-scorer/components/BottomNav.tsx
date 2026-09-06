"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import Icon from "@/components/Icon";

type Props = {
  slug: string;
  canScore: boolean;
  canManage: boolean;
};

type Tab = {
  href: string;
  label: string;
  exact?: boolean;
  icon: React.ReactNode;
};

function HomeIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </svg>
  );
}

function BallIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5 16.3 10.6 14.65 15.65 H9.35 L7.7 10.6 Z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
      <path d="M3.5 10h17" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 21v-8" />
      <path d="M12 21V4" />
      <path d="M19 21v-12" />
    </svg>
  );
}

export default function BottomNav({ slug, canScore }: Props) {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);
  const base = `/c/${slug}`;

  const leftTabs: Tab[] = [
    { href: base, label: "Accueil", exact: true, icon: <HomeIcon /> },
    { href: `${base}/matches`, label: "Matchs", icon: <BallIcon /> },
  ];
  const rightTabs: Tab[] = [
    { href: `${base}/sessions`, label: "Sessions", icon: <CalendarIcon /> },
    { href: `${base}/stats`, label: "Stats", icon: <ChartIcon /> },
  ];

  // Le libellé porte l'action : pas d'icône par ligne — le texte se lit
  // plus vite qu'un pictogramme à deviner.
  const actions = [
    {
      href: `${base}/matches/new`,
      label: "Lancer un match maintenant",
      hint: "Score en direct dès le coup d'envoi",
    },
    {
      href: `${base}/matches/schedule`,
      label: "Programmer un match",
      hint: "Fixe une date, l'équipe confirme",
    },
    {
      href: `${base}/matches/new-session`,
      label: "Programmer une session",
      hint: "Une soirée, plusieurs matchs",
    },
  ];

  const renderTab = (t: Tab) => {
    const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
    return (
      <Link
        key={t.href}
        href={t.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "tap flex flex-1 flex-col items-center justify-center gap-1 pb-1.5 pt-2",
          active ? "text-[color:var(--lime)]" : "text-[color:var(--ink-2)]"
        )}
      >
        {t.icon}
        <span className="text-[10px] font-bold uppercase tracking-wider">
          {t.label}
        </span>
      </Link>
    );
  };

  return (
    <>
      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--stroke)] bg-[color:var(--bg-1)] sm:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex h-16 max-w-md items-stretch px-1">
          {leftTabs.map(renderTab)}
          {canScore && (
            <div className="flex flex-1 items-center justify-center">
              <div className="-translate-y-3">
                <button
                  type="button"
                  onClick={() => setSheetOpen(true)}
                  aria-label="Créer un match ou une session"
                  aria-haspopup="dialog"
                  aria-expanded={sheetOpen}
                  className="tap grid h-[52px] w-[52px] place-items-center rounded-full bg-[color:var(--lime)] text-[color:var(--bg-0)]"
                >
                  <Icon name="plus" size={22} />
                </button>
              </div>
            </div>
          )}
          {rightTabs.map(renderTab)}
        </div>
      </nav>

      {sheetOpen && (
        <div
          className="fixed inset-0 z-50 sm:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Créer un match ou une session"
        >
          <button
            type="button"
            aria-label="Fermer"
            onClick={() => setSheetOpen(false)}
            className="absolute inset-0 h-full w-full bg-black/60"
          />
          <div
            className="slide-up absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-[color:var(--stroke-hi)] bg-[color:var(--bg-1)] px-4 pt-3"
            style={{
              paddingBottom: "calc(1rem + env(safe-area-inset-bottom))",
            }}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[color:var(--stroke-hi)]" />
            {actions.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                onClick={() => setSheetOpen(false)}
                className="tap flex min-h-[56px] items-center justify-between gap-4 rounded-2xl px-3 py-3 active:bg-white/5"
              >
                <span className="min-w-0">
                  <span className="block text-[15px] font-bold text-[color:var(--ink-0)]">
                    {a.label}
                  </span>
                  <span className="block text-xs text-[color:var(--ink-2)]">
                    {a.hint}
                  </span>
                </span>
                <Icon
                  name="chevron"
                  size={16}
                  className="shrink-0 text-[color:var(--ink-2)]"
                />
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
