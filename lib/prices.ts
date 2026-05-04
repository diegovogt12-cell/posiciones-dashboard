import { ExpirationMonth, InstrumentType, Position } from "./types";

/**
 * Precio de cierre capturado en un día específico para un instrumento.
 *
 * Las columnas de identificación del instrumento (strike, vencMes, vencAnio,
 * vencFecha) son opcionales — solo se llenan cuando aplican al tipo:
 *   - equity:  ninguna
 *   - futuro:  vencMes + vencAnio
 *   - call/put: strike + vencMes + vencAnio
 *   - forward: vencFecha
 */
export interface Price {
  id: string;
  fecha: string;
  tipo: InstrumentType;
  ticker: string;
  strike?: number;
  vencMes?: ExpirationMonth;
  vencAnio?: number;
  vencFecha?: string;
  precio: number;
}

/**
 * Genera la "key" canónica que une un precio con la posición (group) que
 * valúa. Tiene que ser idéntica a la key que usa `groups.ts` para
 * `allInstrumentsKey()` para que el matching funcione.
 */
export function priceKey(input: {
  tipo: InstrumentType;
  ticker: string;
  strike?: number;
  vencMes?: ExpirationMonth;
  vencAnio?: number;
  vencFecha?: string;
}): string {
  return `${input.ticker}|${input.tipo}|${input.strike ?? ""}|${input.vencMes ?? ""}|${input.vencAnio ?? ""}|${input.vencFecha ?? ""}`;
}

/** Same key built from a Position. */
export const positionPriceKey = (p: Position): string => priceKey(p);

// ============================================================
// Cliente: llamadas al API
// ============================================================

export async function fetchPriceDates(): Promise<string[]> {
  const res = await fetch("/api/prices/dates", { cache: "no-store" });
  if (!res.ok) {
    if (res.status === 401) return [];
    throw new Error(`GET /api/prices/dates ${res.status}`);
  }
  const { dates } = await res.json();
  return dates as string[];
}

export async function fetchPricesForDate(fecha: string): Promise<Price[]> {
  const res = await fetch(`/api/prices?fecha=${fecha}`, { cache: "no-store" });
  if (!res.ok) {
    if (res.status === 401) return [];
    throw new Error(`GET /api/prices ${res.status}`);
  }
  const { prices } = await res.json();
  return prices as Price[];
}

export interface UploadResult {
  inserted: number;
  updated: number;
  errors: { line: number; message: string }[];
}

export async function uploadPrices(rows: Omit<Price, "id">[]): Promise<UploadResult> {
  const res = await fetch("/api/prices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prices: rows }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST /api/prices ${res.status}: ${text}`);
  }
  return (await res.json()) as UploadResult;
}

// ============================================================
// CSV parser
// ============================================================

export interface ParsedCSV {
  rows: Omit<Price, "id">[];
  errors: { line: number; message: string }[];
}

const HEADER = ["fecha", "tipo", "ticker", "strike", "venc_mes", "venc_anio", "venc_fecha", "precio"];
const VALID_TIPOS: InstrumentType[] = ["equity", "call", "put", "futuro", "forward"];
const VALID_MESES: ExpirationMonth[] = ["MAR", "JUN", "SEP", "DIC"];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parsea el CSV de precios (formato A: un solo archivo con todos los tipos).
 *
 * Espera header exacto: fecha,tipo,ticker,strike,venc_mes,venc_anio,venc_fecha,precio
 * Columnas vacías son OK cuando no aplican al tipo.
 *
 * Validaciones:
 *   - fecha en formato YYYY-MM-DD
 *   - tipo en {equity,call,put,futuro,forward}
 *   - ticker no vacío, en MAYÚSCULAS (se normaliza)
 *   - precio > 0
 *   - call/put requieren strike > 0 + vencMes + vencAnio
 *   - futuro requiere vencMes + vencAnio
 *   - forward requiere vencFecha
 *   - equity no debe tener strike/venc
 *
 * Devuelve filas válidas + errores con número de línea para que el usuario
 * los corrija sin perder lo que sí está bien.
 */
export function parsePricesCSV(text: string): ParsedCSV {
  const lines = text.replace(/^﻿/, "").trim().split(/\r?\n/);
  const rows: Omit<Price, "id">[] = [];
  const errors: { line: number; message: string }[] = [];

  if (lines.length === 0) {
    return { rows, errors: [{ line: 0, message: "CSV vacío" }] };
  }

  const header = lines[0].split(",").map((s) => s.trim().toLowerCase());
  if (header.join(",") !== HEADER.join(",")) {
    errors.push({
      line: 1,
      message: `Header esperado: ${HEADER.join(",")}. Recibido: ${header.join(",")}`,
    });
    return { rows, errors };
  }

  for (let i = 1; i < lines.length; i++) {
    const lineNo = i + 1;
    const raw = lines[i].trim();
    if (!raw) continue; // skip líneas vacías

    const cols = raw.split(",").map((s) => s.trim());
    if (cols.length !== HEADER.length) {
      errors.push({ line: lineNo, message: `Esperaba ${HEADER.length} columnas, recibí ${cols.length}` });
      continue;
    }

    const [fecha, tipoRaw, tickerRaw, strikeRaw, vencMesRaw, vencAnioRaw, vencFechaRaw, precioRaw] = cols;

    if (!ISO_DATE.test(fecha)) {
      errors.push({ line: lineNo, message: `Fecha inválida: "${fecha}" (esperado YYYY-MM-DD)` });
      continue;
    }
    const tipo = tipoRaw as InstrumentType;
    if (!VALID_TIPOS.includes(tipo)) {
      errors.push({ line: lineNo, message: `Tipo inválido: "${tipoRaw}"` });
      continue;
    }
    const ticker = tickerRaw.toUpperCase();
    if (!ticker) {
      errors.push({ line: lineNo, message: "Ticker vacío" });
      continue;
    }
    const precio = Number(precioRaw);
    if (!Number.isFinite(precio) || precio <= 0) {
      errors.push({ line: lineNo, message: `Precio inválido: "${precioRaw}"` });
      continue;
    }

    let strike: number | undefined;
    let vencMes: ExpirationMonth | undefined;
    let vencAnio: number | undefined;
    let vencFecha: string | undefined;

    const isOption = tipo === "call" || tipo === "put";
    const isFuturo = tipo === "futuro";
    const isForward = tipo === "forward";

    if (isOption || isFuturo) {
      if (!vencMesRaw || !VALID_MESES.includes(vencMesRaw as ExpirationMonth)) {
        errors.push({ line: lineNo, message: `${tipo} requiere venc_mes (${VALID_MESES.join("/")})` });
        continue;
      }
      const yr = Number(vencAnioRaw);
      if (!Number.isFinite(yr) || yr < 2020 || yr > 2100) {
        errors.push({ line: lineNo, message: `${tipo} requiere venc_anio válido` });
        continue;
      }
      vencMes = vencMesRaw as ExpirationMonth;
      vencAnio = yr;
    }

    if (isOption) {
      const k = Number(strikeRaw);
      if (!Number.isFinite(k) || k <= 0) {
        errors.push({ line: lineNo, message: `Opciones requieren strike > 0` });
        continue;
      }
      strike = k;
    }

    if (isForward) {
      if (!vencFechaRaw || !ISO_DATE.test(vencFechaRaw)) {
        errors.push({ line: lineNo, message: `Forward requiere venc_fecha YYYY-MM-DD` });
        continue;
      }
      vencFecha = vencFechaRaw;
    }

    rows.push({ fecha, tipo, ticker, strike, vencMes, vencAnio, vencFecha, precio });
  }

  return { rows, errors };
}
