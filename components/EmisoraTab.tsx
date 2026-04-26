"use client";

import { useMemo, useState } from "react";
import { Position } from "@/lib/types";
import {
  groupPositions,
  allInstrumentsKey,
  sortGroups,
  SortKey,
} from "@/lib/groups";
import GroupedInstrumentTab, {
  tickerColumn,
  tipoColumn,
  strikeColumn,
  vencColumn,
} from "./GroupedInstrumentTab";

/**
 * Pestaña "Por emisora": lista plana de TODOS los instrumentos
 * (equity + futuros + opciones + forwards) agrupados por instrumento único,
 * con un selector de orden arriba.
 */

interface Props {
  positions: Position[];
  onDelete: (id: string) => void;
}

const SORT_OPTIONS: { key: SortKey; label: string; tooltip: string }[] = [
  { key: "nocional",   label: "Mayor nocional",      tooltip: "|Nocional| descendente" },
  { key: "ticker",     label: "Alfabético",          tooltip: "Ticker A→Z" },
  { key: "antiguedad", label: "Más antigua primero", tooltip: "Por fecha del primer trade" },
];

export default function EmisoraTab({ positions, onDelete }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("nocional");

  const groups = useMemo(() => {
    const all = groupPositions(positions, allInstrumentsKey);
    return sortGroups(all, sortKey);
  }, [positions, sortKey]);

  return (
    <div className="grid gap-4">
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

      <GroupedInstrumentTab
        groups={groups}
        identityColumns={[tickerColumn, tipoColumn, strikeColumn, vencColumn]}
        qtyHeader="Neto"
        priceHeader="Precio promedio"
        showNocional
        onDelete={onDelete}
        emptyMessage="Aún no hay posiciones capturadas."
      />
    </div>
  );
}
