/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Un `next build` de vérification lancé pendant que `pnpm dev` tourne écrit
  // dans le même `.next` et laisse le serveur de développement avec un
  // manifeste de production : toutes les routes dynamiques passent en 404
  // jusqu'au redémarrage. C'est arrivé, et le symptôme n'accuse rien.
  // NEXT_DIST_DIR permet de bâtir à côté sans y toucher.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  env: {
    // Identifiant du build, lu par RegisterSW pour versionner le service
    // worker. Sur Vercel : le commit ; en local : l'instant du build.
    NEXT_PUBLIC_BUILD_ID:
      (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 12) ||
      String(Date.now()),
  },
  // Next 16 refuse les requêtes de développement venant d'une autre origine
  // que localhost. Or on développe l'app mobile depuis l'IP du Mac sur le
  // réseau local : sans cette liste, le rechargement à chaud est refusé et
  // l'app Expo ne peut pas parler au serveur de dev.
  //
  // Uniquement en développement — Next ignore ce réglage en production.
  allowedDevOrigins: (process.env.DEV_ORIGINS ?? "192.168.1.192")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean),
  experimental: {
    typedRoutes: false,
  },
};

module.exports = nextConfig;
