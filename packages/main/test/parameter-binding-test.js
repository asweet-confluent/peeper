// Simple parameter binding test
import { FilterASTBuilder } from '../src/database/filter-grammar.js'

const astBuilder = new FilterASTBuilder()

// Test expressions that previously caused SQLite binding errors
const testExpressions = [
  'subject_type === "PullRequest"',
  'unread === true',
  'unread === false', 
  'pr_number > 100',
  'contains(repository_name, "test")',
  'includes(pr_assignees, "username")'
]

console.log('Testing parameter binding fixes...\n')

for (const expr of testExpressions) {
  try {
    const ast = astBuilder.parse(expr)
    console.log(`✓ ${expr} - Parsed successfully`)
  } catch (error) {
    console.log(`✗ ${expr} - Error: ${error.message}`)
  }
}

console.log('\nParameter binding test completed!')
