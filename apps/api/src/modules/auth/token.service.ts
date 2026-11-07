import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { env } from "../../config/env.js";

export class TokenService {
  /**
   * Generates a 256-bit cryptographically secure random refresh token.
   * Returns the raw token string (hex format) and its SHA-256 verifier hash.
   */
  generateRefreshToken(): { rawToken: string; tokenHash: string } {
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = this.hashToken(rawToken);
    return { rawToken, tokenHash };
  }

  /**
   * Computes the SHA-256 hash of a raw token string.
   */
  hashToken(rawToken: string): string {
    return createHash("sha256").update(rawToken).digest("hex");
  }

  /**
   * Compares two token hashes in constant time to prevent timing attacks.
   */
  compareTokenHashes(hashA: string, hashB: string): boolean {
    if (hashA.length !== hashB.length) {
      return false;
    }
    try {
      return timingSafeEqual(Buffer.from(hashA, "hex"), Buffer.from(hashB, "hex"));
    } catch {
      return false;
    }
  }

  /**
   * Calculates the expiration timestamp for a new refresh session.
   */
  calculateRefreshExpiry(ttlDays = env.REFRESH_TOKEN_TTL_DAYS): Date {
    return new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
  }
}

export const tokenService = new TokenService();

