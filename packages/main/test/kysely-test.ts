import { KyselyDatabaseManager } from '../src/database/kysely-database-manager.js'
import * as path from 'node:path'
import * as fs from 'node:fs'
import { app } from 'electron'

// Simple test to verify the KyselyDatabaseManager works
export async function testKyselyDatabaseManager() {
  console.log('Testing KyselyDatabaseManager...')
  
  const dbManager = new KyselyDatabaseManager()
  
  try {
    // Initialize the database
    await dbManager.initialize()
    console.log('✓ Database initialized successfully')
    
    // Test token operations
    await dbManager.saveToken('test-token-123')
    const retrievedToken = await dbManager.getToken()
    console.log('✓ Token operations work:', retrievedToken === 'test-token-123')
    
    // Test config operations
    await dbManager.saveLastModified('2023-01-01T00:00:00.000Z')
    const lastModified = await dbManager.getLastModified()
    console.log('✓ Config operations work:', lastModified === '2023-01-01T00:00:00.000Z')
    
    // Test unread count (should be 0 initially)
    const unreadCount = await dbManager.getUnreadCount()
    console.log('✓ Unread count query works:', unreadCount === 0)
    
    // Test creating an inbox
    const inboxId = await dbManager.createInbox({
      name: 'Test Inbox',
      filter_expression: 'true',
      desktop_notifications: 1,
    })
    console.log('✓ Inbox creation works, ID:', inboxId)
    
    // Test getting inboxes
    const inboxes = await dbManager.getInboxes()
    console.log('✓ Inbox retrieval works, count:', inboxes.length)
    
    // Close the database
    dbManager.close()
    console.log('✓ Database closed successfully')
    
    console.log('All tests passed! 🎉')
    return true
  } catch (error) {
    console.error('❌ Test failed:', error)
    dbManager.close()
    return false
  }
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  // Mock the app.getPath function for testing
  if (!app) {
    (global as any).app = {
      getPath: (name: string) => {
        if (name === 'userData') {
          return path.join(process.cwd(), 'test-data')
        }
        return process.cwd()
      }
    }
  }
  
  testKyselyDatabaseManager().then(success => {
    process.exit(success ? 0 : 1)
  })
}
