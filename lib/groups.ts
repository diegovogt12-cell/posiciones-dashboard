import { CONTRACT_MULTIPLIER, ExpirationMonth, InstrumentType, Position } from "./types";
import { fifoLiveLots, LiveLot } from "./fifo";
import { quarterlyExpiryISO } from "./business-days";

/**
 * Agrupa trades por "instrumento único" y calcula la posición neta + precio
 * promedio PEPS de cada grupo.
 *
 * Qué es un "instrumento único" depende del tipo:
 *   - equity   → ticker
 *   - futuro   → ticker + vencimiento (mes/año)
 *   - opción   → ticker + tipo (call/put) + strike + vencimiento
 *   - forward  → ticker + vencFecha
 *
 * Cada grupo además guarda los trades originales en orden cronológico
 * descendente para la vista de desglose (más reciente arriba).
 */

export interface InstrumentGroup {
  key: string;
  // Identificadores del instrumento (lo que difiere por tipo).
  ticker: string;
  tipo: InstrumentType;
  strike?: number;
  vencMes?: ExpirationMonth;
  vencAnio?: number;
  vencFecha?: string;
  // Trades originales que componen el grupo (para drill-down), ordenados desc por fecha.
  trades: Position[];
  // Resultado FIFO sobre los trades del grupo.
  netQty: number;
  avgPrice: number | null;
  liveLots: LiveLot[];
}

export function groupPositions(
  positions: Position[],
  keyFn: (p: Position) => string,
): InstrumentGroup[] {
  const buckets = new Map<string, Position[]>();
  for (const p of positions) {
    const k = keyFn(p);
    const arr = buckets.get(k);
    if (arr) arr.push(p);
    else buckets.set(k, [p]);
  }

  const groups: InstrumentGroup[] = [];
  for (const [key, trades] of buckets) {
    const fifo = fifoLiveLots(trades);
    const sample = trades[0]; // metadata del instrumento — todos los trades del grupo la comparten
    groups.push({
      key,
      ticker: sample.ticker,
      tipo: sample.tipo,
      strike: sample.strike,
      vencMes: sample.vencMes,
      vencAnio: sample.vencAnio,
      vencFecha: sample.vencFecha,
      trades: [...trades].sort((a, b) => b.fecha.localeCompare(a.fecha)),
      netQty: fifo.netQty,
      avgPrice: fifo.avgPrice,
      liveLots: fifo.lots,
    });
  }
  return groups;
}

// Funciones de key para cada tipo de instrumento.
export const equityKey = (p: Position) => p.ticker;
export const futuroKey = (p: Position) =>
  `${p.ticker}|${p.vencMes ?? ""}|${p.vencAnio ?? ""}`;
export const opcionKey = (p: Position) =>
  `${p.ticker}|${p.tipo}|${p.strike ?? ""}|${p.vencMes ?? ""}|${p.vencAnio ?? ""}`;
export const forwardKey = (p: Position) =>
  `${p.ticker}|${p.vencFecha ?? ""}`;

// Key universal para la pestaña "Por emisora": distingue cualquier
// instrumento único sin importar su tipo.
export const allInstrumentsKey = (p: Position) =>
  `${p.ticker}|${p.tipo}|${p.strike ?? ""}|${p.vencMes ?? ""}|${p.vencAnio ?? ""}|${p.vencFecha ?? ""}`;

// Comparador genérico: ordena por ticker, luego por vencimiento, luego por strike.
export function compareGroups(a: InstrumentGroup, b: InstrumentGroup): number {
  if (a.ticker !== b.ticker) return a.ticker.localeCompare(b.ticker);
  if (a.tipo !== b.tipo) return a.tipo.localeCompare(b.tipo);
  // Vencimiento: trimestral primero por año, luego mes; forward por fecha
  const aVenc = a.vencFecha ?? `${a.vencAnio ?? ""}-${a.vencMes ?? ""}`;
  const bVenc = b.vencFecha ?? `${b.vencAnio ?? ""}-${b.vencMes ?? ""}`;
  if (aVenc !== bVenc) return aVenc.localeCompare(bVenc);
  return (a.strike ?? 0) - (b.strike ?? 0);
}

// ============================================================
// Helpers para la pestaña "Por emisora"
// ============================================================

/**
 * Nocional del grupo para sorting/visualización.
 *
 * - Opciones (call/put): exposición = strike × netQty × multiplicador.
 * - Resto (equity, futuro, forward): costo PEPS × netQty × multiplicador.
 *
 * Preserva el signo (largo + / corto -). Devuelve 0 si no hay strike
 * (opción) o si la posición está plana (avgPrice = null).
 */
export function groupNocional(g: InstrumentGroup): number {
  const mult = CONTRACT_MULTIPLIER[g.tipo];
  const isOption = g.tipo === "call" || g.tipo === "put";
  if (isOption) {
    if (g.strike == null) return 0;
    return g.netQty * g.strike * mult;
  }
  if (g.avgPrice == null) return 0;
  return g.netQty * g.avgPrice * mult;
}

/** Fecha del trade más antiguo del grupo (cuándo se abrió por primera vez). */
export function groupOldestTradeDate(g: InstrumentGroup): string {
  if (g.trades.length === 0) return "9999-12-31";
  // trades viene ordenado desc por fecha — el último es el más antiguo.
  return g.trades[g.trades.length - 1].fecha;
}

// Orden "natural" de tipos para presentar — equity primero, derivados después.
const TIPO_ORDER: Record<InstrumentType, number> = {
  equity: 0,
  futuro: 1,
  call: 2,
  put: 3,
  forward: 4,
};

export type SortKey = "nocional" | "ticker" | "antiguedad";

/**
 * Ordena una lista de grupos por la key elegida. Devuelve copia.
 *
 * - "nocional"  : |nocional| descendente (tamaño de exposición)
 * - "ticker"    : ticker A→Z, luego tipo natural, luego venc, luego strike
 * - "antiguedad": trade más antiguo primero (ascendente)
 *
 * En empates aplica ticker A→Z + tipo natural como tiebreaker.
 */
export function sortGroups(groups: InstrumentGroup[], key: SortKey): InstrumentGroup[] {
  const arr = [...groups];

  const tiebreak = (a: InstrumentGroup, b: InstrumentGroup): number => {
    if (a.ticker !== b.ticker) return a.ticker.localeCompare(b.ticker);
    return TIPO_ORDER[a.tipo] - TIPO_ORDER[b.tipo];
  };

  switch (key) {
    case "nocional": {
      arr.sort((a, b) => {
        const diff = Math.abs(groupNocional(b)) - Math.abs(groupNocional(a));
        return diff !== 0 ? diff : tiebreak(a, b);
      });
      break;
    }
    case "ticker": {
      arr.sort((a, b) => {
        if (a.ticker !== b.ticker) return a.ticker.localeCompare(b.ticker);
        if (a.tipo !== b.tipo) return TIPO_ORDER[a.tipo] - TIPO_ORDER[b.tipo];
        const aV = a.vencFecha ?? `${a.vencAnio ?? ""}-${a.vencMes ?? ""}`;
        const bV = b.vencFecha ?? `${b.vencAnio ?? ""}-${b.vencMes ?? ""}`;
        if (aV !== bV) return aV.localeCompare(bV);
        return (a.strike ?? 0) - (b.strike ?? 0);
      });
      break;
    }
    case "antiguedad": {
      arr.sort((a, b) => {
        const diff = groupOldestTradeDate(a).localeCompare(groupOldestTradeDate(b));
        return diff !== 0 ? diff : tiebreak(a, b);
      });
      break;
    }
  }

  return arr;
}

// ============================================================
// Filtro de "grupos vivos" — para ocultar posiciones cerradas y
// derivados vencidos en las vistas agregadas.
// ============================================================

/** Devuelve la fecha (yyyy-mm-dd) en zona horaria local. */
function ymd(d: Date): string {
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * Decide si un grupo se muestra en las vistas agregadas.
 *
 * Se oculta cuando:
 *   - netQty === 0 (posición neteada — cerraste con compras = ventas)
 *   - es un derivado y ya pasó su vencimiento:
 *       · futuros / opciones (trimestral): se ocultan a partir del día
 *         siguiente al **tercer viernes** del mes de venc (convención
 *         BMV/MexDer). Ej: MAR26 desaparece a partir del 21-mar-2026.
 *       · forwards: se ocultan el día después de vencFecha.
 *
 * Equity y derivados sin venc capturado siempre se consideran vivos.
 */
export function isLiveGroup(g: InstrumentGroup, today: Date = new Date()): boolean {
  if (g.netQty === 0) return false;
  if (g.tipo === "equity") return true;

  const todayStr = ymd(today);

  if (g.tipo === "forward") {
    if (!g.vencFecha) return true;
    return g.vencFecha >= todayStr;
  }

  // futuros / call / put — vencen el 3er viernes del mes
  if (g.vencMes && g.vencAnio) {
    return quarterlyExpiryISO(g.vencMes, g.vencAnio) >= todayStr;
  }
  return true;
}

export function filterLiveGroups(groups: InstrumentGroup[], today?: Date): InstrumentGroup[] {
  const ref = today ?? new Date();
  return groups.filter((g) => isLiveGroup(g, ref));
}
