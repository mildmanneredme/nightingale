// Sets DB env vars before any module is loaded in each Jest worker.
// The pg Pool in db.ts reads these at first import.
process.env.DB_HOST = "localhost";
process.env.DB_PORT = "5432";
process.env.DB_NAME = "nightingale_test";
process.env.DB_USER = process.env.USER ?? "postgres";
process.env.DB_PASSWORD = "test"; // local postgres uses trust auth; value ignored
