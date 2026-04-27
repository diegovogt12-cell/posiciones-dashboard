import { Position } from "./types";

/**
 * PEPS (FIFO) sobre una serie de trades del mismo instrumento.
 *
 * Regla: los lotes se procesan cronológicamente. Cuando llega un trade con
 * dirección opuesta al inventario (una "salida" respecto a los lotes vivos),
 * consume los lotes más antiguos primero. Si la salida excede el inventario,
 * el remanente queda como lote abierto en la dirección del trade.
 *
 * Maneja casos mezclados (largos y cortos en la misma serie): si la posición
 * flip de signo, el inventario refleja la nueva dirección.
 */

export interface LiveLot {
  positionId: string;      // id del trade original que generó el lote
  fecha: string;           // ISO yyyy-mm-dd
  qty: number;             // cantidad viva; signo = dirección (+ largo / - corto)
  precio: number;          // precio original al que se abrió el lote
}

export interface FifoResult {
  lots: LiveLot[];         // lotes vivos en orden cronológico (más viejo primero)
  netQty: number;          // suma de qty — debe coincidir con neto del ticker
  avgPrice: number | null; // costo promedio de los lotes vivos (null si neto = 0)
}

export function fifoLiveLots(trades: Position[]): FifoResult {
  const ordered = [...trades].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const inventory: LiveLot[] = [];

  for (const t of ordered) {
    const newLot = (): LiveLot => ({
      positionId: t.id,
      fecha: t.fecha,
      qty: t.posicion,
      precio: t.precio,
    });

    if (inventory.length === 0 || Math.sign(inventory[0].qty) === Math.sign(t.posicion)) {
      inventory.push(newLot());
      continue;
    }

    // Dirección opuesta: consume FIFO
    let tradeAbs = Math.abs(t.posicion);
    while (tradeAbs > 0 && inventory.length > 0) {
      const head = inventory[0];
      const headAbs = Math.abs(head.qty);
      if (headAbs <= tradeAbs) {
        tradeAbs -= headAbs;
        inventory.shift();
      } else {
        const sign = Math.sign(head.qty);
        head.qty = sign * (headAbs - tradeAbs);
        tradeAbs = 0;
      }
    }

    // Si el trade fue mayor que todo el inventario, el remanente abre un lote
    // con la dirección opuesta (se invirtió la posición).
    if (tradeAbs > 0) {
      inventory.push({
        positionId: t.id,
        fecha: t.fecha,
        qty: Math.sign(t.posicion) * tradeAbs,
        precio: t.precio,
      });
    }
  }

  const netQty = inventory.reduce((s, l) => s + l.qty, 0);
  const totalNotional = inventory.reduce((s, l) => s + l.qty * l.precio, 0);
  const avgPrice = netQty !== 0 ? totalNotional / netQty : null;

  return { lots: inventory, netQty, avgPrice };
}

/**
 * Match (cierre parcial o total) generado por FIFO cuando un trade consume
 * un lote previo de dirección contraria.
 */
export interface ClosedMatch {
  openPositionId: string;   // id del trade que abrió el lote
  closePositionId: string;  // id del trade que lo cerró
  openFecha: string;
  closeFecha: string;
  openPrice: number;
  closePrice: number;
  qty: number;              // cantidad cerrada (positiva)
  longLot: boolean;         // true si el lote era largo (compra), false si corto (venta)
  pnl: number;              // P&L realizado, ya con multiplicador aplicado
}

/**
 * Como `fifoLiveLots`, pero registra cada match (cierre) para cálculo de
 * P&L realizado.
 *
 * Reglas:
 *   - Lote largo (compra) cerrado con venta:
 *       P&L = (closePrice − openPrice) × qty × multiplicador
 *   - Lote corto (venta) cerrado con compra:
 *       P&L = (openPrice − closePrice) × qty × multiplicador
 *
 * Si un trade flippea la posición (consume todo el inventario y abre un
 * lote opuesto), solo la porción consumida genera matches; el remanente
 * queda como lote nuevo y aún no contribuye al P&L realizado.
 */
export function fifoMatches(trades: Position[], multiplier: number): ClosedMatch[] {
  const ordered = [...trades].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const inventory: LiveLot[] = [];
  const matches: ClosedMatch[] = [];

  for (const t of ordered) {
    if (inventory.length === 0 || Math.sign(inventory[0].qty) === Math.sign(t.posicion)) {
      inventory.push({
        positionId: t.id,
        fecha: t.fecha,
        qty: t.posicion,
        precio: t.precio,
      });
      continue;
    }

    let tradeAbs = Math.abs(t.posicion);

    while (tradeAbs > 0 && inventory.length > 0) {
      const head = inventory[0];
      const headAbs = Math.abs(head.qty);
      const headSign = Math.sign(head.qty);
      const consumed = Math.min(headAbs, tradeAbs);

      const longLot = headSign > 0;
      const pnl = longLot
        ? (t.precio - head.precio) * consumed * multiplier
        : (head.precio - t.precio) * consumed * multiplier;

      matches.push({
        openPositionId: head.positionId,
        closePositionId: t.id,
        openFecha: head.fecha,
        closeFecha: t.fecha,
        openPrice: head.precio,
        closePrice: t.precio,
        qty: consumed,
        longLot,
        pnl,
      });

      if (headAbs <= tradeAbs) {
        tradeAbs -= headAbs;
        inventory.shift();
      } else {
        head.qty = headSign * (headAbs - tradeAbs);
        tradeAbs = 0;
      }
    }

    if (tradeAbs > 0) {
      inventory.push({
        positionId: t.id,
        fecha: t.fecha,
        qty: Math.sign(t.posicion) * tradeAbs,
        precio: t.precio,
      });
    }
  }

  return matches;
}
