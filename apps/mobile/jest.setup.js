// Jest setup for the mobile app.
// expo-sqlite and the Supabase client are not available in the node test env,
// so unit tests focus on pure logic (the @3on3/shared reducers) and any modules
// that are mocked here as needed.

// Silence noisy native warnings during tests.
jest.mock('expo-crypto', () => ({
  randomUUID: () => '00000000-0000-0000-0000-000000000000',
}));
