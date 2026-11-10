import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "prisma/config";

const envPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../.env");
if (existsSync(envPath)) process.loadEnvFile(envPath);

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url: process.env.DATABASE_URL ?? "postgresql://carry_dev:carry_dev@127.0.0.1:5432/carry_os?schema=public",
  },
});
