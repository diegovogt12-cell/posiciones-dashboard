// Ejecuta un archivo .sql contra la DB de Supabase.
// Usa la conexión directa (puerto 5432). Si falla por IPv6, prueba pooler.
import { readFileSync } from "node:fs";
import { Client } from "pg";

const password = process.argv[2];
const file = process.argv[3] ?? "supabase/schema.sql";
if (!password) {
  console.error("Uso: node scripts/run-schema.mjs <DB_PASSWORD> [archivo.sql]");
  process.exit(1);
}

const sql = readFileSync(file, "utf8");
console.log(`Ejecutando ${file}...`);

const configs = [
  // Session pooler (mejor para DDL sobre redes sin IPv6)
  {
    name: "pooler-session",
    host: "aws-0-us-east-1.pooler.supabase.com",
    port: 5432,
    user: "postgres.ijlsnnmqflkxjwzbwbxv",
    password,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
  },
  // Conexión directa
  {
    name: "direct",
    host: "db.ijlsnnmqflkxjwzbwbxv.supabase.co",
    port: 5432,
    user: "postgres",
    password,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
  },
];

for (const cfg of configs) {
  const { name, ...clientCfg } = cfg;
  console.log(`\n→ Intentando conexión: ${name} (${cfg.host})`);
  const client = new Client(clientCfg);
  try {
    await client.connect();
    console.log("  conectado.");
    const res = await client.query(sql);
    console.log("  SQL ejecutado OK. Resultado:", Array.isArray(res) ? `${res.length} statements` : "1 statement");
    // Verifica tabla
    const check = await client.query(
      "select count(*)::int as n from information_schema.tables where table_schema='public' and table_name='positions'"
    );
    console.log("  Tabla positions existe:", check.rows[0].n === 1 ? "✅" : "❌");
    const policies = await client.query(
      "select policyname from pg_policies where schemaname='public' and tablename='positions' order by policyname"
    );
    console.log("  RLS policies:", policies.rows.map((r) => r.policyname).join(", ") || "(ninguna)");
    await client.end();
    process.exit(0);
  } catch (e) {
    console.error(`  falló: ${e.message}`);
    try { await client.end(); } catch {}
  }
}

console.error("\n❌ Ninguna conexión funcionó.");
process.exit(1);
