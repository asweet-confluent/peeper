import { 
  CstParser, 
  Lexer, 
  createToken
} from "chevrotain"
import type {
  IToken,
  CstNode,
  CstElement
} from "chevrotain"

// Token definitions
const WhiteSpace = createToken({ name: "WhiteSpace", pattern: /\s+/, group: Lexer.SKIPPED })

// Literals
const StringLiteral = createToken({ 
  name: "StringLiteral", 
  pattern: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/ 
})
const NumberLiteral = createToken({ 
  name: "NumberLiteral", 
  pattern: /\d+(\.\d+)?/ 
})
const BooleanLiteral = createToken({ 
  name: "BooleanLiteral", 
  pattern: /true|false/ 
})

// Operators
const And = createToken({ name: "And", pattern: /AND|&&/, longer_alt: StringLiteral })
const Or = createToken({ name: "Or", pattern: /OR|\|\|/, longer_alt: StringLiteral })
const Not = createToken({ name: "Not", pattern: /NOT|!/, longer_alt: StringLiteral })

// Comparison operators
const Equals = createToken({ name: "Equals", pattern: /===|==/ })
const NotEquals = createToken({ name: "NotEquals", pattern: /!==|!=/ })
const GreaterThan = createToken({ name: "GreaterThan", pattern: />/ })
const GreaterThanOrEqual = createToken({ name: "GreaterThanOrEqual", pattern: />=/ })
const LessThan = createToken({ name: "LessThan", pattern: /</ })
const LessThanOrEqual = createToken({ name: "LessThanOrEqual", pattern: /<=/ })

// Functions
const Contains = createToken({ name: "Contains", pattern: /contains/, longer_alt: StringLiteral })
const StartsWith = createToken({ name: "StartsWith", pattern: /startsWith/, longer_alt: StringLiteral })
const EndsWith = createToken({ name: "EndsWith", pattern: /endsWith/, longer_alt: StringLiteral })
const Matches = createToken({ name: "Matches", pattern: /matches/, longer_alt: StringLiteral })
const Includes = createToken({ name: "Includes", pattern: /includes/, longer_alt: StringLiteral })

// Punctuation
const LeftParen = createToken({ name: "LeftParen", pattern: /\(/ })
const RightParen = createToken({ name: "RightParen", pattern: /\)/ })
const Comma = createToken({ name: "Comma", pattern: /,/ })
const Dot = createToken({ name: "Dot", pattern: /\./ })

// Field names and identifiers
const Identifier = createToken({ 
  name: "Identifier", 
  pattern: /[a-zA-Z_][a-zA-Z0-9_]*/ 
})

// All tokens in order of precedence
const allTokens = [
  WhiteSpace,
  
  // Keywords first (longer alternatives)
  And, Or, Not,
  Contains, StartsWith, EndsWith, Matches, Includes,
  BooleanLiteral,
  
  // Operators
  Equals, NotEquals, GreaterThanOrEqual, LessThanOrEqual, 
  GreaterThan, LessThan,
  
  // Literals
  StringLiteral, NumberLiteral,
  
  // Punctuation
  LeftParen, RightParen, Comma, Dot,
  
  // Identifiers last
  Identifier
]

// Lexer
const FilterLexer = new Lexer(allTokens)

// Parser
export class FilterParser extends CstParser {
  constructor() {
    super(allTokens, {
      recoveryEnabled: true
    })
    this.performSelfAnalysis()
  }

  // Entry point
  public filterExpression = this.RULE("filterExpression", () => {
    this.SUBRULE(this.orExpression)
  })

  // OR has lowest precedence
  private orExpression = this.RULE("orExpression", () => {
    this.SUBRULE(this.andExpression, { LABEL: "lhs" })
    this.MANY(() => {
      this.CONSUME(Or)
      this.SUBRULE2(this.andExpression, { LABEL: "rhs" })
    })
  })

  // AND has higher precedence than OR
  private andExpression = this.RULE("andExpression", () => {
    this.SUBRULE(this.notExpression, { LABEL: "lhs" })
    this.MANY(() => {
      this.CONSUME(And)
      this.SUBRULE2(this.notExpression, { LABEL: "rhs" })
    })
  })

  // NOT has higher precedence than AND
  private notExpression = this.RULE("notExpression", () => {
    this.OPTION(() => {
      this.CONSUME(Not)
    })
    this.SUBRULE(this.comparisonExpression)
  })

  // Comparison expressions
  private comparisonExpression = this.RULE("comparisonExpression", () => {
    this.OR([
      {
        ALT: () => this.SUBRULE(this.functionCall)
      },
      {
        ALT: () => {
          this.SUBRULE(this.atomicExpression, { LABEL: "lhs" })
          this.OR2([
            { ALT: () => this.CONSUME(Equals) },
            { ALT: () => this.CONSUME(NotEquals) },
            { ALT: () => this.CONSUME(GreaterThanOrEqual) },
            { ALT: () => this.CONSUME(LessThanOrEqual) },
            { ALT: () => this.CONSUME(GreaterThan) },
            { ALT: () => this.CONSUME(LessThan) }
          ])
          this.SUBRULE2(this.atomicExpression, { LABEL: "rhs" })
        }
      }
    ])
  })

  // Function calls
  private functionCall = this.RULE("functionCall", () => {
    this.OR([
      { ALT: () => this.CONSUME(Contains) },
      { ALT: () => this.CONSUME(StartsWith) },
      { ALT: () => this.CONSUME(EndsWith) },
      { ALT: () => this.CONSUME(Matches) },
      { ALT: () => this.CONSUME(Includes) }
    ])
    
    this.CONSUME(LeftParen)
    this.SUBRULE(this.atomicExpression, { LABEL: "firstArg" })
    this.OPTION(() => {
      this.CONSUME(Comma)
      this.SUBRULE2(this.atomicExpression, { LABEL: "secondArg" })
    })
    this.CONSUME(RightParen)
  })

  // Atomic expressions (literals, field access, parenthesized expressions)
  private atomicExpression = this.RULE("atomicExpression", () => {
    this.OR([
      {
        ALT: () => this.SUBRULE(this.fieldAccess)
      },
      {
        ALT: () => this.CONSUME(StringLiteral)
      },
      {
        ALT: () => this.CONSUME(NumberLiteral)
      },
      {
        ALT: () => this.CONSUME(BooleanLiteral)
      },
      {
        ALT: () => {
          this.CONSUME(LeftParen)
          this.SUBRULE(this.orExpression)
          this.CONSUME(RightParen)
        }
      }
    ])
  })

  // Field access (e.g., subject_title, pr.author)
  private fieldAccess = this.RULE("fieldAccess", () => {
    this.CONSUME(Identifier, { LABEL: "fieldName" })
    this.MANY(() => {
      this.CONSUME(Dot)
      this.CONSUME2(Identifier, { LABEL: "subField" })
    })
  })
}

// AST node types for the parsed filter
export type FilterAST = 
  | BinaryOpNode
  | UnaryOpNode
  | FunctionCallNode
  | FieldAccessNode
  | LiteralNode

export interface BinaryOpNode {
  type: 'binaryOp'
  operator: 'AND' | 'OR' | '===' | '!==' | '>' | '>=' | '<' | '<='
  left: FilterAST
  right: FilterAST
}

export interface UnaryOpNode {
  type: 'unaryOp'
  operator: 'NOT'
  operand: FilterAST
}

export interface FunctionCallNode {
  type: 'functionCall'
  functionName: 'contains' | 'startsWith' | 'endsWith' | 'matches' | 'includes'
  args: FilterAST[]
}

export interface FieldAccessNode {
  type: 'fieldAccess'
  fieldPath: string[]
}

export interface LiteralNode {
  type: 'literal'
  value: string | number | boolean
}

// Helper functions for type checking CST elements
function isToken(element: CstElement): element is IToken {
  return 'image' in element
}

function isCstNode(element: CstElement): element is CstNode {
  return 'children' in element
}

// CST to AST visitor
export class FilterASTBuilder {
  private parser = new FilterParser()

  parse(filterExpression: string): FilterAST | null {
    const lexingResult = FilterLexer.tokenize(filterExpression)
    
    if (lexingResult.errors.length > 0) {
      throw new Error(`Lexing errors: ${lexingResult.errors.map(e => e.message).join(', ')}`)
    }

    this.parser.input = lexingResult.tokens
    const cst = this.parser.filterExpression()

    if (this.parser.errors.length > 0) {
      throw new Error(`Parsing errors: ${this.parser.errors.map(e => e.message).join(', ')}`)
    }

    return this.visit(cst)
  }

  private visit(node: CstNode): FilterAST {
    const ruleName = node.name
    
    switch (ruleName) {
      case 'filterExpression':
        return this.visit(node.children.orExpression[0] as CstNode)
      
      case 'orExpression':
        return this.visitBinaryExpression(node, 'OR')
      
      case 'andExpression':
        return this.visitBinaryExpression(node, 'AND')
      
      case 'notExpression':
        const notToken = node.children.Not
        const operand = this.visit(node.children.comparisonExpression[0] as CstNode)
        
        if (notToken) {
          return {
            type: 'unaryOp',
            operator: 'NOT',
            operand
          }
        }
        return operand
      
      case 'comparisonExpression':
        if (node.children.functionCall) {
          return this.visit(node.children.functionCall[0] as CstNode)
        }
        
        const lhs = this.visit(node.children.lhs[0] as CstNode)
        const operator = node.children.Equals?.[0] || 
                        node.children.NotEquals?.[0] ||
                        node.children.GreaterThanOrEqual?.[0] ||
                        node.children.LessThanOrEqual?.[0] ||
                        node.children.GreaterThan?.[0] ||
                        node.children.LessThan?.[0]
        const rhs = this.visit(node.children.rhs[0] as CstNode)
        
        return {
          type: 'binaryOp',
          operator: this.getComparisonOperator(operator as IToken),
          left: lhs,
          right: rhs
        }
      
      case 'functionCall':
        const functionToken = node.children.Contains?.[0] ||
                             node.children.StartsWith?.[0] ||
                             node.children.EndsWith?.[0] ||
                             node.children.Matches?.[0] ||
                             node.children.Includes?.[0]
        const functionName = (functionToken as IToken).image
        const args = [this.visit(node.children.firstArg[0] as CstNode)]
        
        if (node.children.secondArg) {
          args.push(this.visit(node.children.secondArg[0] as CstNode))
        }
        
        return {
          type: 'functionCall',
          functionName: functionName as any,
          args
        }
      
      case 'atomicExpression':
        if (node.children.fieldAccess) {
          return this.visit(node.children.fieldAccess[0] as CstNode)
        }
        if (node.children.StringLiteral) {
          const value = (node.children.StringLiteral[0] as IToken).image
          return {
            type: 'literal',
            value: value.slice(1, -1) // Remove quotes
          }
        }
        if (node.children.NumberLiteral) {
          return {
            type: 'literal',
            value: parseFloat((node.children.NumberLiteral[0] as IToken).image)
          }
        }
        if (node.children.BooleanLiteral) {
          return {
            type: 'literal',
            value: (node.children.BooleanLiteral[0] as IToken).image === 'true'
          }
        }
        if (node.children.orExpression) {
          return this.visit(node.children.orExpression[0] as CstNode)
        }
        throw new Error(`Unexpected atomic expression: ${JSON.stringify(node.children)}`)
      
      case 'fieldAccess':
        const fieldPath = [(node.children.fieldName[0] as IToken).image]
        if (node.children.subField) {
          fieldPath.push(...node.children.subField.map((token) => (token as IToken).image))
        }
        
        return {
          type: 'fieldAccess',
          fieldPath
        }
      
      default:
        throw new Error(`Unknown rule: ${ruleName}`)
    }
  }

  private visitBinaryExpression(node: CstNode, defaultOperator: 'AND' | 'OR'): FilterAST {
    const lhs = this.visit(node.children.lhs[0] as CstNode)
    
    if (!node.children.rhs || node.children.rhs.length === 0) {
      return lhs
    }
    
    let result = lhs
    for (const rhs of node.children.rhs) {
      result = {
        type: 'binaryOp',
        operator: defaultOperator,
        left: result,
        right: this.visit(rhs as CstNode)
      }
    }
    
    return result
  }

  private getComparisonOperator(token: IToken): BinaryOpNode['operator'] {
    switch (token.tokenType.name) {
      case 'Equals': return '==='
      case 'NotEquals': return '!=='
      case 'GreaterThan': return '>'
      case 'GreaterThanOrEqual': return '>='
      case 'LessThan': return '<'
      case 'LessThanOrEqual': return '<='
      default: throw new Error(`Unknown comparison operator: ${token.tokenType.name}`)
    }
  }
}

// Export the lexer for potential use in syntax highlighting
export { FilterLexer, allTokens }
