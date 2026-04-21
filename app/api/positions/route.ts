import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Position } from "@/lib/types";

// Fila tal como vive en Postgres (snake_case)
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

// ------------------- GET: lista todas las posiciones -------------------
export async function GET() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("positions")
    .select("id, fecha, tipo, ticker, posicion, precio, strike, venc_mes, venc_anio, venc_fecha")
    .order("fecha", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const positions = (data as PositionRow[]).map(rowToPosition);
  return NextResponse.json({ positions });
}

// ------------------- POST: inserta una nueva posición -------------------
export async function POST(req: Request) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as Partial<Position>;

  // Validación ligera en el server (defense in depth — el form ya valida)
  if (!body.fecha || !body.tipo || !body.ticker ||
      typeof body.posicion !== "number" || typeof body.precio !== "number") {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const insertRow = {
    fecha: body.fecha,
    tipo: body.tipo,
    ticker: body.ticker,
    posicion: body.posicion,
    precio: body.precio,
    strike: body.strike ?? null,
    venc_mes: body.vencMes ?? null,
    venc_anio: body.vencAnio ?? null,
    venc_fecha: body.vencFecha ?? null,
    created_by: user.id,
  };

  const { data, error } = await supabase
    .from("positions")
    .insert(insertRow)
    .select("id, fecha, tipo, ticker, posicion, precio, strike, venc_mes, venc_anio, venc_fecha")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ position: rowToPosition(data as PositionRow) });
}
