import { ERROR_MESSAGES } from "./codes.js";
import type { ErrorCode, ErrorCodeMap } from "./codes.js";

/**
 * A single table-driven domain error (ADR-0007): one class, many codes, never
 * one class per error. Constructing with a concrete code pins the params type,
 * so `new DomainError("INVALID_ID", ...)` demands the right params and reading
 * them back keeps the right types.
 *
 * The default message comes from the error table; an explicit `message`
 * argument wins when given. Deliberately framework-free: it never carries an
 * HTTP status (the transport boundary maps code to status) and never carries a
 * `requestId` (ADR-0008 mints it at the transport edge and the exception
 * filter adds it to the envelope).
 */
export class DomainError<C extends ErrorCode = ErrorCode> extends Error {
  readonly code: C;
  readonly params: ErrorCodeMap[C];

  constructor(code: C, params: ErrorCodeMap[C], message?: string) {
    super(message ?? ERROR_MESSAGES[code](params));
    this.name = "DomainError";
    this.code = code;
    this.params = params;
  }
}