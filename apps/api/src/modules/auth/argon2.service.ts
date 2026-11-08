import argon2 from "argon2";
import { env } from "../../config/env.js";

/**
 * OWASP-compliant password hashing engine using Argon2id.
 *
 * Algorithm parameters:
 * - Variant: Argon2id (hybrid data-dependent / data-independent memory access)
 * - Memory Cost: 65,536 KiB (64 MiB)
 * - Time Cost: 3 iterations
 * - Parallelism: 4 threads
 */
export class Argon2Service {
  private readonly memoryCost: number;
  private readonly timeCost: number;
  private readonly parallelism: number;

  /**
   * Precomputed valid Argon2id hash for unknown account timing-attack mitigation.
   * Parameterized identically (m=65536, t=3, p=4) so that verify takes identical CPU time.
   */
  private readonly dummyHash =
    "$argon2id$v=19$m=65536,t=3,p=4$OkpQiS5qIYOlPqyrInPVNQ$dRyS0r+xsycTJbxFwObulB8i3QKZdoHk1ji5MMr3w5A";

  constructor(
    memoryCost = env.ARGON2_MEMORY_COST,
    timeCost = env.ARGON2_TIME_COST,
    parallelism = env.ARGON2_PARALLELISM
  ) {
    this.memoryCost = memoryCost;
    this.timeCost = timeCost;
    this.parallelism = parallelism;
  }

  /**
   * Hashes a plaintext password using Argon2id.
   * Plaintext passwords are never logged or persisted.
   */
  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: this.memoryCost,
      timeCost: this.timeCost,
      parallelism: this.parallelism
    });
  }

  /**
   * Verifies a plaintext password against an Argon2 hash.
   * Returns true if valid, false otherwise. Never throws on mismatch.
   */
  async verifyPassword(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  /**
   * Performs a dummy verification against an unknown account to equalize response
   * latency and eliminate user enumeration timing attacks.
   */
  async verifyDummy(plain: string): Promise<boolean> {
    try {
      return await argon2.verify(this.dummyHash, plain);
    } catch {
      return false;
    }
  }

  getParameters() {
    return {
      algorithm: "Argon2id",
      version: 19,
      memoryCost: this.memoryCost,
      timeCost: this.timeCost,
      parallelism: this.parallelism
    };
  }
}

export const argon2Service = new Argon2Service();
