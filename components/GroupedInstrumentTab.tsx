"use client";

import { ReactNode, useState } from "react";
import {
  CONTRACT_MULTIPLIER,
  Position,
  formatVencimiento,
  notional,
  notionalExposure,
} from "@/lib/types";
import { InstrumentGroup } from "@/lib/groups";
import { formatMoney, formatNumber } from "@/lib/format";

/**
 * Vista de un tab de instrumento: una fila por instrumento único con su
 * posición neta + precio promedio PEPS, expandible para ver los trades
 * que la componen.
 *
 * Las columnas que identifican el instrumento varían por tipo y se pasan
 * como `identityColumns`. Las métricas (qty, precio, exposure opcional) son
 * comunes y las renderiza este componente.
 */

export interface IdentityColumn {
  header: string;
  render: (g: InstrumentGroup) => ReactNode;
  align?: "left" | "right";
  title?: string;
}

interface Props {
  groups: InstrumentGroup[];
  identityColumns: IdentityColumn[];
  qtyHeader: string;       // p. ej. "Neto títulos" / "Neto contratos"
  priceHeader: string;     // p. ej. "Precio promedio" / "Prima promedio"
  showExposure?: boolean;  // solo opciones
  onDelete: (id: string) => void;
  emptyMessage: string;
}

const panel = "bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm";
const thead = "bg-slate-50 text-slate-600 uppercase text-xs tracking-wider";
const rowBase = "border-t border-slate-200";
const muted = "text-slate-400";
const tone = (n: number) => (n >= 0 ? "text-emerald-600" : "text-rose-600");

export default function GroupedInstrumentTab({
  groups,
  identityColumns,
  qtyHeader,
  priceHeader,
  showExposure = false,
  onDelete,
  emptyMessage,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (k: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  if (groups.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-500 shadow-sm">
        {emptyMessage}
      </div>
    );
  }

  // Total de columnas para colSpan del drill-down (toggle + identity + qty + precio + exposure?)
  const colCount = 1 + identityColumns.length + 2 + (showExposure ? 1 : 0);

  return (
    <div className={panel}>
      <table className="w-full text-sm">
        <thead className={thead}>
          <tr>
            <th className="w-10 px-4 py-3"></th>
            {identityColumns.map((c, i) => (
              <th
                key={i}
                className={`px-4 py-3 ${c.align === "right" ? "text-right" : "text-left"}`}
                title={c.title}
              >
                {c.header}
              </th>
            ))}
            <th className="text-right px-4 py-3">{qtyHeader}</th>
            <th className="text-right px-4 py-3" title="Costo promedio PEPS sobre los lotes vivos">
              {priceHeader}
            </th>
            {showExposure && (
              <th
                className="text-right px-4 py-3"
                title="Strike × contratos × 100 (suma sobre los trades del grupo)"
              >
                Exposición (strike)
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <GroupRow
              key={g.key}
              group={g}
              open={expanded.has(g.key)}
              onToggle={() => toggle(g.key)}
              identityColumns={identityColumns}
              showExposure={showExposure}
              onDelete={onDelete}
              colCount={colCount}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------- Subcomponentes ----------------

function GroupRow({
  group,
  open,
  onToggle,
  identityColumns,
  showExposure,
  onDelete,
  colCount,
}: {
  group: InstrumentGroup;
  open: boolean;
  onToggle: () => void;
  identityColumns: IdentityColumn[];
  showExposure: boolean;
  onDelete: (id: string) => void;
  colCount: number;
}) {
  const exposure = showExposure
    ? group.trades.reduce((s, t) => s + (notionalExposure(t) ?? 0), 0)
    : null;

  return (
    <>
      <tr className={`${rowBase} cursor-pointer hover:bg-slate-50`} onClick={onToggle}>
        <td className="w-10 px-4 py-3 text-slate-400">{open ? "▾" : "▸"}</td>
        {identityColumns.map((c, i) => (
          <td
            key={i}
            className={`px-4 py-3 ${c.align === "right" ? "text-right font-mono" : ""}`}
          >
            {c.render(group)}
          </td>
        ))}
        <td className={`px-4 py-3 text-right font-mono ${tone(group.netQty)}`}>
          {formatNumber(group.netQty)}
        </td>
        <td className="px-4 py-3 text-right font-mono text-slate-900">
          {group.avgPrice == null ? (
            <span className={muted} title="Posición plana">—</span>
          ) : (
            formatMoney(group.avgPrice)
          )}
        </td>
        {showExposure && (
          <td className={`px-4 py-3 text-right font-mono ${exposure! >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {formatMoney(exposure ?? 0)}
          </td>
        )}
      </tr>
      {open && (
        <tr className={rowBase}>
          <td></td>
          <td colSpan={colCount - 1} className="px-4 py-3 bg-slate-50/60">
            <TradesDrilldown trades={group.trades} group={group} onDelete={onDelete} />
          </td>
        </tr>
      )}
    </>
  );
}

function TradesDrilldown({
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
      <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">
        {trades.length} trade{trades.length === 1 ? "" : "s"} en este instrumento
        {mult !== 1 && (
          <span className="ml-2 normal-case text-slate-400">
            (multiplicador ×{mult})
          </span>
        )}
      </div>
      <table className="w-full text-xs">
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
            const noc = notional(t);
            return (
              <tr key={t.id} className="border-t border-slate-200">
                <td className="px-2 py-1 font-mono text-slate-700">{t.fecha}</td>
                <td className={`px-2 py-1 text-right font-mono ${tone(t.posicion)}`}>
                  {t.posicion >= 0 ? "+" : ""}{formatNumber(t.posicion)}
                </td>
                <td className="px-2 py-1 text-right font-mono text-slate-700">
                  {formatMoney(t.precio)}
                </td>
                <td className={`px-2 py-1 text-right font-mono ${tone(noc)}`}>
                  {formatMoney(noc)}
                </td>
                <td className="px-2 py-1 text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(t.id);
                    }}
                    className="text-slate-400 hover:text-rose-600 text-[11px]"
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

// ---------------- Helpers para renderizar columnas comunes ----------------

export const tickerColumn: IdentityColumn = {
  header: "Ticker",
  render: (g) => <span className="font-mono text-slate-900">{g.ticker}</span>,
};

export const tipoOpcionColumn: IdentityColumn = {
  header: "Tipo",
  render: (g) => (
    <span
      className={`text-xs font-semibold uppercase px-2 py-0.5 rounded ${
        g.tipo === "call"
          ? "bg-emerald-50 text-emerald-700"
          : "bg-rose-50 text-rose-700"
      }`}
    >
      {g.tipo}
    </span>
  ),
};

export const strikeColumn: IdentityColumn = {
  header: "Strike",
  align: "right",
  render: (g) => (g.strike != null ? formatMoney(g.strike) : <span className="text-slate-400">—</span>),
};

export const vencColumn: IdentityColumn = {
  header: "Venc.",
  render: (g) => {
    const v = formatVencimiento({
      ticker: g.ticker,
      tipo: g.tipo,
      vencMes: g.vencMes,
      vencAnio: g.vencAnio,
      vencFecha: g.vencFecha,
    } as Position);
    return v ? <span className="font-mono text-slate-700">{v}</span> : <span className="text-slate-400">—</span>;
  },
};
