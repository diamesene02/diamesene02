"use client";

import { useEffect, useState } from "react";

// « Je vois une vieille version » — de quoi ? Du web, ou de l'APK ? Sans
// numéro à l'écran, personne ne peut le dire. Le build web vient de la
// variable injectée au build ; la version Android est glissée par la coquille
// dans le User-Agent (appendUserAgent), donc lisible ici sans plugin.
export default function VersionBadge() {
  const [android, setAndroid] = useState<string | null>(null);
  useEffect(() => {
    const m = navigator.userAgent.match(/FiveScorer\/([\w.]+)\s*\(([^)]+)\)/);
    if (m) setAndroid(`${m[1]} · ${m[2]}`);
  }, []);
  const web = (process.env.NEXT_PUBLIC_BUILD_ID ?? "dev").slice(0, 7);
  return (
    <p className="version-badge">
      web {web}
      {android ? ` · android ${android}` : ""}
    </p>
  );
}
