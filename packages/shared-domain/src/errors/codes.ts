/**
 * Error primitives for the shared domain kernel (ADR-0007).
 *
 * ADR-0007: domain errors carry stable, machine-readable codes and structured
 * params; messages are default human text, replaceable by localisation later.
 */

/**
 * The kernel's error codes and the structured params each one carries.
 *
 * Codes are the contract (ADR-0007), so adding one here is a deliberate,
 * visible contract change — the extension mechanism is still open.
 *
 * This stays an `interface` because declaration merging works in this
 * setup, but merging is program-wide and therefore breaks this file's
 * exhaustiveness guarantee: a fixed literal like `ERROR_MESSAGES` cannot be
 * exhaustive over a key set that another file can extend. Merging is hence
 * not simply the mechanism; the choice between the two coherent options is
 * open: a closed registry here with compile-time exhaustiveness (every new
 * code edits this package, and a code whose params carry an aggregate-local
 * type would drag that aggregate's types in), or a mergeable registry with
 * per-module message tables and per-module exhaustiveness tests (a thin
 * contract package, at the cost of ADR-0007's guarantee fragmenting). The
 * question that will decide it is whether an error's params ever carry an
 * aggregate-local type.
 */
export interface ErrorCodeMap {
  INVALID_ID: { value: string };
}

/** The union of every error code known to the kernel. */
export type ErrorCode = keyof ErrorCodeMap;

/**
 * Default human text per code, keyed by code. This table is the localisation
 * seam: copy lives here and nowhere else. It is exhaustive by construction —
 * adding a code to `ErrorCodeMap` without a message function here fails the
 * build instead of degrading silently into the generic path (ADR-0007).
 */
export const ERROR_MESSAGES: {
  [C in ErrorCode]: (params: ErrorCodeMap[C]) => string;
} = {
  INVALID_ID: ({ value }) => `Invalid ID: ${value}`,
};