import type { QueryOperator } from "../types/query"
import { AppError } from "@mavibase/core"

export class QueryParser {
  private static readonly MAX_OR_CONDITIONS = 10
  private static readonly MAX_FILTERS = 50
  private static readonly MAX_REGEX_LENGTH = 200
  private static readonly MAX_QUERY_DEPTH = 5

  parse(queries?: string | string[]): QueryOperator[] {
    if (!queries) {
      return []
    }

    let queryArray: any[] = []

    // Handle JSON string format
    if (typeof queries === "string") {
      try {
        queryArray = JSON.parse(queries)
      } catch (error) {
        throw new AppError(400, "INVALID_QUERY", "Queries must be a valid JSON array")
      }
    } else if (Array.isArray(queries)) {
      // Handle array of strings
      queryArray = queries
    }

    if (!Array.isArray(queryArray)) {
      throw new AppError(400, "INVALID_QUERY", "Queries must be an array")
    }

    if (queryArray.length > QueryParser.MAX_FILTERS) {
      throw new AppError(
        400,
        "QUERY_TOO_COMPLEX",
        `Query contains too many filters. Maximum ${QueryParser.MAX_FILTERS} allowed`,
        {
          provided: queryArray.length,
          maximum: QueryParser.MAX_FILTERS,
          hint: "Simplify your query or use fewer filter conditions",
        },
      )
    }

    const operators: QueryOperator[] = []

    for (const query of queryArray) {
      const operator = this.parseQuery(query, 0)
      if (operator) {
        operators.push(operator)
      }
    }

    return operators
  }

  private parseQuery(query: string | any, depth: number): QueryOperator | null {
    if (depth > QueryParser.MAX_QUERY_DEPTH) {
      throw new AppError(
        400,
        "QUERY_TOO_DEEP",
        `Query nesting exceeds maximum depth of ${QueryParser.MAX_QUERY_DEPTH}`,
        {
          hint: "Simplify your query structure to reduce nesting",
        },
      )
    }

    try {
      // Handle object format (from JSON)
      if (typeof query === "object" && query.method && query.attribute !== undefined) {
        const method = query.method
        const attribute = query.attribute
        const values = query.values || []

        switch (method) {
          case "equal":
            return {
              type: "equal",
              field: attribute,
              value: values[0],
            }
          case "notEqual":
            return {
              type: "notEqual",
              field: attribute,
              value: values[0],
            }
          case "lessThan":
            return {
              type: "lessThan",
              field: attribute,
              value: values[0],
            }
          case "lessThanEqual":
            return {
              type: "lessThanEqual",
              field: attribute,
              value: values[0],
            }
          case "greaterThan":
            return {
              type: "greaterThan",
              field: attribute,
              value: values[0],
            }
          case "greaterThanEqual":
            return {
              type: "greaterThanEqual",
              field: attribute,
              value: values[0],
            }
          case "contains":
            if (typeof values[0] === "string" && values[0].length > QueryParser.MAX_REGEX_LENGTH) {
              throw new AppError(
                400,
                "PATTERN_TOO_LONG",
                `Search pattern exceeds maximum length of ${QueryParser.MAX_REGEX_LENGTH} characters`,
                {
                  provided: values[0].length,
                  maximum: QueryParser.MAX_REGEX_LENGTH,
                },
              )
            }
            return {
              type: "contains",
              field: attribute,
              value: values[0],
            }
          case "startsWith":
            if (typeof values[0] === "string" && values[0].length > QueryParser.MAX_REGEX_LENGTH) {
              throw new AppError(
                400,
                "PATTERN_TOO_LONG",
                `Search pattern exceeds maximum length of ${QueryParser.MAX_REGEX_LENGTH} characters`,
              )
            }
            return {
              type: "startsWith",
              field: attribute,
              value: values[0],
            }
          case "endsWith":
            if (typeof values[0] === "string" && values[0].length > QueryParser.MAX_REGEX_LENGTH) {
              throw new AppError(
                400,
                "PATTERN_TOO_LONG",
                `Search pattern exceeds maximum length of ${QueryParser.MAX_REGEX_LENGTH} characters`,
              )
            }
            return {
              type: "endsWith",
              field: attribute,
              value: values[0],
            }
          case "isNull":
            return {
              type: "isNull",
              field: attribute,
            }
          case "isNotNull":
            return {
              type: "isNotNull",
              field: attribute,
            }
          case "between":
            return {
              type: "between",
              field: attribute,
              value: values[0],
              value2: values[1],
            }
          case "orderBy":
            return {
              type: "orderBy",
              field: attribute,
              direction: values[0] === "desc" ? "desc" : "asc",
            }
          case "limit":
            return {
              type: "limit",
              value: Number.parseInt(values[0]),
            }
          case "offset":
            return {
              type: "offset",
              value: Number.parseInt(values[0]),
            }
          case "in":
            if (Array.isArray(values) && values.length > 100) {
              throw new AppError(400, "IN_ARRAY_TOO_LARGE", "IN operator supports maximum 100 values", {
                provided: values.length,
                maximum: 100,
              })
            }
            return {
              type: "in",
              field: attribute,
              value: values,
            }
          case "notIn":
            if (Array.isArray(values) && values.length > 100) {
              throw new AppError(400, "IN_ARRAY_TOO_LARGE", "NOT IN operator supports maximum 100 values", {
                provided: values.length,
                maximum: 100,
              })
            }
            return {
              type: "notIn",
              field: attribute,
              value: values,
            }
          case "search":
            if (typeof values[0] === "string" && values[0].length > QueryParser.MAX_REGEX_LENGTH) {
              throw new AppError(
                400,
                "PATTERN_TOO_LONG",
                `Search pattern exceeds maximum length of ${QueryParser.MAX_REGEX_LENGTH} characters`,
              )
            }
            return {
              type: "search",
              field: attribute,
              value: values[0],
            }
          case "and":
            return {
              type: "and",
              conditions: values[0]?.map((cond: any) => this.parseQuery(cond, depth + 1)) || [],
            }
          case "or":
            if (Array.isArray(values[0]) && values[0].length > QueryParser.MAX_OR_CONDITIONS) {
              throw new AppError(
                400,
                "OR_TOO_COMPLEX",
                `OR operator supports maximum ${QueryParser.MAX_OR_CONDITIONS} conditions`,
                {
                  provided: values[0].length,
                  maximum: QueryParser.MAX_OR_CONDITIONS,
                  hint: "Break down complex OR conditions into multiple queries",
                },
              )
            }
            return {
              type: "or",
              conditions: values[0]?.map((cond: any) => this.parseQuery(cond, depth + 1)) || [],
            }
          case "not":
            return {
              type: "not",
              conditions: Array.isArray(values[0])
                ? values[0].map((cond: any) => this.parseQuery(cond, depth + 1))
                : [this.parseQuery(values[0], depth + 1)],
            }
          default:
            throw new AppError(400, "INVALID_QUERY", `Unknown query method: ${method}`)
        }
      }

      // Handle string format (legacy)
      if (typeof query === "string") {
        return this.parseStringQuery(query)
      }

      throw new AppError(400, "INVALID_QUERY", "Invalid query format")
    } catch (error) {
      if (error instanceof AppError) {
        throw error
      }
      throw new AppError(400, "INVALID_QUERY", `Failed to parse query`)
    }
  }

  private parseStringQuery(queryString: string): QueryOperator | null {
    // Parse equal("field", "value")
    const equalMatch = queryString.match(/equal$$"([^"]+)",\s*"([^"]*)"$$/)
    if (equalMatch) {
      return {
        type: "equal",
        field: equalMatch[1],
        value: equalMatch[2],
      }
    }

    // Parse equal("field", number)
    const equalNumberMatch = queryString.match(/equal$$"([^"]+)",\s*(\d+(?:\.\d+)?)$$/)
    if (equalNumberMatch) {
      return {
        type: "equal",
        field: equalNumberMatch[1],
        value: Number.parseFloat(equalNumberMatch[2]),
      }
    }

    // Parse equal("field", boolean)
    const equalBoolMatch = queryString.match(/equal$$"([^"]+)",\s*(true|false)$$/)
    if (equalBoolMatch) {
      return {
        type: "equal",
        field: equalBoolMatch[1],
        value: equalBoolMatch[2] === "true",
      }
    }

    // Parse limit(n)
    const limitMatch = queryString.match(/limit$$(\d+)$$/)
    if (limitMatch) {
      return {
        type: "limit",
        value: Number.parseInt(limitMatch[1]),
      }
    }

    // Parse offset(n)
    const offsetMatch = queryString.match(/offset$$(\d+)$$/)
    if (offsetMatch) {
      return {
        type: "offset",
        value: Number.parseInt(offsetMatch[1]),
      }
    }

    // Parse orderBy("field", "direction")
    const orderByMatch = queryString.match(/orderBy$$"([^"]+)",\s*"(asc|desc)"$$/)
    if (orderByMatch) {
      return {
        type: "orderBy",
        field: orderByMatch[1],
        direction: orderByMatch[2] as "asc" | "desc",
      }
    }

    throw new AppError(400, "INVALID_QUERY", `Invalid query syntax: ${queryString}`)
  }

  validateOperators(operators: QueryOperator[]): void {
    // Check only one orderBy
    const orderByCount = operators.filter((op) => op.type === "orderBy").length
    if (orderByCount > 1) {
      throw new AppError(400, "INVALID_QUERY", "Only one orderBy operator is allowed")
    }

    // Check limit is within bounds
    const maxLimit = Number.parseInt(process.env.MAX_QUERY_LIMIT || "100")
    const limitOp = operators.find((op) => op.type === "limit")
    if (limitOp && Number(limitOp.value) > maxLimit) {
      throw new AppError(400, "INVALID_QUERY", `Limit cannot exceed ${maxLimit}`)
    }
  }
}
