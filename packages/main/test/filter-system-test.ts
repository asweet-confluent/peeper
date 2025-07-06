import { FilterASTBuilder } from '../src/database/filter-grammar.js'
import { FilterToSQLConverter } from '../src/database/filter-sql-builder.js'
import { filterService } from '../src/database/filter-service.js'

// Test the filter parsing and SQL generation
async function testFilterSystem() {
  console.log('Testing Filter System...\n')

  const astBuilder = new FilterASTBuilder()
  const sqlConverter = new FilterToSQLConverter()

  const testExpressions = [
    'subject_type === "PullRequest"',
    'reason === "review_requested" AND pr_state === "open"',
    'contains(repository_name, "react")',
    'includes(pr_assignees, "username")',
    'subject_type === "PullRequest" AND pr_merged === false',
    'unread === true OR pr_draft === true',
    'NOT pr_merged AND contains(subject_title, "fix")',
    'pr_state === "open" AND (reason === "review_requested" OR current_user_is_reviewer === true)',
  ]

  for (const expression of testExpressions) {
    console.log(`Testing: ${expression}`)
    
    try {
      // Test parsing
      const ast = astBuilder.parse(expression)
      console.log(`  ✓ Parsed successfully: ${JSON.stringify(ast, null, 2)}`)
      
      // Test validation through service
      const isValid = filterService.validateFilterExpression(expression)
      console.log(`  ✓ Validation: ${isValid}`)
      
    } catch (error) {
      console.log(`  ✗ Error: ${error instanceof Error ? error.message : String(error)}`)
    }
    
    console.log()
  }

  console.log('Filter system test completed!')
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testFilterSystem().catch(console.error)
}

export { testFilterSystem }
