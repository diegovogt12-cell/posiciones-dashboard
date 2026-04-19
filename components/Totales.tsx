"use client";

import { INSTRUMENT_LABELS, InstrumentType, Position } from "@/lib/types";
import { formatMoney, formatNumber } from "@/lib/format";

interface Props {
  positions: Position[];
}

interface Totals {
  contratos: number;
  nocional: number;
  count: number;
  nocionalLong: number;
  nocionalShort: number;
}

const emptyTotals = (): Totals => ({
  contratos: 0,
  nocional: 0,
  count: 0,
  nocionalLong: 0,
  nocionalShort: 0,
});

export default function Totales({ positions }: Props) {
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
    const long = p.posicion >= 0;
    const slots = [global, byType[p.tipo]];
    if (!byTicker[p.ticker]) byTicker[p.ticker] = emptyTotals();
    slots.push(byTicker[p.ticker]);

    for (const t of slots) {
      t.contratos += p.posicion;
      t.nocional += p.nocional;
      t.count += 1;
      if (long) t.nocionalLong += p.nocional;
      else t.nocionalShort += p.nocional;
    }
  }

  const tickerRows = Object.entries(byTicker).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="grid gap-6">
      <section>
        <h2 className="text-sm uppercase tracking-wider text-slate-400 mb-3">Totales globales</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card label="Posiciones" value={formatNumber(global.count)} />
          <Card label="Neto títulos/contratos" value={formatNumber(global.contratos)} emphasis={global.contratos >= 0 ? "pos" : "neg"} />
          <Card label="Nocional neto" value={formatMoney(global.nocional)} emphasis={global.nocional >= 0 ? "pos" : "neg"} />
          <Card label="Nocional bruto" value={formatMoney(global.nocionalLong + Math.abs(global.nocionalShort))} />
        </div>
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-wider text-slate-400 mb-3">Por tipo de instrumento</h2>
        <div className="bg-panel border border-slate-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-slate-400 uppercase text-xs tracking-wider">
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
                  <tr key={t} className="border-t border-slate-800">
                    <td className="px-4 py-3">{INSTRUMENT_LABELS[t]}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatNumber(row.count)}</td>
                    <td className={`px-4 py-3 text-right font-mono ${row.contratos >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {formatNumber(row.contratos)}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono ${row.nocional >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
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
        <h2 className="text-sm uppercase tracking-wider text-slate-400 mb-3">Por ticker</h2>
        <div className="bg-panel border border-slate-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-slate-400 uppercase text-xs tracking-wider">
              <tr>
                <th className="text-left px-4 py-3">Ticker</th>
                <th className="text-right px-4 py-3">Posiciones</th>
                <th className="text-right px-4 py-3">Neto contratos/títulos</th>
                <th className="text-right px-4 py-3">Nocional neto</th>
              </tr>
            </thead>
            <tbody>
              {tickerRows.map(([ticker, row]) => (
                <tr key={ticker} className="border-t border-slate-800">
                  <td className="px-4 py-3 font-mono">{ticker}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatNumber(row.count)}</td>
                  <td className={`px-4 py-3 text-right font-mono ${row.contratos >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {formatNumber(row.contratos)}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono ${row.nocional >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {formatMoney(row.nocional)}
                  </td>
                </tr>
              ))}
              {tickerRows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">Sin datos.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Card({ label, value, emphasis }: { label: string; value: string; emphasis?: "pos" | "neg" }) {
  const tone = emphasis === "pos" ? "text-emerald-400" : emphasis === "neg" ? "text-rose-400" : "text-slate-100";
  return (
    <div className="bg-panel border border-slate-800 rounded-lg p-4">
      <div className="text-xs uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`text-xl font-mono mt-1 ${tone}`}>{value}</div>
    </div>
  );
}
