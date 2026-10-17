// React binding for account-type.ts.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ACCOUNT_TYPE_STORAGE_KEY,
  accountTypeFor,
  getStoredAccountType,
  recordAccountType,
  refreshFromStorage,
  subscribe,
  type AccountType,
} from "@/lib/account-type";

/** What kind of account `rsn` is, or null if nothing has said for that name. */
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

export interface AccountTypeDraft {
  type: AccountType | null;
  /** A pick in the name row. */
  pick: (type: AccountType) => void;
  /** On close: keeps the pick for whatever name the row ended up holding. */
  commit: (rsn: string) => void;
}

/**
 * The name row's type picker, held until the dialog closes -- the name's own
 * timing, so the two land together.
 *
 * Seeded from the stored type each opening, and committed only if it was
 * actually picked: otherwise changing the name on a lookup pane would hand the
 * old account's type to the new name.
 */
export function useAccountTypeDraft(
  open: boolean,
  lastRsn: string | null,
): AccountTypeDraft {
  const [type, setType] = useState<AccountType | null>(null);
  const picked = useRef(false);

  useEffect(() => {
    if (!open) return;
    picked.current = false;
    setType(accountTypeFor(getStoredAccountType(), lastRsn));
  }, [open, lastRsn]);

  const pick = useCallback((next: AccountType) => {
    picked.current = true;
    setType(next);
  }, []);

  const commit = useCallback(
    (rsn: string) => {
      if (picked.current) recordAccountType(rsn, type);
    },
    [type],
  );

  return { type, pick, commit };
}
