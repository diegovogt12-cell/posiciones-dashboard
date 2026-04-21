// Smoke test de la capa Supabase: login + insert + list + delete.
// Uso: node scripts/smoke-test.mjs <email> <password>
// Lee NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY de .env.local.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error("Uso: node scripts/smoke-test.mjs <email> <password>");
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const { data: auth, error: loginErr } = await supabase.auth.signInWithPassword({ email, password });
if (loginErr) { console.error("Login falló:", loginErr.message); process.exit(1); }
console.log("✅ Login OK como", auth.user.email);

const { data: inserted, error: insErr } = await supabase
  .from("positions")
  .insert({
    fecha: new Date().toISOString().slice(0, 10),
    tipo: "equity",
    ticker: "SMOKE",
    posicion: 1,
    precio: 1,
    created_by: auth.user.id,
  })
  .select()
  .single();
if (insErr) { console.error("Insert falló:", insErr.message); process.exit(1); }
console.log("✅ Insert OK, id:", inserted.id);

const { data: list, error: selErr } = await supabase.from("positions").select("id");
if (selErr) { console.error("Select falló:", selErr.message); process.exit(1); }
console.log("✅ Select OK,", list.length, "fila(s)");

const { error: delErr } = await supabase.from("positions").delete().eq("id", inserted.id);
if (delErr) { console.error("Delete falló:", delErr.message); process.exit(1); }
console.log("✅ Delete OK");

console.log("\n🎉 Smoke test completo.");
