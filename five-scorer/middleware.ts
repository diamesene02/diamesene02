import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "five_scorer_session";

// Pages that don't need any auth (anyone can see).
const PUBLIC_PATHS = [
  "/",
  "/pin",
  "/admin",
  "/stats",
  "/matches/history",
  "/r",
];

// Matches /matches/<id> exactly (public recap) but NOT /matches/<id>/edit or /live.
const MATCH_RECAP_RE = /^\/matches\/[^/]+$/;

// Matches /matches/<id>/edit (requires admin — handled at page level via isAdmin()).
// Edit page is still reachable (no redirect), but the page itself redirects
// non-admin users to /admin?next=... via a server-side check.
const MATCH_EDIT_RE = /^\/matches\/[^/]+\/edit$/;

function isPublicApi(pathname: string): boolean {
  // Public API endpoints: auth + public match reads
  if (pathname.startsWith("/api/auth/")) return true;
  // Allow GET on match detail (used by the public recap pages through server rendering,
  // but also by any future reader). Mutations (POST/PATCH/DELETE) are still guarded
  // inside the handlers themselves.
  return false;
}

function isPublic(pathname: string): boolean {
  if (isPublicApi(pathname)) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/icons")) return true;
  if (pathname.startsWith("/fonts")) return true;
  if (pathname === "/manifest.webmanifest") return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname === "/sw.js") return true;
  if (pathname === "/quick.html") return true;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return true;
  }
  // Recap of a specific match is public
  if (MATCH_RECAP_RE.test(pathname)) return true;
  return false;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // The /matches/[id]/edit page is admin-only — we send non-authenticated
  // users through the PIN gate first. The page itself performs the
  // finer-grained admin check.
  if (MATCH_EDIT_RE.test(pathname)) {
    const hasSession = req.cookies.has(SESSION_COOKIE);
    if (!hasSession) {
      const url = req.nextUrl.clone();
      url.pathname = "/pin";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (isPublic(pathname)) return NextResponse.next();

  const hasSession = req.cookies.has(SESSION_COOKIE);
  if (!hasSession) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/pin";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|fonts|manifest.webmanifest|sw.js|quick.html).*)",
  ],
};
