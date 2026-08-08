import { prisma } from "./db.js";

/**
 * Wipe public schema when core_v2 is not yet applied (v1 → v2 cutover).
 */
export async function resetPublicSchemaIfNeeded() {
  try {
    const tables = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = '_prisma_migrations'
    `;
    if (!tables.length) return { wiped: false, reason: "no_migrations_table" };

    const applied = await prisma.$queryRaw`
      SELECT migration_name FROM "_prisma_migrations"
    `;
    const names = applied.map((r) => String(r.migration_name));
    if (names.includes("20260808100000_core_v2")) {
      return { wiped: false, reason: "core_v2_present", names };
    }

    console.log("core_v2 missing – wiping public schema. Applied:", names.join(", ") || "(none)");
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS public CASCADE`);
    await prisma.$executeRawUnsafe(`CREATE SCHEMA public`);
    await prisma.$executeRawUnsafe(`GRANT ALL ON SCHEMA public TO public`);
    return { wiped: true, names };
  } catch (err) {
    console.warn("resetPublicSchemaIfNeeded:", err.message);
    return { wiped: false, error: err.message };
  }
}
