import { FilterASTBuilder } from './filter-grammar.js'
import { FilterToSQLConverter } from './filter-sql-builder.js'
import type { FilterAST } from './filter-grammar.js'
import type { NotificationQueryBuilder } from './filter-sql-builder.js'

/**
 * High-level service for parsing filter expressions and applying them to database queries
 */
export class FilterService {
  private astBuilder = new FilterASTBuilder()
  private sqlConverter = new FilterToSQLConverter()

  /**
   * Parse a filter expression string and apply it to a Kysely query builder
   * 
   * @param query The base query builder
   * @param filterExpression The filter expression string (e.g., "subject_type === 'PullRequest' AND pr_state === 'open'")
   * @returns Modified query builder with filter conditions applied
   */
  applyFilterExpression(query: NotificationQueryBuilder, filterExpression: string): NotificationQueryBuilder {
    if (!filterExpression || filterExpression.trim() === '') {
      return query
    }

    try {
      const ast = this.astBuilder.parse(filterExpression)
      if (!ast) {
        throw new Error('Failed to parse filter expression')
      }

      return this.sqlConverter.applyFilter(query, ast)
    } catch (error) {
      throw new Error(`Filter parsing error: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Validate a filter expression without applying it
   * 
   * @param filterExpression The filter expression to validate
   * @returns True if valid, throws error if invalid
   */
  validateFilterExpression(filterExpression: string): boolean {
    if (!filterExpression || filterExpression.trim() === '') {
      return true
    }

    try {
      const ast = this.astBuilder.parse(filterExpression)
      return ast !== null
    } catch (error) {
      throw new Error(`Invalid filter expression: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Parse a filter expression into an AST for debugging or analysis
   * 
   * @param filterExpression The filter expression to parse
   * @returns The parsed AST
   */
  parseToAST(filterExpression: string): FilterAST | null {
    return this.astBuilder.parse(filterExpression)
  }
}

// Export a singleton instance for convenience
export const filterService = new FilterService()

/**
 * Convenience function to apply a filter expression to a query
 */
export function applyFilter(query: NotificationQueryBuilder, filterExpression: string): NotificationQueryBuilder {
  return filterService.applyFilterExpression(query, filterExpression)
}
