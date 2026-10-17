// RuneScape names, tidied and compared.
//
// Underscores and spaces are the same character in a name, runs of whitespace
// collapse, and case doesn't matter -- so "Lynx_Titan", "lynx titan" and
// " Lynx  Titan " are one player to every lookup and every comparison here.

/**
 * A typed name tidied for display, keeping the player's own capitalisation --
 * unlike normalizeRsn, which lowercases because it only ever compares.
 */
export function displayRsn(rsn: string): string {
  return rsn.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * The name of the last account imported from, so a later import can tell
 * whether the planned list it's about to sit beside was built for this account
 * or a different one. Prompting about a changed account because someone typed
 * an underscore would be noise.
 */
export function normalizeRsn(rsn: string): string {
  return displayRsn(rsn).toLowerCase();
}

export function sameAccount(a: string, b: string): boolean {
  return normalizeRsn(a) === normalizeRsn(b);
}
