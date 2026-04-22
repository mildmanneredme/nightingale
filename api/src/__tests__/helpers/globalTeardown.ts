export default async function globalTeardown() {
  // Nothing to tear down — test DB is reset per-test via truncation in db.ts helper
}
