import { ExpirationMonth, InstrumentType, Position } from "./types";

/**
 * Parser del CSV de trades (uno por fila).
 *
 * Header esperado (orden estricto):
 *   fecha,tipo,ticker,posicion,precio,strike,venc_mes,venc_anio,venc_fecha
 *
 * Reglas por tipo:
 *   - equity:  no strike, no venc
 *   - futuro:  venc_mes + venc_anio (sin strike, sin venc_fecha)
 *   - call/put: strike > 0 + venc_mes + venc_anio (sin venc_fecha)
 *   - forward: venc_fecha (sin strike, sin venc_mes/anio)
 *
 * Devuelve filas válidas + errores con número de línea para que el usuario
 * los corrija sin perder lo que sí está bien.
 */

export interface ParsedTradesCSV {
  rows: Omit<Position, "id">[];
  errors: { line: number; message: string }[];
}

const HEADER = ["fecha", "tipo", "ticker", "posicion", "precio", "strike", "venc_mes", "venc_anio", "venc_fecha"];
const VALID_TIPOS: InstrumentType[] = ["equity", "call", "put", "futuro", "forward"];
const VALID_MESES: ExpirationMonth[] = ["MAR", "JUN", "SEP", "DIC"];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseTradesCSV(text: string): ParsedTradesCSV {
  const lines = text.replace(/^﻿/, "").trim().split(/\r?\n/);
  const rows: Omit<Position, "id">[] = [];
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
    if (!raw) continue;

    const cols = raw.split(",").map((s) => s.trim());
    if (cols.length !== HEADER.length) {
      errors.push({ line: lineNo, message: `Esperaba ${HEADER.length} columnas, recibí ${cols.length}` });
      continue;
    }

    const [fechaRaw, tipoRaw, tickerRaw, posicionRaw, precioRaw, strikeRaw, vencMesRaw, vencAnioRaw, vencFechaRaw] = cols;

    if (!ISO_DATE.test(fechaRaw)) {
      errors.push({ line: lineNo, message: `Fecha inválida: "${fechaRaw}" (esperado YYYY-MM-DD)` });
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

    const posicion = Number(posicionRaw);
    if (!Number.isFinite(posicion) || posicion === 0) {
      errors.push({ line: lineNo, message: `Posición inválida: "${posicionRaw}" (debe ser número distinto de cero)` });
      continue;
    }

    const precio = Number(precioRaw);
    if (!Number.isFinite(precio) || precio < 0) {
      errors.push({ line: lineNo, message: `Precio inválido: "${precioRaw}" (debe ser número no negativo)` });
      continue;
    }

    let strike: number | undefined;
    let vencMes: ExpirationMonth | undefined;
    let vencAnio: number | undefined;
    let vencFecha: string | undefined;

    const isOption = tipo === "call" || tipo === "put";
    const isFuturo = tipo === "futuro";
    const isForward = tipo === "forward";
    const isEquity = tipo === "equity";

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

      if (vencFechaRaw) {
        errors.push({ line: lineNo, message: `${tipo} no debe tener venc_fecha (usar venc_mes/venc_anio)` });
        continue;
      }
    }

    if (isOption) {
      const k = Number(strikeRaw);
      if (!Number.isFinite(k) || k <= 0) {
        errors.push({ line: lineNo, message: "Opciones requieren strike > 0" });
        continue;
      }
      strike = k;
    } else if (strikeRaw) {
      errors.push({ line: lineNo, message: `${tipo} no debe tener strike` });
      continue;
    }

    if (isForward) {
      if (!vencFechaRaw || !ISO_DATE.test(vencFechaRaw)) {
        errors.push({ line: lineNo, message: "Forward requiere venc_fecha YYYY-MM-DD" });
        continue;
      }
      vencFecha = vencFechaRaw;
    }

    if (isEquity) {
      // Equity no debe tener nada de strike/venc
      if (strikeRaw || vencMesRaw || vencAnioRaw || vencFechaRaw) {
        errors.push({ line: lineNo, message: "Equity no debe tener strike ni venc" });
        continue;
      }
    }

    rows.push({
      fecha: fechaRaw,
      tipo,
      ticker,
      posicion,
      precio,
      strike,
      vencMes,
      vencAnio,
      vencFecha,
    });
  }

  return { rows, errors };
}
