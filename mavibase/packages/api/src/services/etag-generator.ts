import crypto from "crypto"

/**
 * ETag Generator for document versioning and caching
 */
export class ETagGenerator {
  /**
   * Generate an ETag from version and updated_at timestamp
   */
  generate(version: number, updatedAt: Date): string {
    const data = `${version}-${updatedAt.getTime()}`
    const hash = crypto.createHash("md5").update(data).digest("hex").substring(0, 16)
    return `"${hash}"`
  }

  /**
   * Parse If-Match header value into array of ETags
   */
  parseIfMatch(header: string): string[] {
    if (header === "*") {
      return ["*"]
    }
    return header.split(",").map((etag) => etag.trim())
  }

  /**
   * Check if any provided ETag matches the current ETag
   */
  anyMatch(providedETags: string[], currentETag: string): boolean {
    if (providedETags.includes("*")) {
      return true
    }
    return providedETags.includes(currentETag)
  }

  /**
   * Parse If-None-Match header value into array of ETags
   */
  parseIfNoneMatch(header: string): string[] {
    return this.parseIfMatch(header)
  }

  /**
   * Check if any provided ETag does NOT match the current ETag
   * Returns true if the resource has been modified (ETags don't match)
   */
  noneMatch(providedETags: string[], currentETag: string): boolean {
    if (providedETags.includes("*")) {
      return false
    }
    return !providedETags.includes(currentETag)
  }
}
