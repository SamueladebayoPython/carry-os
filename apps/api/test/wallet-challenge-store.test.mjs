import assert from "node:assert/strict";
import test from "node:test";

import { PrismaWalletChallengeStore } from "../dist/wallet-verification/prisma-wallet-challenge.store.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");

function makeRow(overrides = {}) {
  return {
    id: "8056e8a4-7ec0-47dd-bafc-558b1a9b2781",
    nonce: "gHHxPYlJQn_XKiS1TCkVyPIm_U-bPUfCm0SfztCNdII",
    network: "near",
    address: "alice.near",
    subject: "carry-user-a",
    message: '{"version":"1","purpose":"wallet-ownership-verification","domain":"https://carry.example","network":"near","address":"alice.near","nonce":"gHHxPYlJQn_XKiS1TCkVyPIm_U-bPUfCm0SfztCNdII","issuedAt":"2026-01-01T00:00:00.000Z","expiresAt":"2026-01-01T00:05:00.000Z"}',
    purpose: "wallet-ownership-verification",
    messageVersion: "1",
    issuedAt: NOW,
    expiresAt: new Date(NOW.getTime() + 300_000),
    consumedAt: null,
    ...overrides,
  };
}

function createDatabase(initial = makeRow()) {
  const rows = new Map(initial ? [[initial.id, { ...initial }]] : []);
  const calls = [];

  const db = {
    rows,
    calls,
    walletChallenge: {
      async create({ data }) {
        if (rows.has(data.id)) throw new Error("duplicate");
        rows.set(data.id, { ...data });
      },
      async findUnique({ where }) {
        const row = rows.get(where.id);
        return row ? { ...row } : null;
      },
      async updateMany({ where, data }) {
        calls.push({ where, data });
        const row = rows.get(where.id);
        if (
          !row ||
          row.consumedAt !== where.consumedAt ||
          row.expiresAt.getTime() <= where.expiresAt.gt.getTime()
        ) {
          return { count: 0 };
        }
        row.consumedAt = data.consumedAt;
        return { count: 1 };
      },
      async deleteMany({ where }) {
        let count = 0;
        for (const [id, row] of rows) {
          if (row.expiresAt.getTime() <= where.expiresAt.lte.getTime()) {
            rows.delete(id);
            count += 1;
          }
        }
        return { count };
      },
    },
  };
  return db;
}

test("durable store consumes once across two store instances", async () => {
  const database = createDatabase();
  const firstInstance = new PrismaWalletChallengeStore(database);
  const secondInstance = new PrismaWalletChallengeStore(database);

  const outcomes = await Promise.all([
    firstInstance.consume(makeRow().id, NOW),
    secondInstance.consume(makeRow().id, NOW),
  ]);

  assert.deepEqual(outcomes.map(({ status }) => status).sort(), [
    "already_consumed",
    "consumed",
  ]);
  assert.equal(database.calls.length, 2);
  for (const call of database.calls) {
    assert.equal(call.where.consumedAt, null);
    assert.deepEqual(call.where.expiresAt, { gt: NOW });
  }
});

test("persists the account and exact signed challenge payload", async () => {
  const database = createDatabase(null);
  const store = new PrismaWalletChallengeStore(database);
  const challenge = makeRow();

  await store.create(challenge);
  const consumed = await store.consume(challenge.id, NOW);

  assert.equal(consumed.status, "consumed");
  assert.equal(consumed.challenge.subject, "carry-user-a");
  assert.equal(consumed.challenge.address, "alice.near");
  assert.equal(consumed.challenge.message, challenge.message);
  assert.equal(consumed.challenge.nonce, challenge.nonce);
  assert.equal(consumed.challenge.purpose, challenge.purpose);
  assert.equal(consumed.challenge.messageVersion, challenge.messageVersion);
  assert.equal(consumed.challenge.expiresAt.getTime(), challenge.expiresAt.getTime());
});

test("returns expired without consuming an expired challenge", async () => {
  const row = makeRow({ expiresAt: NOW });
  const database = createDatabase(row);
  const store = new PrismaWalletChallengeStore(database);

  assert.deepEqual(await store.consume(row.id, NOW), { status: "expired" });
  assert.equal(database.rows.get(row.id).consumedAt, null);
  assert.equal(database.calls.length, 0);
});

test("returns already_consumed on replay", async () => {
  const row = makeRow({ consumedAt: new Date(NOW.getTime() - 1) });
  const database = createDatabase(row);
  const store = new PrismaWalletChallengeStore(database);

  assert.deepEqual(
    await store.consume(row.id, NOW),
    { status: "already_consumed" },
  );
  assert.equal(database.calls.length, 0);
});

test("deletes only expired challenges", async () => {
  const expired = makeRow({ expiresAt: new Date(NOW.getTime() - 1) });
  const active = makeRow({
    id: "ff4820a1-3851-4e1b-98a0-61a7f230c419",
    nonce: "8W7Zg70f7g2LgKVnfis6hG_41Y7oHxT4-u1F1jvR87A",
  });
  const database = createDatabase(expired);
  database.rows.set(active.id, active);
  const store = new PrismaWalletChallengeStore(database);

  assert.equal(await store.deleteExpired(NOW), 1);
  assert.equal(database.rows.has(expired.id), false);
  assert.equal(database.rows.has(active.id), true);
});

test("fails closed when the database is not configured", async () => {
  const store = new PrismaWalletChallengeStore(null);
  await assert.rejects(
    () => store.consume(makeRow().id, NOW),
    (error) => error.getStatus() === 503,
  );
});
