"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "@/lib/auth-client";

const inputCls =
 "w-full rounded-[2px] border border-[color:var(--rule)] bg-[color:var(--pitch-2)] px-3 py-2.5 outline-none focus:border-[color:var(--ink-1)]";

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
      // Ne jamais inventer la cause : un message affirmatif et faux envoie
      // le diagnostic dans le mur. On nomme le cas courant, puis on montre
      // ce que le serveur a réellement répondu.
      const detail = res.error.message ?? res.error.statusText ?? "";
      setError(
        res.error.status === 422
          ? "Cet email est déjà utilisé."
          : `Création impossible${detail ? ` — ${detail}` : ""}.`
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
        <span className="text-[15px] text-[color:var(--i2)]">
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
        <p className="bv-erreur">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="plein w-full"
      >
        {loading ? "Création…" : "Créer mon compte"}
      </button>

      <p className="bv-pied">
        En créant un compte, tu acceptes les{" "}
        <Link href="/terms" >
          CGU
        </Link>{" "}
        et la{" "}
        <Link href="/privacy" >
          politique de confidentialité
        </Link>
        .
      </p>

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
