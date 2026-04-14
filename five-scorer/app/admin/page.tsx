import AdminPinForm from "@/components/AdminPinForm";
import AdminLogoutBtn from "@/components/AdminLogoutBtn";
import { isAdmin } from "@/lib/auth";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const admin = await isAdmin();
  const { next } = await searchParams;

  return (
    <main className="mx-auto max-w-md px-5 py-12">
      <Link
        href="/"
        className="text-xs font-bold uppercase tracking-widest text-[color:var(--ink-2)] hover:text-white"
      >
        ← Accueil
      </Link>
      <div className="edge-top mt-8 rounded-2xl border border-[color:var(--stroke)] bg-[color:var(--bg-1)] p-6 text-center">
        <div className="mb-2 inline-block rounded-full bg-amber-500/20 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">
          🔒 Zone admin
        </div>
        <h1 className="mt-3 text-2xl font-black">Accès administrateur</h1>
        <p className="mt-1 text-sm text-[color:var(--ink-1)]">
          Requis pour modifier ou supprimer des matchs terminés.
        </p>

        {admin ? (
          <div className="mt-6 space-y-3">
            <div className="rounded-lg border border-[color:var(--a-500)]/40 bg-[color:var(--a-500)]/10 px-4 py-3 text-sm text-[color:var(--a-400)]">
              ✓ Session admin active
            </div>
            <div className="flex gap-2">
              {next && (
                <Link href={next} className="btn primary big flex-1">
                  Continuer →
                </Link>
              )}
              <AdminLogoutBtn className={next ? "btn ghost big flex-1" : "btn ghost big w-full"} />
            </div>
          </div>
        ) : (
          <AdminPinForm next={next} />
        )}
      </div>
    </main>
  );
}
