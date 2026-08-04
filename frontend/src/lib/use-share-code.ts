// A share code in the address bar, waiting on a yes or no.
//
// Never applied on arrival: following a link is not consent to replace what
// this browser already holds, and the person clicking it may not know it
// carries anything. So this hook only *reads*; what to do about it is the
// prompt's question and App's answer.

import { useCallback, useEffect, useState } from "react";
import {
  clearShareCode,
  decodeShareCode,
  readShareCode,
  type ShareCodeResult,
} from "@/lib/share-code";

export interface IncomingShareCode {
  /** A readable code waiting on a decision, or null. */
  incoming: ShareCodeResult | null;
  /** Why an unreadable code couldn't be read, or null. */
  error: string | null;
  dismiss: () => void;
}

export function useShareCode(): IncomingShareCode {
  const [incoming, setIncoming] = useState<ShareCodeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Read once, on arrival. A malformed code is reported rather than ignored:
  // silently dropping it would look exactly like a link that did nothing.
  useEffect(() => {
    const code = readShareCode(window.location.hash);
    if (code === null) return;
    try {
      setIncoming(decodeShareCode(code));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "That share code could not be read.",
      );
      clearShareCode();
    }
  }, []);

  const dismiss = useCallback(() => {
    setIncoming(null);
    setError(null);
    clearShareCode();
  }, []);

  return { incoming, error, dismiss };
}
