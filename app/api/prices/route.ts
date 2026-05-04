import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Price } from "@/lib/prices";

interface PriceRow {
  id: string;
  fecha: string;
  tipo: Price["tipo"];
  ticker: string;
  strike: number | null;
  venc_mes: Price["vencMes"] | null;
  venc_anio: number | null;
  venc_fecha: string | null;
  precio: number;
}

function rowToPrice(r: PriceRow): Price {
  return {
    id: r.id,
    fecha: r.fecha,
    tipo: r.tipo,
    ticker: r.ticker,
    strike: r.strike != null ? Number(r.strike) : undefined,
    vencMes: r.venc_mes ?? undefined,
    vencAnio: r.venc_anio ?? undefined,
    vencFecha: r.venc_fecha ?? undefined,
    precio: Number(r.precio),
  };
}

// ------------------- GET: lista precios de una fecha -------------------
export async function GET(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const fecha = url.searchParams.get("fecha");
  if (!fecha) return NextResponse.json({ error: "missing fecha param" }, { status: 400 });

  const { data, error } = await supabase
    .from("prices")
    .select("id, fecha, tipo, ticker, strike, venc_mes, venc_anio, venc_fecha, precio")
    .eq("fecha", fecha);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const prices = (data as PriceRow[]).map(rowToPrice);
  return NextResponse.json({ prices });
}

// ------------------- POST: bulk upload con upsert -------------------
interface UploadBody { prices: Array<Omit<Price, "id">>; }

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as UploadBody;
  if (!Array.isArray(body.prices) || body.prices.length === 0) {
    return NextResponse.json({ error: "prices array required" }, { status: 400 });
  }
  if (body.prices.length > 5000) {
    return NextResponse.json({ error: "máximo 5000 precios por upload" }, { status: 400 });
  }

  const insertRows = body.prices.map((p) => ({
    fecha: p.fecha,
    tipo: p.tipo,
    ticker: p.ticker,
    strike: p.strike ?? null,
    venc_mes: p.vencMes ?? null,
    venc_anio: p.vencAnio ?? null,
    venc_fecha: p.vencFecha ?? null,
    precio: p.precio,
    uploaded_by: user.id,
  }));

  // Upsert sobre el unique index (fecha + identificadores del instrumento).
  // Si ya existe el precio para esa fecha+instrumento, lo sobrescribe.
  const { data, error } = await supabase
    .from("prices")
    .upsert(insertRows, {
      onConflict: "fecha,tipo,ticker,strike,venc_mes,venc_anio,venc_fecha",
      ignoreDuplicates: false,
    })
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message, errors: [] }, { status: 500 });
  }

  // El upsert no nos dice cuántos eran nuevos vs actualizados. Devolvemos el
  // total tocado.
  return NextResponse.json({
    inserted: data?.length ?? insertRows.length,
    updated: 0,
    errors: [],
  });
}
