import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Position } from "@/lib/types";

interface PositionRow {
  id: string;
  fecha: string;
  tipo: Position["tipo"];
  ticker: string;
  posicion: number;
  precio: number;
  strike: number | null;
  venc_mes: Position["vencMes"] | null;
  venc_anio: number | null;
  venc_fecha: string | null;
}

function rowToPosition(r: PositionRow): Position {
  return {
    id: r.id,
    fecha: r.fecha,
    tipo: r.tipo,
    ticker: r.ticker,
    posicion: Number(r.posicion),
    precio: Number(r.precio),
    strike: r.strike != null ? Number(r.strike) : undefined,
    vencMes: r.venc_mes ?? undefined,
    vencAnio: r.venc_anio ?? undefined,
    vencFecha: r.venc_fecha ?? undefined,
  };
}

interface BulkBody {
  trades: Array<Omit<Position, "id">>;
}

const MAX_BULK = 1000;

/**
 * Inserta varios trades en una sola request. Sin deduplicación — cada fila
 * genera un trade nuevo (cada uno con su uuid). El usuario ya validó el CSV
 * cliente-side; aquí re-validamos lo esencial como defense in depth.
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as BulkBody;
  if (!Array.isArray(body.trades) || body.trades.length === 0) {
    return NextResponse.json({ error: "trades array required" }, { status: 400 });
  }
  if (body.trades.length > MAX_BULK) {
    return NextResponse.json({ error: `máximo ${MAX_BULK} trades por upload` }, { status: 400 });
  }

  // Validación mínima por fila — el cliente ya validó pero no confiamos.
  for (let i = 0; i < body.trades.length; i++) {
    const t = body.trades[i];
    if (!t.fecha || !t.tipo || !t.ticker ||
        typeof t.posicion !== "number" || typeof t.precio !== "number") {
      return NextResponse.json({ error: `payload inválido en fila ${i}` }, { status: 400 });
    }
  }

  const insertRows = body.trades.map((t) => ({
    fecha: t.fecha,
    tipo: t.tipo,
    ticker: t.ticker,
    posicion: t.posicion,
    precio: t.precio,
    strike: t.strike ?? null,
    venc_mes: t.vencMes ?? null,
    venc_anio: t.vencAnio ?? null,
    venc_fecha: t.vencFecha ?? null,
    created_by: user.id,
  }));

  const { data, error } = await supabase
    .from("positions")
    .insert(insertRows)
    .select("id, fecha, tipo, ticker, posicion, precio, strike, venc_mes, venc_anio, venc_fecha");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const positions = (data as PositionRow[]).map(rowToPosition);
  return NextResponse.json({ positions });
}
