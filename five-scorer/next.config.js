/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    // Identifiant du build, lu par RegisterSW pour versionner le service
    // worker. Sur Vercel : le commit ; en local : l'instant du build.
    NEXT_PUBLIC_BUILD_ID:
      (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 12) ||
      String(Date.now()),
  },
  experimental: {
    typedRoutes: false,
  },
};

module.exports = nextConfig;
