import dotenv from "dotenv";

dotenv.config();

const VERIFICATION_TIMEOUT = parseInt(process.env.VERIFICATION_TIMEOUT!) || 10;

/** Calculate expiration timestamp for verification */
export function getExpirationTime(
  minutes: number = VERIFICATION_TIMEOUT,
): Date {
  const expiration = new Date();
  expiration.setMinutes(expiration.getMinutes() + minutes);
  return expiration;
}

/** Check if a timestamp has expired */
export function isExpired(expiresAt: string): boolean {
  const expiration = new Date(expiresAt);
  return new Date() > expiration;
}

/** Get remaining time until expiration */
export function getRemainingTime(expiresAt: string): string {
  const expiration = new Date(expiresAt).getTime();
  const now = new Date().getTime();
  const diff = expiration - now;

  if (diff <= 0) {
    return "Expired";
  }

  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  return `${minutes}m ${seconds}s`;
}

/** Check if a submission time is after the verification start time */
export function isSubmissionAfterStart(
  submissionTime: number,
  startedAt: string | Date,
): boolean {
  const startTimestamp = Math.floor(new Date(startedAt).getTime() / 1000);
  return submissionTime >= startTimestamp;
}

export default {
  getExpirationTime,
  isExpired,
  getRemainingTime,
  isSubmissionAfterStart,
};
