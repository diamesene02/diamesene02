"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/auth-client";

const inputCls =
 "w-full rounded-[2px] border border-[color:var(--rule)] bg-[color:var(--pitch-2)] px-3 py-2.5 outline-none focus:border-[color:var(--ink-1)]";

export default function LoginForm({
  next,
  googleEnabled,
  googleDirect = false,
}: {
  next?: string;
  googleEnabled: boolean;
  /// Arrivé depuis « Continuer avec Google » sur l'accueil : on lance tout
  /// de suite, sans redemander.
  googleDirect?: boolean;
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
  useEffect(() => {
    if (googleDirect && googleEnabled) void onGoogle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-[15px] text-[color:var(--i2)]">
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
        <span className="text-[15px] text-[color:var(--i2)]">
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
        <p className="bv-erreur">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="plein w-full"
      >
        {loading ? "Connexion…" : "Se connecter"}
      </button>

      {googleEnabled && (
        <>
          <div className="bv-ou">ou</div>
          <button
            type="button"
            onClick={onGoogle}
            disabled={loading}
            className="verre grand w-full"
          >
            Continuer avec Google
          </button>
        </>
      )}
    </form>
  );
}
