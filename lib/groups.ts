import { ExpirationMonth, InstrumentType, Position } from "./types";
import { fifoLiveLots, LiveLot } from "./fifo";

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
