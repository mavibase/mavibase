import crypto from "crypto"
import { promisify } from "util"

const scrypt = promisify(crypto.scrypt)

export class ApiKeyHasher {
  private static readonly SALT_LENGTH = 16
  private static readonly KEY_LENGTH = 64
  private static readonly PREFIX_LENGTH = 8

  /**
   * Generate a new API key
   * Format: baas_[prefix]_[random]
   */
  static generateKey(): { key: string; prefix: string } {
    const randomBytes = crypto.randomBytes(32).toString("hex")
    const prefix = randomBytes.slice(0, this.PREFIX_LENGTH)
    const key = `baas_${prefix}_${randomBytes}`

    return { key, prefix }
  }

  /**
   * Hash an API key using scrypt with random salt
   */
  static async hashKey(key: string): Promise<string> {
    const salt = crypto.randomBytes(this.SALT_LENGTH).toString("hex")
    const derivedKey = (await scrypt(key, salt, this.KEY_LENGTH)) as Buffer
    const hash = derivedKey.toString("hex")

    // Store salt with hash for verification
    return `${salt}:${hash}`
  }

  /**
   * Verify an API key against a hash using constant-time comparison
   */
  static async verifyKey(key: string, storedHash: string): Promise<boolean> {
    try {
      const [salt, hash] = storedHash.split(":")

      if (!salt || !hash) {
        return false
      }

      const derivedKey = (await scrypt(key, salt, this.KEY_LENGTH)) as Buffer
      const derivedHash = derivedKey.toString("hex")

      // Use constant-time comparison to prevent timing attacks
      return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(derivedHash, "hex"))
    } catch (error) {
      return false
    }
  }

  /**
   * Extract prefix from API key
   */
  static extractPrefix(key: string): string | null {
    const match = key.match(/^baas_([a-f0-9]{8})_/)
    return match ? match[1] : null
  }
}
