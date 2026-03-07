import crypto from "crypto"

export class ETagGenerator {
  /**
   * Generate ETag from document version and updated_at timestamp
   */
  generate(version: number, updatedAt: Date): string {
    const data = `${version}-${updatedAt.getTime()}`
    return `"${crypto.createHash("md5").update(data).digest("hex")}"`
  }

  /**
   * Generate weak ETag (for content that changes frequently)
   */
  generateWeak(version: number): string {
    return `W/"${version}"`
  }

  /**
   * Compare ETags
   */
  matches(etag1: string, etag2: string): boolean {
    // Remove quotes and W/ prefix for comparison
    const clean1 = this.cleanETag(etag1)
    const clean2 = this.cleanETag(etag2)
    return clean1 === clean2
  }

  /**
   * Parse If-Match header to get list of ETags
   */
  parseIfMatch(ifMatchHeader: string): string[] {
    if (ifMatchHeader === "*") {
      return ["*"]
    }

    // Split by comma and clean up each ETag
    return ifMatchHeader
      .split(",")
      .map((etag) => etag.trim())
      .filter((etag) => etag.length > 0)
  }

  /**
   * Check if any ETag in the list matches
   */
  anyMatch(etags: string[], targetETag: string): boolean {
    if (etags.includes("*")) {
      return true
    }

    for (const etag of etags) {
      if (this.matches(etag, targetETag)) {
        return true
      }
    }

    return false
  }

  private cleanETag(etag: string): string {
    return etag.replace(/^W\//, "").replace(/"/g, "")
  }
}
