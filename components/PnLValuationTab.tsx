"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CONTRACT_MULTIPLIER,
  INSTRUMENT_LABELS,
  InstrumentType,
  Position,
  formatVencimiento,
} from "@/lib/types";
import { fetchPriceDates, fetchPricesForDate, Price } from "@/lib/prices";
import { buildValuationReport, InstrumentValuation, TickerValuation } from "@/lib/valuation";
import { formatMoney, formatNumber } from "@/lib/format";
import PriceUploader from "./PriceUploader";

/**
 * Pestaña "P&L Valuación":
 *   - Selector de fecha (de las que tienen precios cargados)
 *   - Cards arriba: total + realizado + no realizado + faltantes
 *   - Tabla por emisora con drill-down a instrumentos
 *   - Sección de upload del CSV de precios
 *
 * El cálculo MTM corre client-side: jala los precios de la fecha
 * seleccionada y los cruza con las posiciones vivas a esa fecha.
 */

interface Props {
  positions: Position[];
}

const TIPO_STYLES: Record<InstrumentType, string> = {
  equity:  "bg-slate-100 text-slate-700",
  futuro:  "bg-sky-50 text-sky-700",
  call:    "bg-emerald-50 text-emerald-700",
  put:     "bg-rose-50 text-rose-700",
  forward: "bg-amber-50 text-amber-700",
};

const tone = (n: number | null) =>
  n == null ? "text-slate-400" : n >= 0 ? "text-emerald-600" : "text-rose-600";

export default function PnLValuationTab({ positions }: Props) {
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [prices, setPrices] = useState<Price[]>([]);
  const [loadingDates, setLoadingDates] = useState(true);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [openTickers, setOpenTickers] = useState<Set<string>>(new Set());

  // Carga inicial de fechas disponibles
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ds = await fetchPriceDates();
        if (cancelled) return;
        setDates(ds);
        setSelectedDate(ds[0] ?? null);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoadingDates(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Carga de precios cuando cambia la fecha seleccionada
  useEffect(() => {
    if (!selectedDate) { setPrices([]); return; }
    let cancelled = false;
    setLoadingPrices(true);
    (async () => {
      try {
        const ps = await fetchPricesForDate(selectedDate);
        if (!cancelled) setPrices(ps);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoadingPrices(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedDate]);

  const report = useMemo(
    () => (selectedDate ? buildValuationReport(positions, prices, selectedDate) : null),
    [positions, prices, selectedDate],
  );

  const handleUploaded = async () => {
    // Recarga la lista de fechas (puede haber una nueva) y los precios.
    try {
      const ds = await fetchPriceDates();
      setDates(ds);
      // Si la fecha actual sigue, re-fetch precios; si no, salta a la primera.
      if (ds[0] && (!selectedDate || !ds.includes(selectedDate))) {
        setSelectedDate(ds[0]);
      } else if (selectedDate) {
        const ps = await fetchPricesForDate(selectedDate);
        setPrices(ps);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const toggleTicker = (k: string) =>
    setOpenTickers((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  return (
    <div className="grid gap-6">
      <PriceUploader onUploaded={handleUploaded} />

      {err && (
        <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded px-3 py-2">
          {err}
        </div>
      )}

      {loadingDates ? (
        <div className="text-center text-slate-500 py-8">Cargando fechas…</div>
      ) : dates.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-500 shadow-sm">
          Aún no hay precios cargados. Sube un CSV para empezar a valuar.
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-xs uppercase tracking-wider text-slate-500">
              Fecha de valuación:
            </label>
            <select
              value={selectedDate ?? ""}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-white border border-slate-300 rounded px-3 py-1.5 text-sm font-mono text-slate-900 focus:outline-none focus:border-monex focus:ring-1 focus:ring-monex"
            >
              {dates.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            {loadingPrices && <span className="text-xs text-slate-500">cargando precios…</span>}
            <span className="text-xs text-slate-500 ml-2">{prices.length} precios para esta fecha</span>
          </div>

          {report && <ReportView report={report} openTickers={openTickers} onToggleTicker={toggleTicker} />}
        </>
      )}
    </div>
  );
}

// ============================================================
// Subcomponentes
// ============================================================

function ReportView({
  report,
  openTickers,
  onToggleTicker,
}: {
  report: ReturnType<typeof buildValuationReport>;
  openTickers: Set<string>;
  onToggleTicker: (k: string) => void;
}) {
  return (
    <>
      {/* Resumen */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card
          label="P&L total"
          value={report.total != null ? formatMoney(report.total) : "—"}
          emphasis={report.total == null ? "muted" : report.total >= 0 ? "pos" : "neg"}
          subtitle={report.total == null ? "Faltan precios" : undefined}
        />
        <Card
          label="P&L Realizado"
          value={formatMoney(report.realizedTotal)}
          emphasis={report.realizedTotal >= 0 ? "pos" : "neg"}
        />
        <Card
          label="P&L No Realizado (MTM)"
          value={report.unrealizedTotal != null ? formatMoney(report.unrealizedTotal) : "—"}
          emphasis={report.unrealizedTotal == null ? "muted" : report.unrealizedTotal >= 0 ? "pos" : "neg"}
        />
        <Card
          label="Sin precio"
          value={String(report.missingPrices.length)}
          emphasis={report.missingPrices.length > 0 ? "neg" : "muted"}
          subtitle={report.missingPrices.length > 0 ? "instrumentos abiertos" : undefined}
        />
      </section>

      {/* Lista de instrumentos sin precio */}
      {report.missingPrices.length > 0 && (
        <section className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="text-sm font-medium text-amber-900 mb-2">
            Faltan precios para los siguientes instrumentos abiertos al {report.asOfDate}:
          </div>
          <ul className="text-xs text-amber-800 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-0.5">
            {report.missingPrices.map((ins, i) => (
              <li key={i} className="font-mono">
                {ins.ticker} · {ins.tipo}
                {ins.strike != null && ` · K=${ins.strike}`}
                {ins.vencMes && ins.vencAnio && ` · ${ins.vencMes}${String(ins.vencAnio).slice(-2)}`}
                {ins.vencFecha && ` · ${ins.vencFecha}`}
              </li>
            ))}
          </ul>
          <p className="text-xs text-amber-700 mt-2">
            Sus celdas y el total general aparecen como "—" hasta que cargues los precios.
          </p>
        </section>
      )}

      {/* Tabla por ticker */}
      <section>
        <h2 className="text-sm uppercase tracking-wider text-slate-600 mb-3">
          P&L por emisora ({report.byTicker.length})
        </h2>

        {report.byTicker.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-500 shadow-sm">
            No hay posiciones que valuar al {report.asOfDate}.
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 uppercase text-xs tracking-wider">
                <tr>
                  <th className="w-10 px-4 py-3"></th>
                  <th className="text-left px-4 py-3">Emisora</th>
                  <th className="text-right px-4 py-3">Realizado</th>
                  <th className="text-right px-4 py-3">No realizado (MTM)</th>
                  <th className="text-right px-4 py-3">Total</th>
                </tr>
              </thead>
              <tbody>
                {report.byTicker.map((tk) => (
                  <TickerRow
                    key={tk.ticker}
                    ticker={tk}
                    open={openTickers.has(tk.ticker)}
                    onToggle={() => onToggleTicker(tk.ticker)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function Card({
  label,
  value,
  emphasis,
  subtitle,
}: {
  label: string;
  value: string;
  emphasis?: "pos" | "neg" | "muted";
  subtitle?: string;
}) {
  const t =
    emphasis === "pos" ? "text-emerald-600"
    : emphasis === "neg" ? "text-rose-600"
    : emphasis === "muted" ? "text-slate-400"
    : "text-slate-900";
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-xl font-mono mt-1 ${t}`}>{value}</div>
      {subtitle && <div className="text-[10px] text-slate-400 mt-0.5">{subtitle}</div>}
    </div>
  );
}

function TickerRow({
  ticker,
  open,
  onToggle,
}: {
  ticker: TickerValuation;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="border-t border-slate-200 cursor-pointer hover:bg-slate-50" onClick={onToggle}>
        <td className="w-10 px-4 py-3 text-slate-400">{open ? "▾" : "▸"}</td>
        <td className="px-4 py-3 font-mono text-slate-900 font-semibold">
          {ticker.ticker}
          {ticker.missingCount > 0 && (
            <span className="ml-2 text-[10px] font-normal uppercase bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">
              {ticker.missingCount} sin precio
            </span>
          )}
        </td>
        <td className={`px-4 py-3 text-right font-mono ${tone(ticker.realizedPnL)}`}>
          {formatMoney(ticker.realizedPnL)}
        </td>
        <td className={`px-4 py-3 text-right font-mono ${tone(ticker.unrealizedPnL)}`}>
          {ticker.unrealizedPnL != null ? formatMoney(ticker.unrealizedPnL) : "—"}
        </td>
        <td className={`px-4 py-3 text-right font-mono font-semibold ${tone(ticker.totalPnL)}`}>
          {ticker.totalPnL != null ? formatMoney(ticker.totalPnL) : "—"}
        </td>
      </tr>
      {open && (
        <tr className="border-t border-slate-200">
          <td></td>
          <td colSpan={4} className="px-4 pt-2 pb-4 bg-slate-50/60">
            <InstrumentsTable instruments={ticker.instruments} />
          </td>
        </tr>
      )}
    </>
  );
}

function InstrumentsTable({ instruments }: { instruments: InstrumentValuation[] }) {
  return (
    <div className="bg-white border border-slate-200 rounded">
      <table className="w-full text-xs">
        <thead className="text-slate-500 uppercase tracking-wider">
          <tr>
            <th className="text-left px-3 py-2">Tipo</th>
            <th className="text-right px-3 py-2">Strike</th>
            <th className="text-left px-3 py-2">Venc.</th>
            <th className="text-right px-3 py-2">Neto</th>
            <th className="text-right px-3 py-2">Costo PEPS</th>
            <th className="text-right px-3 py-2">Precio cierre</th>
            <th className="text-right px-3 py-2">Realizado</th>
            <th className="text-right px-3 py-2">MTM</th>
          </tr>
        </thead>
        <tbody>
          {instruments.map((ins, i) => (
            <InstrumentRow key={i} ins={ins} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InstrumentRow({ ins }: { ins: InstrumentValuation }) {
  const venc = formatVencimiento({
    ticker: ins.ticker,
    tipo: ins.tipo,
    vencMes: ins.vencMes,
    vencAnio: ins.vencAnio,
    vencFecha: ins.vencFecha,
  } as Position);
  const mult = CONTRACT_MULTIPLIER[ins.tipo];
  return (
    <tr className="border-t border-slate-200">
      <td className="px-3 py-2">
        <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${TIPO_STYLES[ins.tipo]}`}>
          {INSTRUMENT_LABELS[ins.tipo]}
        </span>
        {mult !== 1 && <span className="ml-2 text-slate-400">×{mult}</span>}
      </td>
      <td className="px-3 py-2 text-right font-mono text-slate-700">
        {ins.strike != null ? formatMoney(ins.strike) : <span className="text-slate-400">—</span>}
      </td>
      <td className="px-3 py-2 font-mono text-slate-700">
        {venc ?? <span className="text-slate-400">—</span>}
      </td>
      <td className={`px-3 py-2 text-right font-mono ${ins.netQty >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
        {ins.hasOpen ? formatNumber(ins.netQty) : <span className="text-slate-400">flat</span>}
      </td>
      <td className="px-3 py-2 text-right font-mono text-slate-700">
        {ins.avgCost != null ? formatMoney(ins.avgCost) : <span className="text-slate-400">—</span>}
      </td>
      <td className="px-3 py-2 text-right font-mono text-slate-700">
        {ins.closingPrice != null ? formatMoney(ins.closingPrice) : <span className="text-amber-600">faltante</span>}
      </td>
      <td className={`px-3 py-2 text-right font-mono ${tone(ins.realizedPnL)}`}>
        {formatMoney(ins.realizedPnL)}
      </td>
      <td className={`px-3 py-2 text-right font-mono ${tone(ins.unrealizedPnL)}`}>
        {ins.unrealizedPnL != null ? formatMoney(ins.unrealizedPnL) : "—"}
      </td>
    </tr>
  );
}
