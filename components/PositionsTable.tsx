"use client";

import { INSTRUMENT_LABELS, Position, notional, notionalExposure, formatVencimiento } from "@/lib/types";
import { formatMoney, formatNumber } from "@/lib/format";

interface Props {
  positions: Position[];
  onDelete: (id: string) => void;
}

export default function PositionsTable({ positions, onDelete }: Props) {
  if (positions.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-500 shadow-sm">
        Aún no hay posiciones capturadas.
      </div>
    );
  }

  const sorted = [...positions].sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-600 uppercase text-xs tracking-wider">
          <tr>
            <th className="text-left px-4 py-3">Fecha</th>
            <th className="text-left px-4 py-3">Tipo</th>
            <th className="text-left px-4 py-3">Ticker</th>
            <th className="text-right px-4 py-3">Strike</th>
            <th className="text-left px-4 py-3">Venc.</th>
            <th className="text-right px-4 py-3">Posición</th>
            <th className="text-right px-4 py-3">Precio</th>
            <th className="text-right px-4 py-3" title="Prima × contratos × multiplicador">
              Nocional (prima)
            </th>
            <th className="text-right px-4 py-3" title="Strike × contratos × multiplicador — solo opciones">
              Exposición (strike)
            </th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => {
            const long = p.posicion >= 0;
            const noc = notional(p);
            const expo = notionalExposure(p);
            const venc = formatVencimiento(p);
            return (
              <tr key={p.id} className="border-t border-slate-200 hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-700">{p.fecha}</td>
                <td className="px-4 py-3 text-slate-700">{INSTRUMENT_LABELS[p.tipo]}</td>
                <td className="px-4 py-3 font-mono text-slate-900">{p.ticker}</td>
                <td className="px-4 py-3 text-right font-mono text-slate-700">
                  {p.strike != null ? formatMoney(p.strike) : <span className="text-slate-400">—</span>}
                </td>
                <td className="px-4 py-3 font-mono text-slate-700">
                  {venc ?? <span className="text-slate-400">—</span>}
                </td>
                <td className={`px-4 py-3 text-right font-mono ${long ? "text-emerald-600" : "text-rose-600"}`}>
                  {long ? "+" : ""}{formatNumber(p.posicion)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-slate-700">{formatMoney(p.precio)}</td>
                <td className={`px-4 py-3 text-right font-mono ${noc >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {formatMoney(noc)}
                </td>
                <td className={`px-4 py-3 text-right font-mono ${expo == null ? "" : expo >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {expo != null ? formatMoney(expo) : <span className="text-slate-400">—</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onDelete(p.id)}
                    className="text-slate-400 hover:text-rose-600 text-xs"
                    aria-label="Eliminar"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
