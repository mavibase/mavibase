import type { PaginationCursor } from '../types/query';
import { AppError } from '@mavibase/core';

export class CursorPaginator {
  encodeCursor(offset: number, limit: number): string {
    const cursor: PaginationCursor = { offset, limit };
    return Buffer.from(JSON.stringify(cursor)).toString('base64');
  }

  decodeCursor(cursor: string): PaginationCursor {
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
      const parsed = JSON.parse(decoded);
      
      if (typeof parsed.offset !== 'number' || typeof parsed.limit !== 'number') {
        throw new Error('Invalid cursor format');
      }
      
      return parsed as PaginationCursor;
    } catch (error) {
      throw new AppError(400, 'INVALID_CURSOR', 'Invalid pagination cursor');
    }
  }

  getNextCursor(currentOffset: number, currentLimit: number, hasMore: boolean): string | null {
    if (!hasMore) {
      return null;
    }
    return this.encodeCursor(currentOffset + currentLimit, currentLimit);
  }
}
