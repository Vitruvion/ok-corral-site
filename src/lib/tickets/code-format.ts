/**
 * Ticket code shape and normalisation. NO crypto, NO node imports.
 *
 * Split out of codes.ts so the browser can use it. codes.ts imports
 * node:crypto for signing and cannot be bundled for the client, but the
 * door scanner has to normalise codes exactly the way the server does --
 * if the two ever disagreed, a hand-typed code would silently fail to
 * match a manifest entry. One definition, both sides.
 */

/**
 * 32 characters, chosen to survive being read aloud across a noisy bar
 * and typed in by someone who is not looking closely.
 *
 * Excluded: 0, 1, I, L. That kills the 0/O and 1/I/l confusions in
 * both directions -- O and U are kept because with 0 and 1 gone there
 * is nothing left for them to be mistaken FOR.
 */
export const TICKET_CODE_ALPHABET = '23456789ABCDEFGHJKMNOPQRSTUVWXYZ'

/** Characters per code. 12 x 5 bits = 60 bits of entropy. */
export const CODE_LENGTH = 12

/** Characters of signature. 16 x 5 bits = the first 80 bits of the HMAC. */
export const SIG_LENGTH = 16

/** `ABCD-EFGH-JKMN` -- for email, print, and reading aloud at the door. */
export function formatTicketCode(code: string): string {
  return (code.match(/.{1,4}/g) ?? [code]).join('-')
}

/**
 * Canonicalises anything a human might type or a scanner might hand
 * back: lowercase, dashes, spaces.
 *
 * The hyphens matter. The confirmation email prints PNGV-XSBT-67MR
 * while the QR payload carries PNGVXSBT67MR, and a doorman typing a
 * code in will type what they can see. Both sides of every comparison
 * go through here.
 *
 * A typed '0' is folded to 'O' and never the other way round, because
 * '0' is not in the alphabet so it cannot have been meant literally.
 * '1' is deliberately NOT folded -- it could stand for either I or L,
 * both of which are also out of the alphabet, so there is no
 * defensible target and a silent wrong guess is worse than a miss.
 */
export function normalizeTicketCode(input: string): string {
  return String(input ?? '')
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/0/g, 'O')
}

/** Shape check only -- says nothing about whether the code is genuine. */
export function isWellFormedCode(code: string): boolean {
  if (code.length !== CODE_LENGTH) return false
  for (const ch of code) if (!TICKET_CODE_ALPHABET.includes(ch)) return false
  return true
}
