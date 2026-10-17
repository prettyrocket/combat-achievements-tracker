// What kind of account the remembered name is: Ironman, Hardcore, and so on.
//
// Both lookups say, and a Manual player picks it beside their name. Kept beside
// the name it describes rather than in the profile store: it isn't something
// you can do, and it doesn't belong in a backup or a share code. A record for some other name says nothing about this
// one, so it answers only for the name it was stored against.
//
// Same shape as the other stores: plain functions over a cached snapshot, with
// the React binding in use-account-type.ts.

import { readJson, writeJson } from "@/lib/local-store";
import { displayRsn, sameAccount } from "@/lib/rsn";

const STORAGE_KEY = "ca-tracker:account-type:v1";

export const ACCOUNT_TYPES = [
  "regular",
  "ironman",
  "hardcore",
  "ultimate",
  "group",
  "hardcore_group",
  "unranked_group",
] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  // "Main" is what players call it; both sources say regular or normal.
  regular: "Main",
  ironman: "Ironman",
  hardcore: "Hardcore Ironman",
  ultimate: "Ultimate Ironman",
  group: "Group Ironman",
  hardcore_group: "Hardcore Group Ironman",
  unranked_group: "Unranked Group Ironman",
};

/**
 * Either source's word for it, as one vocabulary.
 *
 * Wise Old Man says regular / ironman / hardcore / ultimate, and `unknown` when
 * it hasn't worked it out -- it has no word for any group type. RuneProfile
 * says normal / ironman / hardcore_ironman / ultimate_ironman and the three
 * group types, taken from RuneLite. Checked against both projects' sources
 * (2026-10-17) rather than a reply or two, which would never have shown the
 * group types. Anything else is no answer.
 */
const ALIASES: Readonly<Record<string, AccountType>> = {
  regular: "regular",
  normal: "regular",
  ironman: "ironman",
  hardcore: "hardcore",
  hardcore_ironman: "hardcore",
  ultimate: "ultimate",
  ultimate_ironman: "ultimate",
  group_ironman: "group",
  hardcore_group_ironman: "hardcore_group",
  unranked_group_ironman: "unranked_group",
};

export function parseAccountType(raw: unknown): AccountType | null {
  if (typeof raw !== "string") return null;
  return ALIASES[raw.trim().toLowerCase()] ?? null;
}

export interface StoredAccountType {
  rsn: string;
  type: AccountType;
}

function isAccountType(value: unknown): value is AccountType {
  return (ACCOUNT_TYPES as readonly unknown[]).includes(value);
}

/** The record on disk, or null if there's none worth reading. */
function read(): StoredAccountType | null {
  const stored = readJson(STORAGE_KEY);
  if (stored === null || typeof stored !== "object" || Array.isArray(stored))
    return null;
  const { rsn, type } = stored as Record<string, unknown>;
  if (typeof rsn !== "string" || displayRsn(rsn) === "") return null;
  if (!isAccountType(type)) return null;
  return { rsn, type };
}

// undefined until first asked, so importing this module touches no storage.
let current: StoredAccountType | null | undefined;
const listeners = new Set<() => void>();

/** The stored record, stable between writes as useSyncExternalStore needs. */
export function getStoredAccountType(): StoredAccountType | null {
  if (current === undefined) current = read();
  return current;
}

/** What kind of account `rsn` is, if anything has said for that name. */
export function accountTypeFor(
  stored: StoredAccountType | null,
  rsn: string | null,
): AccountType | null {
  if (rsn === null || stored === null) return null;
  return sameAccount(stored.rsn, rsn) ? stored.type : null;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * What a lookup said, or a Manual player picked, for that name.
 *
 * The latest answer wins, since a type really does change: a Hardcore dies, an
 * Ironman de-irons. No answer leaves the last one alone -- `unknown` from Wise
 * Old Man is it not knowing, not the account having changed.
 */
export function recordAccountType(rsn: string, type: AccountType | null): void {
  const name = displayRsn(rsn);
  if (type === null || name === "") return;
  const stored = getStoredAccountType();
  if (stored !== null && stored.rsn === name && stored.type === type) return;
  current = { rsn: name, type };
  writeJson(STORAGE_KEY, current);
  for (const listener of listeners) listener();
}

/** Re-read from disk. For the `storage` event: another tab already wrote. */
export function refreshFromStorage(): void {
  const next = read();
  if (next?.rsn === current?.rsn && next?.type === current?.type) return;
  current = next;
  for (const listener of listeners) listener();
}

export { STORAGE_KEY as ACCOUNT_TYPE_STORAGE_KEY };
