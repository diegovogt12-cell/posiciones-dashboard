"use client";

import { useMemo, useState } from "react";
import {
  CONTRACT_MULTIPLIER,
  INSTRUMENT_LABELS,
  InstrumentType,
  Position,
  formatVencimiento,
  notional,
} from "@/lib/types";
import {
  InstrumentGroup,
  allInstrumentsKey,
  filterLiveGroups,
  groupNocional,
  groupOldestTradeDate,
  groupPositions,
} from "@/lib/groups";
import { formatMoney, formatNumber } from "@/lib/format";

/**
 * Pestaña "Por emisora": una fila por emisora (ticker). Al expandir,
 * muestra todos los instrumentos de esa emisora (equity + futuros +
 * opciones + forwards). Cada instrumento, a su vez, se puede expandir
 * para ver sus trades individuales (con eliminar).
 *
 * Tres niveles de jerarquía:
 *   Emisora  ──▸  Instrumento  ──▸  Trade
 */

interface Props {
  positions: Position[];
  onDelete: (id: string) => void;
}

type SortKey = "nocional" | "ticker" | "antiguedad";

interface Emisora {
  ticker: string;
  instrumentos: InstrumentGroup[];
  // Σ |nocional_i| — métrica de tamaño total expuesto.
  nocionalBruto: number;
  // Σ nocional_i (con signo) — exposición neta direccional.
  nocionalNeto: number;
  // Fecha del trade más antiguo entre todos los instrumentos.
  oldestTrade: string;
  totalTrades: number;
}

const SORT_OPTIONS: { key: SortKey; label: string; tooltip: string }[] = [
  { key: "nocional",   label: "Mayor nocional",      tooltip: "Σ |nocional| de todos los instrumentos de la emisora, descendente" },
  { key: "ticker",     label: "Alfabético",          tooltip: "Ticker A→Z" },
  { key: "antiguedad", label: "Más antigua primero", tooltip: "Por fecha del trade más antiguo de la emisora" },
];

const TIPO_ORDER: Record<InstrumentType, number> = {
  equity: 0, futuro: 1, call: 2, put: 3, forward: 4,
};

const TIPO_STYLES: Record<InstrumentType, string> = {
  equity:  "bg-slate-100 text-slate-700",
  futuro:  "bg-sky-50 text-sky-700",
  call:    "bg-emerald-50 text-emerald-700",
  put:     "bg-rose-50 text-rose-700",
  forward: "bg-amber-50 text-amber-700",
};

function compareInstruments(a: InstrumentGroup, b: InstrumentGroup): number {
  if (a.tipo !== b.tipo) return TIPO_ORDER[a.tipo] - TIPO_ORDER[b.tipo];
  const aV = a.vencFecha ?? `${a.vencAnio ?? ""}-${a.vencMes ?? ""}`;
  const bV = b.vencFecha ?? `${b.vencAnio ?? ""}-${b.vencMes ?? ""}`;
  if (aV !== bV) return aV.localeCompare(bV);
  return (a.strike ?? 0) - (b.strike ?? 0);
}

function buildEmisoras(positions: Position[]): Emisora[] {
  // Solo grupos vivos: descarta posiciones neteadas y derivados vencidos.
  // Si una emisora se queda sin instrumentos vivos, naturalmente no aparece.
  const allGroups = filterLiveGroups(groupPositions(positions, allInstrumentsKey));
  const byTicker = new Map<string, InstrumentGroup[]>();
  for (const g of allGroups) {
    const arr = byTicker.get(g.ticker);
    if (arr) arr.push(g);
    else byTicker.set(g.ticker, [g]);
  }
  const result: Emisora[] = [];
  for (const [ticker, instrumentos] of byTicker) {
    instrumentos.sort(compareInstruments);
    let nocionalBruto = 0;
    let nocionalNeto = 0;
    let totalTrades = 0;
    let oldestTrade = "9999-12-31";
    for (const g of instrumentos) {
      const noc = groupNocional(g);
      nocionalBruto += Math.abs(noc);
      nocionalNeto += noc;
      totalTrades += g.trades.length;
      const od = groupOldestTradeDate(g);
      if (od < oldestTrade) oldestTrade = od;
    }
    result.push({ ticker, instrumentos, nocionalBruto, nocionalNeto, oldestTrade, totalTrades });
  }
  return result;
}

function sortEmisoras(emisoras: Emisora[], key: SortKey): Emisora[] {
  const arr = [...emisoras];
  switch (key) {
    case "nocional":
      arr.sort((a, b) => b.nocionalBruto - a.nocionalBruto || a.ticker.localeCompare(b.ticker));
      break;
    case "ticker":
      arr.sort((a, b) => a.ticker.localeCompare(b.ticker));
      break;
    case "antiguedad":
      arr.sort((a, b) => a.oldestTrade.localeCompare(b.oldestTrade) || a.ticker.localeCompare(b.ticker));
      break;
  }
  return arr;
}

const tone = (n: number) => (n >= 0 ? "text-emerald-600" : "text-rose-600");

// ============================================================
// Componente principal
// ============================================================

export default function EmisoraTab({ positions, onDelete }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("nocional");
  const [openEmisoras, setOpenEmisoras] = useState<Set<string>>(new Set());
  const [openInstruments, setOpenInstruments] = useState<Set<string>>(new Set());

  const emisoras = useMemo(
    () => sortEmisoras(buildEmisoras(positions), sortKey),
    [positions, sortKey],
  );

  const toggleEmisora = (k: string) =>
    setOpenEmisoras((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const toggleInstrument = (k: string) =>
    setOpenInstruments((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  return (
    <div className="grid gap-4">
      {/* Selector de orden */}
      <div className="flex items-center gap-3 text-sm flex-wrap">
        <span className="text-slate-500 uppercase text-xs tracking-wider">
          Ordenar por:
        </span>
        <div className="flex gap-1">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSortKey(opt.key)}
              title={opt.tooltip}
              className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                sortKey === opt.key
                  ? "bg-monex text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {emisoras.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-500 shadow-sm">
          Aún no hay posiciones capturadas.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 uppercase text-xs tracking-wider">
              <tr>
                <th className="w-10 px-4 py-3"></th>
                <th className="text-left px-4 py-3">Emisora</th>
                <th className="text-right px-4 py-3">Instrumentos</th>
                <th className="text-right px-4 py-3">Trades</th>
                <th className="text-right px-4 py-3" title="Σ |nocional| de todos los instrumentos de la emisora">
                  Nocional bruto
                </th>
                <th className="text-right px-4 py-3" title="Σ nocional con signo (longs y shorts se compensan)">
                  Nocional neto
                </th>
              </tr>
            </thead>
            <tbody>
              {emisoras.map((e) => (
                <EmisoraRow
                  key={e.ticker}
                  emisora={e}
                  open={openEmisoras.has(e.ticker)}
                  onToggle={() => toggleEmisora(e.ticker)}
                  openInstruments={openInstruments}
                  onToggleInstrument={toggleInstrument}
                  onDelete={onDelete}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Subcomponentes
// ============================================================

function EmisoraRow({
  emisora,
  open,
  onToggle,
  openInstruments,
  onToggleInstrument,
  onDelete,
}: {
  emisora: Emisora;
  open: boolean;
  onToggle: () => void;
  openInstruments: Set<string>;
  onToggleInstrument: (k: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <>
      <tr
        className="border-t border-slate-200 cursor-pointer hover:bg-slate-50"
        onClick={onToggle}
      >
        <td className="w-10 px-4 py-3 text-slate-400">{open ? "▾" : "▸"}</td>
        <td className="px-4 py-3 font-mono text-slate-900 font-semibold">{emisora.ticker}</td>
        <td className="px-4 py-3 text-right font-mono text-slate-700">
          {formatNumber(emisora.instrumentos.length)}
        </td>
        <td className="px-4 py-3 text-right font-mono text-slate-700">
          {formatNumber(emisora.totalTrades)}
        </td>
        <td className="px-4 py-3 text-right font-mono text-slate-900">
          {formatMoney(emisora.nocionalBruto)}
        </td>
        <td className={`px-4 py-3 text-right font-mono ${tone(emisora.nocionalNeto)}`}>
          {formatMoney(emisora.nocionalNeto)}
        </td>
      </tr>
      {open && (
        <tr className="border-t border-slate-200">
          <td></td>
          <td colSpan={5} className="px-4 pt-2 pb-4 bg-slate-50/60">
            <InstrumentsTable
              instrumentos={emisora.instrumentos}
              openInstruments={openInstruments}
              onToggleInstrument={onToggleInstrument}
              onDelete={onDelete}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function InstrumentsTable({
  instrumentos,
  openInstruments,
  onToggleInstrument,
  onDelete,
}: {
  instrumentos: InstrumentGroup[];
  openInstruments: Set<string>;
  onToggleInstrument: (k: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded">
      <table className="w-full text-xs">
        <thead className="text-slate-500 uppercase tracking-wider">
          <tr>
            <th className="w-8 px-3 py-2"></th>
            <th className="text-left px-3 py-2">Tipo</th>
            <th className="text-right px-3 py-2">Strike</th>
            <th className="text-left px-3 py-2">Venc.</th>
            <th className="text-right px-3 py-2">Neto</th>
            <th className="text-right px-3 py-2" title="Costo promedio PEPS">
              Precio prom.
            </th>
            <th className="text-right px-3 py-2" title="Opciones: strike × neto × 100. Otros: PEPS × neto × multiplicador.">
              Nocional
            </th>
          </tr>
        </thead>
        <tbody>
          {instrumentos.map((g) => (
            <InstrumentRow
              key={g.key}
              group={g}
              open={openInstruments.has(g.key)}
              onToggle={() => onToggleInstrument(g.key)}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InstrumentRow({
  group,
  open,
  onToggle,
  onDelete,
}: {
  group: InstrumentGroup;
  open: boolean;
  onToggle: () => void;
  onDelete: (id: string) => void;
}) {
  const noc = groupNocional(group);
  const venc = formatVencimiento({
    ticker: group.ticker,
    tipo: group.tipo,
    vencMes: group.vencMes,
    vencAnio: group.vencAnio,
    vencFecha: group.vencFecha,
  } as Position);
  return (
    <>
      <tr
        className="border-t border-slate-200 cursor-pointer hover:bg-slate-50"
        onClick={onToggle}
      >
        <td className="w-8 px-3 py-2 text-slate-400">{open ? "▾" : "▸"}</td>
        <td className="px-3 py-2">
          <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${TIPO_STYLES[group.tipo]}`}>
            {INSTRUMENT_LABELS[group.tipo]}
          </span>
        </td>
        <td className="px-3 py-2 text-right font-mono text-slate-700">
          {group.strike != null ? formatMoney(group.strike) : <span className="text-slate-400">—</span>}
        </td>
        <td className="px-3 py-2 font-mono text-slate-700">
          {venc ?? <span className="text-slate-400">—</span>}
        </td>
        <td className={`px-3 py-2 text-right font-mono ${tone(group.netQty)}`}>
          {formatNumber(group.netQty)}
        </td>
        <td className="px-3 py-2 text-right font-mono text-slate-900">
          {group.avgPrice != null ? formatMoney(group.avgPrice) : <span className="text-slate-400">—</span>}
        </td>
        <td className={`px-3 py-2 text-right font-mono ${noc === 0 ? "text-slate-400" : tone(noc)}`}>
          {noc === 0 ? "—" : formatMoney(noc)}
        </td>
      </tr>
      {open && (
        <tr className="border-t border-slate-200">
          <td></td>
          <td colSpan={6} className="px-3 py-2 bg-slate-50/60">
            <TradesList trades={group.trades} group={group} onDelete={onDelete} />
          </td>
        </tr>
      )}
    </>
  );
}

function TradesList({
  trades,
  group,
  onDelete,
}: {
  trades: Position[];
  group: InstrumentGroup;
  onDelete: (id: string) => void;
}) {
  const isOption = group.tipo === "call" || group.tipo === "put";
  const mult = CONTRACT_MULTIPLIER[group.tipo];
  return (
    <>
      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
        {trades.length} trade{trades.length === 1 ? "" : "s"}
        {mult !== 1 && (
          <span className="ml-2 normal-case text-slate-400">multiplicador ×{mult}</span>
        )}
      </div>
      <table className="w-full text-[11px]">
        <thead className="text-slate-500">
          <tr>
            <th className="text-left font-medium px-2 py-1">Fecha</th>
            <th className="text-right font-medium px-2 py-1">Posición</th>
            <th className="text-right font-medium px-2 py-1">{isOption ? "Prima" : "Precio"}</th>
            <th className="text-right font-medium px-2 py-1">Nocional</th>
            <th className="px-2 py-1"></th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => {
            const tnoc = notional(t);
            return (
              <tr key={t.id} className="border-t border-slate-200">
                <td className="px-2 py-1 font-mono text-slate-700">{t.fecha}</td>
                <td className={`px-2 py-1 text-right font-mono ${tone(t.posicion)}`}>
                  {t.posicion >= 0 ? "+" : ""}{formatNumber(t.posicion)}
                </td>
                <td className="px-2 py-1 text-right font-mono text-slate-700">
                  {formatMoney(t.precio)}
                </td>
                <td className={`px-2 py-1 text-right font-mono ${tone(tnoc)}`}>
                  {formatMoney(tnoc)}
                </td>
                <td className="px-2 py-1 text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(t.id);
                    }}
                    className="text-slate-400 hover:text-rose-600 text-[10px]"
                    aria-label="Eliminar trade"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
