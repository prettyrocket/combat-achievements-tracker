// React binding for account-type.ts.

import { useEffect, useSyncExternalStore } from "react";
import {
  ACCOUNT_TYPE_STORAGE_KEY,
  accountTypeFor,
  getStoredAccountType,
  refreshFromStorage,
  subscribe,
  type AccountType,
} from "@/lib/account-type";

/** What kind of account `rsn` is, or null if no lookup for that name said. */
export function useAccountType(rsn: string | null): AccountType | null {
  const stored = useSyncExternalStore(
    subscribe,
    getStoredAccountType,
    getStoredAccountType,
  );

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === ACCOUNT_TYPE_STORAGE_KEY)
        refreshFromStorage();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return accountTypeFor(stored, rsn);
}
