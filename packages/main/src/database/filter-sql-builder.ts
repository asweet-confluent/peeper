import { sql } from 'kysely'
import type { SelectQueryBuilder } from 'kysely'
import type { Database } from './schema.js'
import type { FilterAST, BinaryOpNode, UnaryOpNode, FunctionCallNode, FieldAccessNode, LiteralNode } from './filter-grammar.js'

export type NotificationQueryBuilder = SelectQueryBuilder<Database, 'notifications', any>

/**
 * Converts a parsed filter AST into Kysely database query conditions
 */
export class FilterToSQLConverter {
  /**
   * Apply filter AST to a Kysely query builder
   */
  applyFilter(query: NotificationQueryBuilder, filterAST: FilterAST): NotificationQueryBuilder {
    return query.where((eb) => this.convertASTToExpression(eb, filterAST))
  }

  private convertASTToExpression(eb: any, node: FilterAST): any {
    switch (node.type) {
      case 'binaryOp':
        return this.convertBinaryOp(eb, node)
      
      case 'unaryOp':
        return this.convertUnaryOp(eb, node)
      
      case 'functionCall':
        return this.convertFunctionCall(eb, node)
      
      case 'fieldAccess':
        // Field access nodes in binary operations are handled by the parent node
        throw new Error('Field access nodes should not be converted directly')
      
      case 'literal':
        // Literal nodes in binary operations are handled by the parent node
        throw new Error('Literal nodes should not be converted directly')
      
      default:
        throw new Error(`Unknown AST node type: ${(node as any).type}`)
    }
  }

  private convertBinaryOp(eb: any, node: BinaryOpNode): any {
    switch (node.operator) {
      case 'AND':
        return eb.and([
          this.convertASTToExpression(eb, node.left),
          this.convertASTToExpression(eb, node.right)
        ])
      
      case 'OR':
        return eb.or([
          this.convertASTToExpression(eb, node.left),
          this.convertASTToExpression(eb, node.right)
        ])
      
      case '===':
      case '!==':
      case '>':
      case '>=':
      case '<':
      case '<=':
        return this.convertComparison(eb, node)
      
      default:
        throw new Error(`Unknown binary operator: ${node.operator}`)
    }
  }

  private convertUnaryOp(eb: any, node: UnaryOpNode): any {
    switch (node.operator) {
      case 'NOT':
        return eb.not(this.convertASTToExpression(eb, node.operand))
      
      default:
        throw new Error(`Unknown unary operator: ${node.operator}`)
    }
  }

  private convertComparison(eb: any, node: BinaryOpNode): any {
    const leftField = this.getFieldReference(node.left)
    const rightValue = this.getLiteralValue(node.right)
    
    const dbColumn = this.mapFieldToColumn(leftField)
    
    // Ensure value is compatible with SQLite (string, number, boolean -> number, null)
    let sqliteValue: string | number | null
    if (rightValue === null || rightValue === undefined) {
      sqliteValue = null
    } else if (typeof rightValue === 'boolean') {
      sqliteValue = rightValue ? 1 : 0
    } else if (typeof rightValue === 'number') {
      sqliteValue = rightValue
    } else {
      sqliteValue = String(rightValue)
    }
    
    switch (node.operator) {
      case '===':
        return eb(dbColumn, '=', sqliteValue)
      
      case '!==':
        return eb(dbColumn, '!=', sqliteValue)
      
      case '>':
        return eb(dbColumn, '>', sqliteValue)
      
      case '>=':
        return eb(dbColumn, '>=', sqliteValue)
      
      case '<':
        return eb(dbColumn, '<', sqliteValue)
      
      case '<=':
        return eb(dbColumn, '<=', sqliteValue)
      
      default:
        throw new Error(`Unknown comparison operator: ${node.operator}`)
    }
  }

  private convertFunctionCall(eb: any, node: FunctionCallNode): any {
    const firstArg = node.args[0]
    
    switch (node.functionName) {
      case 'contains':
        if (node.args.length !== 2) {
          throw new Error('contains() function requires exactly 2 arguments')
        }
        const field = this.getFieldReference(firstArg)
        const searchValue = this.getLiteralValue(node.args[1])
        const column = this.mapFieldToColumn(field)
        
        // Ensure searchValue is a string and properly escape it
        const searchStr = String(searchValue)
        return eb(column, 'like', `%${searchStr}%`)
      
      case 'startsWith':
        if (node.args.length !== 2) {
          throw new Error('startsWith() function requires exactly 2 arguments')
        }
        const startsField = this.getFieldReference(firstArg)
        const startsValue = this.getLiteralValue(node.args[1])
        const startsColumn = this.mapFieldToColumn(startsField)
        
        // Ensure startsValue is a string and properly escape it
        const startsStr = String(startsValue)
        return eb(startsColumn, 'like', `${startsStr}%`)
      
      case 'endsWith':
        if (node.args.length !== 2) {
          throw new Error('endsWith() function requires exactly 2 arguments')
        }
        const endsField = this.getFieldReference(firstArg)
        const endsValue = this.getLiteralValue(node.args[1])
        const endsColumn = this.mapFieldToColumn(endsField)
        
        // Ensure endsValue is a string and properly escape it
        const endsStr = String(endsValue)
        return eb(endsColumn, 'like', `%${endsStr}`)
      
      case 'matches':
        if (node.args.length !== 2) {
          throw new Error('matches() function requires exactly 2 arguments')
        }
        const matchField = this.getFieldReference(firstArg)
        const pattern = this.getLiteralValue(node.args[1])
        const matchColumn = this.mapFieldToColumn(matchField)
        
        // Use GLOB for SQLite pattern matching with proper parameter binding
        const patternStr = String(pattern)
        return sql`${sql.ref(matchColumn)} GLOB ${sql.lit(patternStr)}`
      
      case 'includes':
        if (node.args.length !== 2) {
          throw new Error('includes() function requires exactly 2 arguments')
        }
        const arrayField = this.getFieldReference(firstArg)
        const includesValue = this.getLiteralValue(node.args[1])
        
        return this.convertJsonArrayIncludes(eb, arrayField, includesValue)
      
      default:
        throw new Error(`Unknown function: ${node.functionName}`)
    }
  }

  private convertJsonArrayIncludes(_eb: any, fieldPath: string[], value: any): any {
    const column = this.mapFieldToColumn(fieldPath)
    
    // For JSON array fields, use JSON_EXTRACT to check if value exists in array
    // This handles the GitHub API arrays like pr_assignees, pr_requested_reviewers, pr_labels
    switch (column) {
      case 'pr_assignees':
      case 'pr_requested_reviewers':
      case 'pr_labels':
        // Check if the JSON array contains the value with proper parameter binding
        const valueStr = String(value)
        const searchPattern = `%"${valueStr}"%`
        return sql`JSON_EXTRACT(${sql.ref(column)}, '$') LIKE ${sql.lit(searchPattern)}`
      
      default:
        throw new Error(`includes() function not supported for field: ${fieldPath.join('.')}`)
    }
  }

  private getFieldReference(node: FilterAST): string[] {
    if (node.type !== 'fieldAccess') {
      throw new Error(`Expected field access, got: ${node.type}`)
    }
    return (node as FieldAccessNode).fieldPath
  }

  private getLiteralValue(node: FilterAST): any {
    if (node.type !== 'literal') {
      throw new Error(`Expected literal value, got: ${node.type}`)
    }
    return (node as LiteralNode).value
  }

  /**
   * Maps filter field names to database column names
   */
  private mapFieldToColumn(fieldPath: string[]): string {
    const field = fieldPath.join('.')
    
    // Map common field names to database columns
    const fieldMapping: Record<string, string> = {
      // Basic notification fields
      'subject_title': 'subject_title',
      'subject_type': 'subject_type',
      'repository_name': 'repository_name',
      'reason': 'reason',
      'unread': 'unread',
      'updated_at': 'updated_at',
      
      // PR-specific fields
      'pr_number': 'pr_number',
      'pr_author': 'pr_author',
      'pr_state': 'pr_state',
      'pr_merged': 'pr_merged',
      'pr_draft': 'pr_draft',
      'pr_assignees': 'pr_assignees',
      'pr_requested_reviewers': 'pr_requested_reviewers',
      'pr_labels': 'pr_labels',
      
      // User context fields
      'current_user_is_reviewer': 'current_user_is_reviewer',
      'current_user_team_is_reviewer': 'current_user_team_is_reviewer',
    }
    
    const mapped = fieldMapping[field]
    if (!mapped) {
      throw new Error(`Unknown field: ${field}. Available fields: ${Object.keys(fieldMapping).join(', ')}`)
    }
    
    return mapped
  }
}

/**
 * Helper function to create a SQL filter converter and apply it to a query
 */
export function applyFilterToQuery(
  query: NotificationQueryBuilder, 
  filterAST: FilterAST
): NotificationQueryBuilder {
  const converter = new FilterToSQLConverter()
  return converter.applyFilter(query, filterAST)
}
