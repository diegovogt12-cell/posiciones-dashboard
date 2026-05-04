import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Lista las fechas únicas que tienen precios cargados, descendente.
 * Útil para popular el selector de fecha en la pestaña de Valuación.
 */
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Supabase JS no soporta DISTINCT directo — usamos el filtro/orden y dedup
  // en cliente. Si la tabla crece mucho podemos hacer un RPC server-side.
  const { data, error } = await supabase
    .from("prices")
    .select("fecha")
    .order("fecha", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const seen = new Set<string>();
  const dates: string[] = [];
  for (const r of data ?? []) {
    if (!seen.has(r.fecha)) {
      seen.add(r.fecha);
      dates.push(r.fecha);
    }
  }
  return NextResponse.json({ dates });
}
