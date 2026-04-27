import { CONTRACT_MULTIPLIER, ExpirationMonth, InstrumentType, Position } from "./types";
import { ClosedMatch, fifoMatches } from "./fifo";
import { equityKey, forwardKey, futuroKey } from "./groups";

/**
 * Cálculo de P&L realizado a partir de matches FIFO.
 *
 * Solo considera equity, futuros y forwards. Las opciones quedan fuera
 * porque su P&L involucra prima + ejercicio/expiración y eso amerita
 * un tratamiento aparte.
 *
 * Para cada serie de trades del mismo instrumento corremos `fifoMatches`,
 * que devuelve los cierres con su P&L. Luego rollup:
 *   matches → instrumento → ticker → tipo → total
 */

const PNL_TYPES: InstrumentType[] = ["equity", "futuro", "forward"];

export interface InstrumentPnL {
  ticker: string;
  tipo: InstrumentType;
  vencMes?: ExpirationMonth;
  vencAnio?: number;
  vencFecha?: string;
  matches: ClosedMatch[];
  totalPnL: number;
  totalQty: number;
}

export interface TickerPnL {
  ticker: string;
  instruments: InstrumentPnL[];
  totalPnL: number;
  totalCierres: number;
  totalQty: number;
  // Mezcla de tipos cuando una emisora tiene equity + futuros + forwards
  tipos: InstrumentType[];
}

export interface PnLReport {
  byTicker: TickerPnL[];
  byTipo: Record<"equity" | "futuro" | "forward", number>;
  total: number;
  totalCierres: number;
}

function instrumentKey(p: Position): string {
  if (p.tipo === "equity") return equityKey(p);
  if (p.tipo === "futuro") return futuroKey(p);
  if (p.tipo === "forward") return forwardKey(p);
  return "";
}

export function buildPnLReport(positions: Position[]): PnLReport {
  // 1. Filtrar tipos que aplican y agrupar por instrumento
  const byInstrument = new Map<string, Position[]>();
  for (const p of positions) {
    if (!PNL_TYPES.includes(p.tipo)) continue;
    const k = `${p.tipo}|${instrumentKey(p)}`;
    const arr = byInstrument.get(k);
    if (arr) arr.push(p);
    else byInstrument.set(k, [p]);
  }

  // 2. Calcular matches por instrumento
  const instruments: InstrumentPnL[] = [];
  for (const [, trades] of byInstrument) {
    const sample = trades[0];
    const mult = CONTRACT_MULTIPLIER[sample.tipo];
    const matches = fifoMatches(trades, mult);
    if (matches.length === 0) continue; // sin cierres = sin P&L
    const totalPnL = matches.reduce((s, m) => s + m.pnl, 0);
    const totalQty = matches.reduce((s, m) => s + m.qty, 0);
    instruments.push({
      ticker: sample.ticker,
      tipo: sample.tipo,
      vencMes: sample.vencMes,
      vencAnio: sample.vencAnio,
      vencFecha: sample.vencFecha,
      matches: matches.sort((a, b) => b.closeFecha.localeCompare(a.closeFecha)), // más recientes primero
      totalPnL,
      totalQty,
    });
  }

  // 3. Rollup por ticker
  const tickerMap = new Map<string, TickerPnL>();
  for (const ins of instruments) {
    const existing = tickerMap.get(ins.ticker);
    if (existing) {
      existing.instruments.push(ins);
      existing.totalPnL += ins.totalPnL;
      existing.totalCierres += ins.matches.length;
      existing.totalQty += ins.totalQty;
      if (!existing.tipos.includes(ins.tipo)) existing.tipos.push(ins.tipo);
    } else {
      tickerMap.set(ins.ticker, {
        ticker: ins.ticker,
        instruments: [ins],
        totalPnL: ins.totalPnL,
        totalCierres: ins.matches.length,
        totalQty: ins.totalQty,
        tipos: [ins.tipo],
      });
    }
  }

  const byTicker = Array.from(tickerMap.values()).sort((a, b) => b.totalPnL - a.totalPnL);

  // 4. Rollup por tipo
  const byTipo = { equity: 0, futuro: 0, forward: 0 } as Record<"equity" | "futuro" | "forward", number>;
  let total = 0;
  let totalCierres = 0;
  for (const ins of instruments) {
    byTipo[ins.tipo as "equity" | "futuro" | "forward"] += ins.totalPnL;
    total += ins.totalPnL;
    totalCierres += ins.matches.length;
  }

  return { byTicker, byTipo, total, totalCierres };
}
