import { readFile } from "node:fs/promises";
import { closePool, getPool } from "./pool.js";

const schemaPath = new URL("./schema.sql", import.meta.url);
const schemaRaw = await readFile(schemaPath, "utf-8");
const schema = schemaRaw.replace(/^\uFEFF/, "");

const pool = getPool();
try {
  await pool.query(schema);
} finally {
  await closePool();
}
