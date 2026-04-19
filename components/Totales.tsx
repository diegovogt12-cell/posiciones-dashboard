"use client";

import {
  INSTRUMENT_LABELS,
  InstrumentType,
  Position,
  notional,
  notionalExposure,
  isOption,
} from "@/lib/types";
import { formatMoney, formatNumber } from "@/lib/format";

interface Props {
  positions: Position[];
}

interface Totals {
  contratos: number;
  nocional: number;          // suma de prima × pos × mult
  exposicion: number;        // suma de strike × pos × mult (solo opciones)
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

// Estilos reutilizables — tema claro
const panel = "bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm";
const thead = "bg-slate-50 text-slate-600 uppercase text-xs tracking-wider";
const rowBase = "border-t border-slate-200";
const h2 = "text-sm uppercase tracking-wider text-slate-600 mb-3";
const pos = "text-emerald-600";
const neg = "text-rose-600";
const muted = "text-slate-400";

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

  // VWAP para equity y futuros, agrupado por ticker + tipo.
  interface VwapRow {
    ticker: string;
    tipo: InstrumentType;
    netPos: number;
    pricePosSum: number;
    count: number;
  }
  const vwapMap: Record<string, VwapRow> = {};
  for (const p of positions) {
    if (p.tipo !== "equity" && p.tipo !== "futuro") continue;
    const key = `${p.ticker}::${p.tipo}`;
    if (!vwapMap[key]) {
      vwapMap[key] = { ticker: p.ticker, tipo: p.tipo, netPos: 0, pricePosSum: 0, count: 0 };
    }
    vwapMap[key].netPos += p.posicion;
    vwapMap[key].pricePosSum += p.precio * p.posicion;
    vwapMap[key].count += 1;
  }
  const vwapRows = Object.values(vwapMap).sort((a, b) =>
    a.ticker === b.ticker ? a.tipo.localeCompare(b.tipo) : a.ticker.localeCompare(b.ticker)
  );

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

      {vwapRows.length > 0 && (
        <section>
          <h2 className={h2}>Precio promedio (VWAP) — equity y futuros</h2>
          <div className={panel}>
            <table className="w-full text-sm">
              <thead className={thead}>
                <tr>
                  <th className="text-left px-4 py-3">Ticker</th>
                  <th className="text-left px-4 py-3">Tipo</th>
                  <th className="text-right px-4 py-3">Posiciones</th>
                  <th className="text-right px-4 py-3">Neto títulos/contratos</th>
                  <th className="text-right px-4 py-3" title="Σ(precio × posición) / Σ(posición)">
                    Precio promedio
                  </th>
                </tr>
              </thead>
              <tbody>
                {vwapRows.map((r) => {
                  const vwap = r.netPos !== 0 ? r.pricePosSum / r.netPos : null;
                  return (
                    <tr key={`${r.ticker}-${r.tipo}`} className={rowBase}>
                      <td className="px-4 py-3 font-mono text-slate-900">{r.ticker}</td>
                      <td className="px-4 py-3 text-slate-700">{INSTRUMENT_LABELS[r.tipo]}</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700">{formatNumber(r.count)}</td>
                      <td className={`px-4 py-3 text-right font-mono ${signTone(r.netPos)}`}>
                        {formatNumber(r.netPos)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-900">
                        {vwap == null ? (
                          <span className={muted} title="Posición neta plana">—</span>
                        ) : (
                          formatMoney(vwap)
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Precio promedio = Σ(precio × posición) / Σ(posición). Equivale al costo base /
            break-even de la posición neta abierta. Si la posición neta es cero se muestra —.
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
