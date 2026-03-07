export interface QueryOperator {
  type: 'equal' | 'notEqual' | 'lessThan' | 'lessThanEqual' | 'greaterThan' | 'greaterThanEqual' | 'contains' | 'startsWith' | 'endsWith' | 'isNull' | 'isNotNull' | 'in' | 'notIn' | 'search' | 'between' | 'and' | 'or' | 'not' | 'limit' | 'offset' | 'orderBy' | 'select';
  field?: string;
  value?: any;
  value2?: any; // For between operator
  direction?: 'asc' | 'desc';
  operators?: QueryOperator[]; // For and/or operators (legacy)
  conditions?: QueryOperator[]; // For and/or/not operators
  fields?: string[]; // For select operator
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  select?: string[];
}

export interface QueryResult<T = any> {
  documents: T[];
  total: number;
  hasMore?: boolean;
  cursor?: string;
}

export interface PaginationCursor {
  offset: number;
  limit: number;
}
