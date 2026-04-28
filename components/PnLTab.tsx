"use client";

import { useMemo, useState } from "react";
import {
  CONTRACT_MULTIPLIER,
  INSTRUMENT_LABELS,
  InstrumentType,
  Position,
  formatVencimiento,
} from "@/lib/types";
import {
  buildPnLReport,
  TickerPnL,
  InstrumentPnL,
  matchInCurrentMonth,
  matchToday,
} from "@/lib/pnl";
import { ClosedMatch } from "@/lib/fifo";
import { formatMoney, formatNumber } from "@/lib/format";

/**
 * Pestaña "P&L": muestra el P&L realizado a partir de los matches FIFO
 * de equity, futuros y forwards (las opciones se omiten).
 *
 * El FIFO se corre sobre la historia completa — el filtro de período
 * solo descarta matches cuya fecha de cierre cae fuera del rango.
 *
 *   - period="month": cierres del mes calendario en curso
 *   - period="day":   cierres ocurridos hoy
 *
 * Layout: cards arriba (total + por tipo), tabla por emisora con
 * drill-down jerárquico a instrumento → matches individuales.
 */

interface Props {
  positions: Position[];
  period: "month" | "day";
}

function periodHeader(period: "month" | "day"): string {
  const d = new Date();
  if (period === "month") {
    const s = d.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  const s = d.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const TIPO_STYLES: Record<InstrumentType, string> = {
  equity:  "bg-slate-100 text-slate-700",
  futuro:  "bg-sky-50 text-sky-700",
  call:    "bg-emerald-50 text-emerald-700",
  put:     "bg-rose-50 text-rose-700",
  forward: "bg-amber-50 text-amber-700",
};

const tone = (n: number) => (n >= 0 ? "text-emerald-600" : "text-rose-600");

export default function PnLTab({ positions, period }: Props) {
  const report = useMemo(() => {
    const filter = period === "month" ? matchInCurrentMonth : matchToday;
    return buildPnLReport(positions, filter);
  }, [positions, period]);

  const [openTickers, setOpenTickers] = useState<Set<string>>(new Set());

  const toggle = (k: string) =>
    setOpenTickers((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const hasData = report.byTicker.length > 0;
  const header = periodHeader(period);
  const emptyMessage =
    period === "month"
      ? `Aún no hubo neteos en ${header.toLowerCase()}.`
      : `No hubo neteos hoy (${header}).`;
  const totalLabel = period === "month" ? "P&L del mes" : "P&L del día";

  return (
    <div className="grid gap-6">
      {/* Encabezado del período */}
      <div className="flex items-baseline gap-3">
        <span className="text-xs uppercase tracking-wider text-slate-500">Período:</span>
        <span className="text-sm font-medium text-slate-900">{header}</span>
      </div>

      {/* Resumen */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card label={totalLabel}  value={formatMoney(report.total)}        emphasis={report.total >= 0 ? "pos" : "neg"} />
        <Card label="Equity"      value={formatMoney(report.byTipo.equity)}  emphasis={report.byTipo.equity >= 0 ? "pos" : "neg"} />
        <Card label="Futuros"     value={formatMoney(report.byTipo.futuro)}  emphasis={report.byTipo.futuro >= 0 ? "pos" : "neg"} />
        <Card label="Forwards"    value={formatMoney(report.byTipo.forward)} emphasis={report.byTipo.forward >= 0 ? "pos" : "neg"} />
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-wider text-slate-600 mb-3">
          P&L por emisora ({report.totalCierres} {report.totalCierres === 1 ? "cierre" : "cierres"})
        </h2>

        {!hasData ? (
          <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-500 shadow-sm">
            {emptyMessage}
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 uppercase text-xs tracking-wider">
                <tr>
                  <th className="w-10 px-4 py-3"></th>
                  <th className="text-left px-4 py-3">Emisora</th>
                  <th className="text-left px-4 py-3">Tipos</th>
                  <th className="text-right px-4 py-3">Cierres</th>
                  <th className="text-right px-4 py-3">Cantidad cerrada</th>
                  <th className="text-right px-4 py-3">P&L realizado</th>
                </tr>
              </thead>
              <tbody>
                {report.byTicker.map((tk) => (
                  <TickerRow
                    key={tk.ticker}
                    ticker={tk}
                    open={openTickers.has(tk.ticker)}
                    onToggle={() => toggle(tk.ticker)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

// ============================================================
// Subcomponentes
// ============================================================

function Card({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: "pos" | "neg";
}) {
  const t = emphasis === "pos" ? "text-emerald-600" : emphasis === "neg" ? "text-rose-600" : "text-slate-900";
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-xl font-mono mt-1 ${t}`}>{value}</div>
    </div>
  );
}

function TickerRow({
  ticker,
  open,
  onToggle,
}: {
  ticker: TickerPnL;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="border-t border-slate-200 cursor-pointer hover:bg-slate-50" onClick={onToggle}>
        <td className="w-10 px-4 py-3 text-slate-400">{open ? "▾" : "▸"}</td>
        <td className="px-4 py-3 font-mono text-slate-900 font-semibold">{ticker.ticker}</td>
        <td className="px-4 py-3">
          <div className="flex gap-1 flex-wrap">
            {ticker.tipos.map((t) => (
              <span key={t} className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${TIPO_STYLES[t]}`}>
                {INSTRUMENT_LABELS[t]}
              </span>
            ))}
          </div>
        </td>
        <td className="px-4 py-3 text-right font-mono text-slate-700">{formatNumber(ticker.totalCierres)}</td>
        <td className="px-4 py-3 text-right font-mono text-slate-700">{formatNumber(ticker.totalQty)}</td>
        <td className={`px-4 py-3 text-right font-mono font-semibold ${tone(ticker.totalPnL)}`}>
          {formatMoney(ticker.totalPnL)}
        </td>
      </tr>
      {open && (
        <tr className="border-t border-slate-200">
          <td></td>
          <td colSpan={5} className="px-4 pt-2 pb-4 bg-slate-50/60">
            <InstrumentsBreakdown instruments={ticker.instruments} />
          </td>
        </tr>
      )}
    </>
  );
}

function InstrumentsBreakdown({ instruments }: { instruments: InstrumentPnL[] }) {
  return (
    <div className="grid gap-3">
      {instruments.map((ins, i) => (
        <InstrumentBlock key={`${ins.ticker}-${ins.tipo}-${i}`} instrument={ins} />
      ))}
    </div>
  );
}

function InstrumentBlock({ instrument }: { instrument: InstrumentPnL }) {
  const venc = formatVencimiento({
    ticker: instrument.ticker,
    tipo: instrument.tipo,
    vencMes: instrument.vencMes,
    vencAnio: instrument.vencAnio,
    vencFecha: instrument.vencFecha,
  } as Position);
  const mult = CONTRACT_MULTIPLIER[instrument.tipo];

  return (
    <div className="bg-white border border-slate-200 rounded">
      <div className="flex items-center gap-3 px-3 py-2 border-b border-slate-200 text-xs">
        <span className={`font-semibold uppercase px-1.5 py-0.5 rounded ${TIPO_STYLES[instrument.tipo]}`}>
          {INSTRUMENT_LABELS[instrument.tipo]}
        </span>
        {venc && <span className="font-mono text-slate-700">{venc}</span>}
        <span className="text-slate-400">
          {instrument.matches.length} cierre{instrument.matches.length === 1 ? "" : "s"}
          {mult !== 1 && <span> · multiplicador ×{mult}</span>}
        </span>
        <span className={`ml-auto font-mono font-semibold ${tone(instrument.totalPnL)}`}>
          {formatMoney(instrument.totalPnL)}
        </span>
      </div>
      <table className="w-full text-xs">
        <thead className="text-slate-500">
          <tr>
            <th className="text-left font-medium px-3 py-1.5">Apertura</th>
            <th className="text-left font-medium px-3 py-1.5">Cierre</th>
            <th className="text-right font-medium px-3 py-1.5">Lado</th>
            <th className="text-right font-medium px-3 py-1.5">Cantidad</th>
            <th className="text-right font-medium px-3 py-1.5">Precio apertura</th>
            <th className="text-right font-medium px-3 py-1.5">Precio cierre</th>
            <th className="text-right font-medium px-3 py-1.5">P&L</th>
          </tr>
        </thead>
        <tbody>
          {instrument.matches.map((m, i) => (
            <MatchRow key={i} match={m} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MatchRow({ match }: { match: ClosedMatch }) {
  return (
    <tr className="border-t border-slate-200">
      <td className="px-3 py-1.5 font-mono text-slate-700">{match.openFecha}</td>
      <td className="px-3 py-1.5 font-mono text-slate-700">{match.closeFecha}</td>
      <td className="px-3 py-1.5 text-right">
        <span
          className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
            match.longLot ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
          }`}
        >
          {match.longLot ? "Long" : "Short"}
        </span>
      </td>
      <td className="px-3 py-1.5 text-right font-mono text-slate-700">{formatNumber(match.qty)}</td>
      <td className="px-3 py-1.5 text-right font-mono text-slate-700">{formatMoney(match.openPrice)}</td>
      <td className="px-3 py-1.5 text-right font-mono text-slate-700">{formatMoney(match.closePrice)}</td>
      <td className={`px-3 py-1.5 text-right font-mono font-semibold ${tone(match.pnl)}`}>
        {formatMoney(match.pnl)}
      </td>
    </tr>
  );
}
