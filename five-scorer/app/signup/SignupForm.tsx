"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "@/lib/auth-client";

const inputCls =
  "w-full rounded-lg border border-[color:var(--stroke)] bg-[color:var(--bg-2)] px-3 py-2.5 outline-none focus:border-[color:var(--lime)]";

export default function SignupForm({
  next,
  googleEnabled,
}: {
  next?: string;
  googleEnabled: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const destination = next ?? "/onboarding";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("8 caractères minimum pour le mot de passe.");
      return;
    }
    setLoading(true);
    const res = await signUp.email({ name: name.trim(), email, password });
    if (res.error) {
      setError(
        "Impossible de créer le compte. Cet email est peut-être déjà utilisé."
      );
      setLoading(false);
      return;
    }
    router.push(destination);
    router.refresh();
  }

  async function onGoogle() {
    setError(null);
    setLoading(true);
    await signIn.social({ provider: "google", callbackURL: destination });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-bold uppercase tracking-wider text-[color:var(--ink-1)]">
          Ton nom
        </span>
        <input
          type="text"
          name="name"
          required
          autoComplete="name"
          placeholder="Karim, Momo, Le Gaucher…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputCls}
        />
        <span className="text-xs text-[color:var(--ink-2)]">
          Celui que tes potes connaissent.
        </span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-bold uppercase tracking-wider text-[color:var(--ink-1)]">
          Email
        </span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="toi@exemple.fr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputCls}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-bold uppercase tracking-wider text-[color:var(--ink-1)]">
          Mot de passe
        </span>
        <input
          type="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputCls}
        />
        <span className="text-xs text-[color:var(--ink-2)]">
          8 caractères minimum.
        </span>
      </label>

      {error && (
        <p className="rounded-lg border border-[color:var(--loss)] bg-[color:var(--bg-2)] px-3 py-2 text-sm font-bold text-[color:var(--loss)]">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="btn primary big w-full disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Création…" : "Créer mon compte"}
      </button>

      <p className="text-center text-[11px] leading-relaxed text-[color:var(--ink-2)]">
        En créant un compte, tu acceptes les{" "}
        <Link href="/terms" className="underline hover:text-white">
          CGU
        </Link>{" "}
        et la{" "}
        <Link href="/privacy" className="underline hover:text-white">
          politique de confidentialité
        </Link>
        .
      </p>

      {googleEnabled && (
        <>
          <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-[color:var(--ink-2)]">
            <span className="h-px flex-1 bg-[color:var(--stroke)]" />
            ou
            <span className="h-px flex-1 bg-[color:var(--stroke)]" />
          </div>
          <button
            type="button"
            onClick={onGoogle}
            disabled={loading}
            className="btn ghost w-full disabled:cursor-not-allowed disabled:opacity-60"
          >
            Continuer avec Google
          </button>
        </>
      )}
    </form>
  );
}
