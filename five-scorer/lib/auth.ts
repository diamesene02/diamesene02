import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";
import bcrypt from "bcryptjs";

export type ScoringSession = {
  unlocked?: boolean;
  unlockedAt?: number;
};

const SESSION_COOKIE = "five_scorer_session";

export function sessionOptions(): SessionOptions {
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set and at least 32 characters long"
    );
  }
  return {
    password,
    cookieName: SESSION_COOKIE,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    },
  };
}

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<ScoringSession>(cookieStore, sessionOptions());
}

export async function isUnlocked(): Promise<boolean> {
  const session = await getSession();
  return Boolean(session.unlocked);
}

export function verifyPin(pin: string): boolean {
  const hash = process.env.SCORING_PIN_HASH;
  if (!hash) return false;
  try {
    return bcrypt.compareSync(pin, hash);
  } catch {
    return false;
  }
}
