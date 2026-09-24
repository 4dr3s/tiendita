/**
 * @tiendita/shared-domain
 *
 * Shared domain primitives for TIENDITA v2: value objects, invariants and
 * cross-app domain contracts.
 *
 * Public surface: the `Id` value object (branded UUIDv7) and its schema, the
 * synchronous `IdGenerator` port, and the table-driven `DomainError`
 * primitives with stable codes and typed params (ADR-0001, ADR-0007).
 * Framework-free by contract (ADR-0007): no HTTP status, no ORM, no auth
 * primitives cross this boundary.
 */
export { DomainError } from "./errors/domain-error.js";
export { ERROR_MESSAGES } from "./errors/codes.js";
export type { ErrorCode, ErrorCodeMap } from "./errors/codes.js";
export { Id, idSchema } from "./id/id.js";
export type { IdGenerator } from "./id/id-generator.js";