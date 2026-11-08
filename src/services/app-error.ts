/**
 * Erreur présentable au joueur. Chaque code correspond à `errors.<code>.title` et `.body`
 * dans les traductions : aucun message technique n'est jamais affiché.
 */
export type AppErrorCode =
  | "unknown"
  | "network"
  | "storage"
  | "contentUnavailable"
  | "paymentFailed"
  | "accountUnavailable"
  | "signInFailed"
  | "emailInUse"
  | "weakPassword"
  | "tooManyAttempts"
  | "sessionExpired"
  | "unverifiedAccount"
  | "verificationNotSent"
  | "consentMissing"
  | "alreadyOwned"
  | "paymentInProgress"
  | "orderNotFound"
  | "paymentsUnavailable";

export class AppError extends Error {
  readonly code: AppErrorCode;

  constructor(code: AppErrorCode, options?: { cause?: unknown }) {
    super(code, options);
    this.name = "AppError";
    this.code = code;
  }
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  // fetch() rejette avec un TypeError quand le réseau échoue.
  if (error instanceof TypeError && typeof navigator !== "undefined" && !navigator.onLine) {
    return new AppError("network", { cause: error });
  }
  return new AppError("unknown", { cause: error });
}
