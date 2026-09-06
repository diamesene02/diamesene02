"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";

export default function UserMenu({
  name,
  slug,
  canManage,
}: {
  name: string;
  slug: string;
  canManage: boolean;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Menu du compte"
        className="grid h-9 w-9 place-items-center rounded-full border border-[color:var(--stroke-hi)] bg-[color:var(--bg-2)] text-xs font-black text-[color:var(--lime)]"
      >
        {initials || "?"}
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-xl border border-[color:var(--stroke-hi)] bg-[color:var(--bg-1)] shadow-2xl">
            <div className="border-b border-[color:var(--stroke)] px-4 py-3 text-sm font-bold">
              {name}
            </div>
            <Link
              href={`/c/${slug}/players`}
              className="block px-4 py-2.5 text-sm text-[color:var(--ink-1)] hover:bg-white/5"
              onClick={() => setOpen(false)}
            >
              Joueurs
            </Link>
            {canManage && (
              <Link
                href={`/c/${slug}/settings`}
                className="block px-4 py-2.5 text-sm text-[color:var(--ink-1)] hover:bg-white/5"
                onClick={() => setOpen(false)}
              >
                Réglages
              </Link>
            )}
            <div className="my-1 border-t border-[color:var(--stroke)]" />
            <Link
              href="/onboarding"
              className="block px-4 py-2.5 text-sm text-[color:var(--ink-1)] hover:bg-white/5"
              onClick={() => setOpen(false)}
            >
              Mes clubs
            </Link>
            <button
              onClick={async () => {
                await signOut();
                router.push("/login");
                router.refresh();
              }}
              className="block w-full px-4 py-2.5 text-left text-sm text-[color:var(--loss)] hover:bg-white/5"
            >
              Se déconnecter
            </button>
          </div>
        </>
      )}
    </div>
  );
}
