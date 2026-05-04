import { CONTRACT_MULTIPLIER, ExpirationMonth, InstrumentType, Position } from "./types";
import { ClosedMatch, fifoLiveLots, fifoMatches } from "./fifo";
import { allInstrumentsKey, groupPositions } from "./groups";
import { Price, priceKey } from "./prices";

/**
 * Cálculo de P&L por valuación a una fecha "as-of".
 *
 * Para cada instrumento único:
 *   1. Filtramos sus trades a fecha ≤ asOfDate.
 *   2. Corremos FIFO sobre esos trades:
 *      - matches → P&L realizado al as-of date
 *      - lotes vivos → posición abierta al cierre del as-of date
 *   3. MTM por lote vivo: (precioCierre − precioApertura) × qty × multiplicador.
 *      precioCierre se obtiene del archivo de precios cargado para asOfDate.
 *   4. Si falta el precio para algún instrumento abierto, lo marcamos en
 *      `missingPrices` y excluimos su MTM del total (el usuario decidió la
 *      regla iii: bloquear el total cuando falten precios, mostrando "—" en
 *      las celdas afectadas).
 */

export interface InstrumentValuation {
  ticker: string;
  tipo: InstrumentType;
  strike?: number;
  vencMes?: ExpirationMonth;
  vencAnio?: number;
  vencFecha?: string;
  netQty: number;
  avgCost: number | null;          // PEPS sobre lotes vivos
  closingPrice: number | null;     // precio de cierre en asOfDate (null si falta)
  unrealizedPnL: number | null;    // null si no hay precio
  realizedPnL: number;              // P&L acumulado de matches a la fecha
  hasOpen: boolean;                 // tiene lotes vivos
  hasPrice: boolean;                // hay precio cargado para esta fecha
}

export interface TickerValuation {
  ticker: string;
  instruments: InstrumentValuation[];
  realizedPnL: number;
  unrealizedPnL: number | null;     // null si CUALQUIER instrumento abierto le falta precio
  totalPnL: number | null;          // realized + unrealized (null si unrealized es null)
  missingCount: number;             // # instrumentos abiertos sin precio
}

export interface ValuationReport {
  asOfDate: string;
  byTicker: TickerValuation[];
  realizedTotal: number;
  unrealizedTotal: number | null;   // null si falta CUALQUIER precio en la cartera
  total: number | null;
  missingPrices: InstrumentValuation[]; // instrumentos abiertos sin precio
}

const VALUATION_TYPES: InstrumentType[] = ["equity", "futuro", "forward", "call", "put"];

export function buildValuationReport(
  positions: Position[],
  prices: Price[],
  asOfDate: string,
): ValuationReport {
  // Index de precios por instrumento (todos son del mismo asOfDate).
  const priceMap = new Map<string, number>();
  for (const p of prices) {
    priceMap.set(priceKey(p), p.precio);
  }

  // Solo trades hasta la fecha as-of (inclusive). El histórico anterior
  // determina qué está vivo a esa fecha.
  const eligiblePositions = positions.filter(
    (p) => VALUATION_TYPES.includes(p.tipo) && p.fecha <= asOfDate,
  );

  // Agrupamos por instrumento (la key universal — distingue equity/futuro/
  // opción/forward por sus campos identificadores).
  const groups = groupPositions(eligiblePositions, allInstrumentsKey);

  // También necesitamos los matches FIFO para el realized P&L. Los recalculo
  // aquí en lugar de reusar buildPnLReport para tener control sobre el filtro.
  const instruments: InstrumentValuation[] = [];

  for (const g of groups) {
    const mult = CONTRACT_MULTIPLIER[g.tipo];

    // Recalcular FIFO sobre esta serie para obtener matches con sus PnL.
    const matches: ClosedMatch[] = fifoMatches(g.trades, mult);
    const realizedPnL = matches
      .filter((m) => m.closeFecha <= asOfDate)
      .reduce((s, m) => s + m.pnl, 0);

    const hasOpen = g.netQty !== 0;

    // MTM solo aplica si hay lotes vivos.
    const k = priceKey(g);
    const closingPrice = priceMap.get(k);
    const hasPrice = closingPrice != null;

    let unrealizedPnL: number | null = 0;
    if (hasOpen) {
      if (hasPrice) {
        // Σ (closePrice − lot.precio) × lot.qty × multiplicador
        unrealizedPnL = g.liveLots.reduce(
          (s, lot) => s + (closingPrice! - lot.precio) * lot.qty * mult,
          0,
        );
      } else {
        unrealizedPnL = null;
      }
    }

    instruments.push({
      ticker: g.ticker,
      tipo: g.tipo,
      strike: g.strike,
      vencMes: g.vencMes,
      vencAnio: g.vencAnio,
      vencFecha: g.vencFecha,
      netQty: g.netQty,
      avgCost: g.avgPrice,
      closingPrice: closingPrice ?? null,
      unrealizedPnL,
      realizedPnL,
      hasOpen,
      hasPrice,
    });
  }

  // Rollup por ticker
  const tickerMap = new Map<string, TickerValuation>();
  for (const ins of instruments) {
    const existing = tickerMap.get(ins.ticker);
    if (existing) {
      existing.instruments.push(ins);
      existing.realizedPnL += ins.realizedPnL;
      // Unrealized: si CUALQUIER instrumento abierto le falta precio,
      // el unrealized del ticker queda null.
      if (ins.hasOpen && !ins.hasPrice) existing.missingCount += 1;
      if (existing.unrealizedPnL !== null && ins.unrealizedPnL !== null) {
        existing.unrealizedPnL += ins.unrealizedPnL;
      } else if (ins.unrealizedPnL === null) {
        existing.unrealizedPnL = null;
      }
    } else {
      tickerMap.set(ins.ticker, {
        ticker: ins.ticker,
        instruments: [ins],
        realizedPnL: ins.realizedPnL,
        unrealizedPnL: ins.unrealizedPnL,
        totalPnL: 0, // se recalcula al final
        missingCount: ins.hasOpen && !ins.hasPrice ? 1 : 0,
      });
    }
  }

  // Total por ticker (= realized + unrealized si todos los precios están).
  for (const tk of tickerMap.values()) {
    tk.totalPnL = tk.unrealizedPnL !== null ? tk.realizedPnL + tk.unrealizedPnL : null;
  }

  const byTicker = Array.from(tickerMap.values()).sort((a, b) => {
    // Tickers con datos completos primero, ordenados por |totalPnL| desc;
    // los que tienen missingPrices al final, alfabéticos.
    if (a.totalPnL == null && b.totalPnL == null) return a.ticker.localeCompare(b.ticker);
    if (a.totalPnL == null) return 1;
    if (b.totalPnL == null) return -1;
    return Math.abs(b.totalPnL) - Math.abs(a.totalPnL);
  });

  // Totales globales
  let realizedTotal = 0;
  let unrealizedTotal: number | null = 0;
  const missingPrices: InstrumentValuation[] = [];
  for (const ins of instruments) {
    realizedTotal += ins.realizedPnL;
    if (ins.hasOpen && !ins.hasPrice) {
      missingPrices.push(ins);
      unrealizedTotal = null; // bloquea total
    } else if (unrealizedTotal !== null && ins.unrealizedPnL !== null) {
      unrealizedTotal += ins.unrealizedPnL;
    }
  }

  const total = unrealizedTotal !== null ? realizedTotal + unrealizedTotal : null;

  return {
    asOfDate,
    byTicker,
    realizedTotal,
    unrealizedTotal,
    total,
    missingPrices,
  };
}
