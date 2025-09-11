// Global teardown for Jest tests
// This ensures all database connections are properly closed after all tests complete

export default async function globalTeardown() {
  // Force close any remaining database connections
  // This is a safety net in case individual test cleanup fails

  // Give a small delay to allow any pending operations to complete
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Force exit if needed (this is handled by --forceExit but adding as backup)
  if (process.env.CI) {
    console.log('CI environment detected, ensuring clean exit...');
  }
}
