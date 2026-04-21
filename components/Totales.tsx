"use client";

import { useState } from "react";
import {
  INSTRUMENT_LABELS,
  InstrumentType,
  Position,
  notional,
  notionalExposure,
  isOption,
} from "@/lib/types";
import { fifoLiveLots, LiveLot } from "@/lib/fifo";
import { formatMoney, formatNumber } from "@/lib/format";

interface Props {
  positions: Position[];
}

interface Totals {
  contratos: number;
  nocional: number;
  exposicion: number;
  count: number;
  nocionalLong: number;
  nocionalShort: number;
}

const emptyTotals = (): Totals => ({
  contratos: 0,
  nocional: 0,
  exposicion: 0,
  count: 0,
  nocionalLong: 0,
  nocionalShort: 0,
});

const panel = "bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm";
const thead = "bg-slate-50 text-slate-600 uppercase text-xs tracking-wider";
const rowBase = "border-t border-slate-200";
const h2 = "text-sm uppercase tracking-wider text-slate-600 mb-3";
const pos = "text-emerald-600";
const neg = "text-rose-600";
const muted = "text-slate-400";

export default function Totales({ positions }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const global = emptyTotals();
  const byType: Record<InstrumentType, Totals> = {
    equity: emptyTotals(),
    call: emptyTotals(),
    put: emptyTotals(),
    futuro: emptyTotals(),
    forward: emptyTotals(),
  };
  const byTicker: Record<string, Totals> = {};

  for (const p of positions) {
    const noc = notional(p);
    const expo = notionalExposure(p) ?? 0;
    const long = p.posicion >= 0;
    const slots = [global, byType[p.tipo]];
    if (!byTicker[p.ticker]) byTicker[p.ticker] = emptyTotals();
    slots.push(byTicker[p.ticker]);

    for (const t of slots) {
      t.contratos += p.posicion;
      t.nocional += noc;
      t.exposicion += expo;
      t.count += 1;
      if (long) t.nocionalLong += noc;
      else t.nocionalShort += noc;
    }
  }

  const tickerRows = Object.entries(byTicker).sort(([a], [b]) => a.localeCompare(b));
  const optionRows = (Object.keys(byType) as InstrumentType[]).filter(
    (t) => isOption(t) && byType[t].count > 0
  );

  // PEPS (FIFO) para equity y futuros, agrupado por ticker + tipo
  interface FifoGroup {
    key: string;
    ticker: string;
    tipo: InstrumentType;
    count: number;
    lots: LiveLot[];
    netQty: number;
    avgPrice: number | null;
  }
  const groupMap: Record<string, Position[]> = {};
  for (const p of positions) {
    if (p.tipo !== "equity" && p.tipo !== "futuro") continue;
    const key = `${p.ticker}::${p.tipo}`;
    (groupMap[key] ||= []).push(p);
  }
  const fifoGroups: FifoGroup[] = Object.entries(groupMap)
    .map(([key, trades]) => {
      const { lots, netQty, avgPrice } = fifoLiveLots(trades);
      return {
        key,
        ticker: trades[0].ticker,
        tipo: trades[0].tipo,
        count: trades.length,
        lots,
        netQty,
        avgPrice,
      };
    })
    .sort((a, b) => (a.ticker === b.ticker ? a.tipo.localeCompare(b.tipo) : a.ticker.localeCompare(b.ticker)));

  const signTone = (n: number) => (n >= 0 ? pos : neg);

  return (
    <div className="grid gap-6">
      <section>
        <h2 className={h2}>Totales globales</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card label="Posiciones" value={formatNumber(global.count)} />
          <Card
            label="Neto títulos/contratos"
            value={formatNumber(global.contratos)}
            emphasis={global.contratos >= 0 ? "pos" : "neg"}
          />
          <Card
            label="Nocional neto (prima)"
            value={formatMoney(global.nocional)}
            emphasis={global.nocional >= 0 ? "pos" : "neg"}
          />
          <Card
            label="Nocional bruto (prima)"
            value={formatMoney(global.nocionalLong + Math.abs(global.nocionalShort))}
          />
        </div>
      </section>

      {fifoGroups.length > 0 && (
        <section>
          <h2 className={h2}>Precio promedio PEPS — equity y futuros</h2>
          <div className={panel}>
            <table className="w-full text-sm">
              <thead className={thead}>
                <tr>
                  <th className="w-10 px-4 py-3"></th>
                  <th className="text-left px-4 py-3">Ticker</th>
                  <th className="text-left px-4 py-3">Tipo</th>
                  <th className="text-right px-4 py-3">Trades</th>
                  <th className="text-right px-4 py-3">Neto títulos/contratos</th>
                  <th className="text-right px-4 py-3" title="Costo promedio de los lotes vivos (PEPS)">
                    Precio promedio
                  </th>
                </tr>
              </thead>
              <tbody>
                {fifoGroups.map((g) => {
                  const open = expanded.has(g.key);
                  const canExpand = g.lots.length > 0;
                  return (
                    <FifoRow
                      key={g.key}
                      group={g}
                      open={open}
                      canExpand={canExpand}
                      onToggle={() => canExpand && toggle(g.key)}
                      signTone={signTone}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Método PEPS (primeras entradas, primeras salidas). Las salidas consumen los lotes más
            antiguos primero; el precio promedio se calcula sobre los lotes vivos restantes.
            Haz clic en ▸ para ver el desglose de la posición viva.
          </p>
        </section>
      )}

      {optionRows.length > 0 && (
        <section>
          <h2 className={h2}>Opciones — nocional (prima) vs exposición (strike)</h2>
          <div className={panel}>
            <table className="w-full text-sm">
              <thead className={thead}>
                <tr>
                  <th className="text-left px-4 py-3">Tipo</th>
                  <th className="text-right px-4 py-3">Posiciones</th>
                  <th className="text-right px-4 py-3">Neto contratos</th>
                  <th className="text-right px-4 py-3" title="Prima × contratos × 100">
                    Nocional (prima)
                  </th>
                  <th className="text-right px-4 py-3" title="Strike × contratos × 100">
                    Exposición (strike)
                  </th>
                </tr>
              </thead>
              <tbody>
                {optionRows.map((t) => {
                  const row = byType[t];
                  return (
                    <tr key={t} className={rowBase}>
                      <td className="px-4 py-3 text-slate-700">{INSTRUMENT_LABELS[t]}</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700">{formatNumber(row.count)}</td>
                      <td className={`px-4 py-3 text-right font-mono ${signTone(row.contratos)}`}>
                        {formatNumber(row.contratos)}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono ${signTone(row.nocional)}`}>
                        {formatMoney(row.nocional)}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono ${signTone(row.exposicion)}`}>
                        {formatMoney(row.exposicion)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section>
        <h2 className={h2}>Por tipo de instrumento</h2>
        <div className={panel}>
          <table className="w-full text-sm">
            <thead className={thead}>
              <tr>
                <th className="text-left px-4 py-3">Tipo</th>
                <th className="text-right px-4 py-3">Posiciones</th>
                <th className="text-right px-4 py-3">Neto contratos/títulos</th>
                <th className="text-right px-4 py-3">Nocional neto</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(byType) as InstrumentType[]).map((t) => {
                const row = byType[t];
                if (row.count === 0) return null;
                return (
                  <tr key={t} className={rowBase}>
                    <td className="px-4 py-3 text-slate-700">{INSTRUMENT_LABELS[t]}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">{formatNumber(row.count)}</td>
                    <td className={`px-4 py-3 text-right font-mono ${signTone(row.contratos)}`}>
                      {formatNumber(row.contratos)}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono ${signTone(row.nocional)}`}>
                      {formatMoney(row.nocional)}
                    </td>
                  </tr>
                );
              })}
              {positions.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">Sin datos.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className={h2}>Por ticker</h2>
        <div className={panel}>
          <table className="w-full text-sm">
            <thead className={thead}>
              <tr>
                <th className="text-left px-4 py-3">Ticker</th>
                <th className="text-right px-4 py-3">Posiciones</th>
                <th className="text-right px-4 py-3">Neto contratos/títulos</th>
                <th className="text-right px-4 py-3">Nocional neto</th>
                <th className="text-right px-4 py-3" title="Exposición agregada de opciones del ticker">
                  Exposición opciones
                </th>
              </tr>
            </thead>
            <tbody>
              {tickerRows.map(([ticker, row]) => (
                <tr key={ticker} className={rowBase}>
                  <td className="px-4 py-3 font-mono text-slate-900">{ticker}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700">{formatNumber(row.count)}</td>
                  <td className={`px-4 py-3 text-right font-mono ${signTone(row.contratos)}`}>
                    {formatNumber(row.contratos)}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono ${signTone(row.nocional)}`}>
                    {formatMoney(row.nocional)}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono ${row.exposicion === 0 ? muted : signTone(row.exposicion)}`}>
                    {row.exposicion === 0 ? "—" : formatMoney(row.exposicion)}
                  </td>
                </tr>
              ))}
              {tickerRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">Sin datos.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function FifoRow({
  group,
  open,
  canExpand,
  onToggle,
  signTone,
}: {
  group: {
    key: string;
    ticker: string;
    tipo: InstrumentType;
    count: number;
    lots: LiveLot[];
    netQty: number;
    avgPrice: number | null;
  };
  open: boolean;
  canExpand: boolean;
  onToggle: () => void;
  signTone: (n: number) => string;
}) {
  return (
    <>
      <tr
        className={`${rowBase} ${canExpand ? "cursor-pointer hover:bg-slate-50" : "opacity-70"}`}
        onClick={onToggle}
      >
        <td className="w-10 px-4 py-3 text-slate-400">
          {canExpand ? (open ? "▾" : "▸") : <span className={muted}>—</span>}
        </td>
        <td className="px-4 py-3 font-mono text-slate-900">{group.ticker}</td>
        <td className="px-4 py-3 text-slate-700">{INSTRUMENT_LABELS[group.tipo]}</td>
        <td className="px-4 py-3 text-right font-mono text-slate-700">{formatNumber(group.count)}</td>
        <td className={`px-4 py-3 text-right font-mono ${signTone(group.netQty)}`}>
          {formatNumber(group.netQty)}
        </td>
        <td className="px-4 py-3 text-right font-mono text-slate-900">
          {group.avgPrice == null ? (
            <span className={muted} title="Posición plana">—</span>
          ) : (
            formatMoney(group.avgPrice)
          )}
        </td>
      </tr>
      {open && canExpand && (
        <tr className={rowBase}>
          <td></td>
          <td colSpan={5} className="px-4 py-3 bg-slate-50/60">
            <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">
              Desglose de la posición viva ({group.lots.length} lote{group.lots.length === 1 ? "" : "s"})
            </div>
            <table className="w-full text-xs">
              <thead className="text-slate-500">
                <tr>
                  <th className="text-left font-medium px-2 py-1">Fecha lote</th>
                  <th className="text-right font-medium px-2 py-1">Cantidad viva</th>
                  <th className="text-right font-medium px-2 py-1">Precio del lote</th>
                  <th className="text-right font-medium px-2 py-1">Nocional del lote</th>
                </tr>
              </thead>
              <tbody>
                {group.lots.map((l, i) => (
                  <tr key={`${l.positionId}-${i}`} className="border-t border-slate-200">
                    <td className="px-2 py-1 font-mono text-slate-700">{l.fecha}</td>
                    <td className={`px-2 py-1 text-right font-mono ${signTone(l.qty)}`}>
                      {formatNumber(l.qty)}
                    </td>
                    <td className="px-2 py-1 text-right font-mono text-slate-700">
                      {formatMoney(l.precio)}
                    </td>
                    <td className={`px-2 py-1 text-right font-mono ${signTone(l.qty * l.precio)}`}>
                      {formatMoney(l.qty * l.precio)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}

function Card({ label, value, emphasis }: { label: string; value: string; emphasis?: "pos" | "neg" }) {
  const tone =
    emphasis === "pos" ? "text-emerald-600" : emphasis === "neg" ? "text-rose-600" : "text-slate-900";
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-xl font-mono mt-1 ${tone}`}>{value}</div>
    </div>
  );
}
