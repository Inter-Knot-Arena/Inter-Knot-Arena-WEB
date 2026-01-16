import { readFile } from "node:fs/promises";
import { closePool, getPool } from "./pool";

const schemaPath = new URL("./schema.sql", import.meta.url);
const schema = await readFile(schemaPath, "utf-8");

const pool = getPool();
try {
  await pool.query(schema);
} finally {
  await closePool();
}
