"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/auth-client";

const inputCls =
 "w-full rounded-[2px] border border-[color:var(--rule)] bg-[color:var(--pitch-2)] px-3 py-2.5 outline-none focus:border-[color:var(--ink-1)]";

export default function LoginForm({
  next,
  googleEnabled,
}: {
  next?: string;
  googleEnabled: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const destination = next ?? "/onboarding";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn.email({ email, password });
    if (res.error) {
      // 401 = identifiants refusés, le cas normal : on reste vague, c'est
      // volontaire (ne pas révéler si l'email existe). Tout le reste est une
      // panne : on la nomme, sinon on cherche un mot de passe alors que le
      // serveur parle d'autre chose.
      const detail = res.error.message ?? res.error.statusText ?? "";
      setError(
        res.error.status === 401
          ? "Email ou mot de passe incorrect."
          : `Connexion impossible${detail ? ` — ${detail}` : ""}.`
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
        <span className="text-[13px] font-semibold text-[color:var(--ink-1)]">
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
        <span className="text-[13px] font-semibold text-[color:var(--ink-1)]">
          Mot de passe
        </span>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputCls}
        />
      </label>

      {error && (
        <p className="rounded-[2px] border border-[color:var(--loss)] bg-[color:var(--pitch-2)] px-3 py-2 text-sm font-bold text-[color:var(--loss)]">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="btn primary big w-full disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Connexion…" : "Se connecter"}
      </button>

      {googleEnabled && (
        <>
          <div className="flex items-center gap-3 text-[10px] font-bold  text-[color:var(--ink-2)]">
            <span className="h-px flex-1 bg-[color:var(--rule)]" />
            ou
            <span className="h-px flex-1 bg-[color:var(--rule)]" />
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
