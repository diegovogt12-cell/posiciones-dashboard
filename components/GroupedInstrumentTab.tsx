"use client";

import { ReactNode, useState } from "react";
import {
  CONTRACT_MULTIPLIER,
  INSTRUMENT_LABELS,
  InstrumentType,
  Position,
  formatVencimiento,
  notional,
  notionalExposure,
} from "@/lib/types";
import { InstrumentGroup, groupNocional } from "@/lib/groups";
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

/**
 * Modo del desglose al expandir una fila:
 *   - "trades": muestra todos los trades históricos del instrumento (con
 *     botón eliminar individual). Útil cuando cada trade es relevante por
 *     sí mismo, p. ej. en opciones donde cada apertura tiene su prima.
 *   - "lots": muestra solo los lotes vivos del FIFO (la posición que
 *     queda viva después del neteo de compras/ventas). Útil para equity,
 *     futuros y forwards donde sí hay neteo significativo.
 */
export type DrilldownMode = "trades" | "lots";

interface Props {
  groups: InstrumentGroup[];
  identityColumns: IdentityColumn[];
  qtyHeader: string;       // p. ej. "Neto títulos" / "Neto contratos"
  priceHeader: string;     // p. ej. "Precio promedio" / "Prima promedio"
  showExposure?: boolean;  // pestaña Opciones: agrega columna strike × netQty × 100
  showNocional?: boolean;  // pestaña Por emisora: nocional unificado (opciones por strike, otros por PEPS)
  drilldown?: DrilldownMode; // default "trades"
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
  showNocional = false,
  drilldown = "trades",
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

  // Total de columnas para colSpan del drill-down (toggle + identity + qty + precio + exposure? + nocional?)
  const colCount =
    1 + identityColumns.length + 2 + (showExposure ? 1 : 0) + (showNocional ? 1 : 0);

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
            {showNocional && (
              <th
                className="text-right px-4 py-3"
                title="Opciones: strike × neto × 100. Otros: precio promedio PEPS × neto × multiplicador."
              >
                Nocional
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
              showNocional={showNocional}
              drilldown={drilldown}
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
  showNocional,
  drilldown,
  onDelete,
  colCount,
}: {
  group: InstrumentGroup;
  open: boolean;
  onToggle: () => void;
  identityColumns: IdentityColumn[];
  showExposure: boolean;
  showNocional: boolean;
  drilldown: DrilldownMode;
  onDelete: (id: string) => void;
  colCount: number;
}) {
  const exposure = showExposure
    ? group.trades.reduce((s, t) => s + (notionalExposure(t) ?? 0), 0)
    : null;
  const nocional = showNocional ? groupNocional(group) : null;

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
        {showNocional && (
          <td className={`px-4 py-3 text-right font-mono ${nocional! >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {nocional === 0 ? <span className={muted}>—</span> : formatMoney(nocional ?? 0)}
          </td>
        )}
      </tr>
      {open && (
        <tr className={rowBase}>
          <td></td>
          <td colSpan={colCount - 1} className="px-4 py-3 bg-slate-50/60">
            <DrilldownContent group={group} mode={drilldown} onDelete={onDelete} />
          </td>
        </tr>
      )}
    </>
  );
}

/**
 * Contenido del desglose de un grupo. Reusable entre tabs y EmisoraTab.
 *
 * - mode="trades": lista cronológica de TODOS los trades, con eliminar.
 * - mode="lots":   solo los lotes vivos del FIFO (la posición que sobrevive
 *   después del neteo). Sin botón eliminar — para modificar una posición
 *   neteada, ve al tab "Posiciones".
 */
export function DrilldownContent({
  group,
  mode,
  onDelete,
}: {
  group: InstrumentGroup;
  mode: DrilldownMode;
  onDelete: (id: string) => void;
}) {
  return mode === "lots" ? (
    <LiveLotsView group={group} />
  ) : (
    <TradesView group={group} onDelete={onDelete} />
  );
}

function TradesView({
  group,
  onDelete,
}: {
  group: InstrumentGroup;
  onDelete: (id: string) => void;
}) {
  const trades = group.trades;
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

function LiveLotsView({ group }: { group: InstrumentGroup }) {
  const lots = group.liveLots;
  const mult = CONTRACT_MULTIPLIER[group.tipo];
  return (
    <>
      <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">
        {lots.length} lote{lots.length === 1 ? "" : "s"} vivo{lots.length === 1 ? "" : "s"}
        <span className="ml-2 normal-case text-slate-400">
          (PEPS — primeras entradas, primeras salidas{mult !== 1 ? `; multiplicador ×${mult}` : ""})
        </span>
      </div>
      {lots.length === 0 ? (
        <div className="text-xs text-slate-500">Posición plana — sin lotes vivos.</div>
      ) : (
        <table className="w-full text-xs">
          <thead className="text-slate-500">
            <tr>
              <th className="text-left font-medium px-2 py-1">Fecha lote</th>
              <th className="text-right font-medium px-2 py-1">Cantidad viva</th>
              <th className="text-right font-medium px-2 py-1">Precio</th>
              <th className="text-right font-medium px-2 py-1">Nocional</th>
            </tr>
          </thead>
          <tbody>
            {lots.map((l, i) => {
              const noc = l.qty * l.precio * mult;
              return (
                <tr key={`${l.positionId}-${i}`} className="border-t border-slate-200">
                  <td className="px-2 py-1 font-mono text-slate-700">{l.fecha}</td>
                  <td className={`px-2 py-1 text-right font-mono ${tone(l.qty)}`}>
                    {l.qty >= 0 ? "+" : ""}{formatNumber(l.qty)}
                  </td>
                  <td className="px-2 py-1 text-right font-mono text-slate-700">
                    {formatMoney(l.precio)}
                  </td>
                  <td className={`px-2 py-1 text-right font-mono ${tone(noc)}`}>
                    {formatMoney(noc)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
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

// Badge de tipo para los 5 instrumentos (usado en el tab "Por emisora").
const TIPO_STYLES: Record<InstrumentType, string> = {
  equity:  "bg-slate-100 text-slate-700",
  futuro:  "bg-sky-50 text-sky-700",
  call:    "bg-emerald-50 text-emerald-700",
  put:     "bg-rose-50 text-rose-700",
  forward: "bg-amber-50 text-amber-700",
};

export const tipoColumn: IdentityColumn = {
  header: "Tipo",
  render: (g) => (
    <span
      className={`text-xs font-semibold uppercase px-2 py-0.5 rounded ${TIPO_STYLES[g.tipo]}`}
    >
      {INSTRUMENT_LABELS[g.tipo]}
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
