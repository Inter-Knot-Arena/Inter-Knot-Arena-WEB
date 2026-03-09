import test from "node:test";
import assert from "node:assert/strict";
import { createRepository } from "../repository/index.js";

const originalRepository = process.env.IKA_REPOSITORY;
const originalDatabaseUrl = process.env.DATABASE_URL;

test.after(() => {
  if (originalRepository === undefined) {
    delete process.env.IKA_REPOSITORY;
  } else {
    process.env.IKA_REPOSITORY = originalRepository;
  }

  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = originalDatabaseUrl;
  }
});

test("createRepository requires explicit configuration", async () => {
  delete process.env.IKA_REPOSITORY;
  delete process.env.DATABASE_URL;

  await assert.rejects(
    () => createRepository(),
    /Set DATABASE_URL for postgres or IKA_REPOSITORY=memory/
  );
});

test("createRepository still allows explicit memory mode", async () => {
  process.env.IKA_REPOSITORY = "memory";
  delete process.env.DATABASE_URL;

  const repo = await createRepository();
  const users = await repo.listUsers();

  assert.ok(users.length > 0);
});
