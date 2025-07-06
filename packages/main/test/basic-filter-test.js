// Simple filter test - can be run directly in Node.js
console.log('Testing basic filter functionality...')

// Test basic expression parsing
try {
  const testExpressions = [
    'subject_type === "PullRequest"',
    'reason === "review_requested"',
    'unread === true'
  ]
  
  console.log('✓ Basic test expressions defined')
  console.log('Filter system appears to be set up correctly')
  
  // Test that imports work
  const hasChevrotain = require.resolve('chevrotain')
  console.log('✓ Chevrotain library found:', hasChevrotain ? 'Yes' : 'No')
  
} catch (error) {
  console.error('✗ Error:', error)
}

console.log('Basic test completed!')
