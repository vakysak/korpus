import { spawnSync } from "node:child_process";
import { prisma } from "./db.js";
import { resetPublicSchemaIfNeeded } from "./db-reset.js";

async function main() {
  const result = await resetPublicSchemaIfNeeded();
  if (result.wiped) console.log("Schema wiped for core_v2");

  const migrate = spawnSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    shell: false,
  });
  if (migrate.status !== 0) {
    process.exit(migrate.status ?? 1);
  }

  const seed = spawnSync("node", ["prisma/seed.js"], { stdio: "inherit" });
  if (seed.status !== 0) {
    console.warn("Seed finished with errors (continuing)");
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
