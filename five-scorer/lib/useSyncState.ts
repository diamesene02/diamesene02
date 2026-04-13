"use client";

import { useEffect, useState } from "react";
import { subscribeSync, type SyncState } from "./sync";

export function useSyncState(): SyncState {
  const [s, setS] = useState<SyncState>({
    online: typeof navigator !== "undefined" ? navigator.onLine : true,
    pending: 0,
    syncing: false,
    lastError: null,
    lastSyncedAt: null,
  });
  useEffect(() => subscribeSync(setS), []);
  return s;
}
