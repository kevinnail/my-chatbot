// Global teardown for Jest tests
// This ensures all database connections are properly closed after all tests complete

import { cleanup } from './test-setup.js';

export default async function globalTeardown() {
  // Force close any remaining database connections
  // This is a safety net in case individual test cleanup fails

  // Give a small delay to allow any pending operations to complete
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Call the cleanup function to close database connections
  try {
    await cleanup();
    // eslint-disable-next-line no-console
    console.log('✅ Global test cleanup completed');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('❌ Error during global test cleanup:', error);
  }

  // Force exit if needed (this is handled by --forceExit but adding as backup)
  if (process.env.CI) {
    // eslint-disable-next-line no-console
    console.log('CI environment detected, ensuring clean exit...');
  }
}
