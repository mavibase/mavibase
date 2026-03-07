import { AppError } from "@mavibase/core"

export interface CursorData {
  created_at: Date
  id: string
}

export class CursorPaginator {
  /**
   * Encode cursor data into a base64 string
   */
  encodeCursor(data: CursorData): string {
    const json = JSON.stringify({
      created_at: data.created_at.toISOString(),
      id: data.id,
    })
    return Buffer.from(json).toString("base64url")
  }

  /**
   * Decode cursor from base64 string
   */
  decodeCursor(cursor: string): CursorData {
    try {
      const json = Buffer.from(cursor, "base64url").toString("utf8")
      const data = JSON.parse(json)

      return {
        created_at: new Date(data.created_at),
        id: data.id,
      }
    } catch (error) {
      throw new AppError(400, "INVALID_CURSOR", "The provided cursor is invalid or malformed", {
        hint: "Use the cursor value from a previous response without modification",
      })
    }
  }

  /**
   * Build WHERE clause for cursor-based pagination
   */
  buildCursorCondition(
    cursor: CursorData,
    direction: "forward" | "backward" = "forward",
  ): {
    condition: string
    params: any[]
  } {
    if (direction === "forward") {
      // Get records after this cursor
      return {
        condition: `(created_at, id) < ($1, $2)`,
        params: [cursor.created_at, cursor.id],
      }
    } else {
      // Get records before this cursor
      return {
        condition: `(created_at, id) > ($1, $2)`,
        params: [cursor.created_at, cursor.id],
      }
    }
  }

  /**
   * Check if there are more results after the current page
   */
  hasNextPage(results: any[], limit: number): boolean {
    return results.length === limit
  }

  /**
   * Get next cursor from results
   */
  getNextCursor(results: any[]): string | null {
    if (results.length === 0) {
      return null
    }

    const lastResult = results[results.length - 1]
    return this.encodeCursor({
      created_at: lastResult.created_at || lastResult.$created_at,
      id: lastResult.id || lastResult.$id,
    })
  }

  /**
   * Get previous cursor from results
   */
  getPreviousCursor(results: any[]): string | null {
    if (results.length === 0) {
      return null
    }

    const firstResult = results[0]
    return this.encodeCursor({
      created_at: firstResult.created_at || firstResult.$created_at,
      id: firstResult.id || firstResult.$id,
    })
  }
}
