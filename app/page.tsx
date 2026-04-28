"use client";

import { useEffect, useMemo, useState } from "react";
import PositionForm from "@/components/PositionForm";
import PositionsTable from "@/components/PositionsTable";
import GroupedInstrumentTab, {
  tickerColumn,
  tipoOpcionColumn,
  strikeColumn,
  vencColumn,
} from "@/components/GroupedInstrumentTab";
import EmisoraTab from "@/components/EmisoraTab";
import PnLTab from "@/components/PnLTab";
import { fetchPositions, createPosition, deletePosition } from "@/lib/storage";
import { Position } from "@/lib/types";
import {
  groupPositions,
  equityKey,
  futuroKey,
  opcionKey,
  forwardKey,
  compareGroups,
  filterLiveGroups,
} from "@/lib/groups";

type Tab =
  | "posiciones"
  | "equity"
  | "futuros"
  | "opciones"
  | "forwards"
  | "emisora"
  | "pnl_mes"
  | "pnl_dia";

const TAB_LABELS: Record<Tab, string> = {
  posiciones: "Posiciones",
  equity: "Equity",
  futuros: "Futuros",
  opciones: "Opciones",
  forwards: "Forwards",
  emisora: "Por emisora",
  pnl_mes: "P&L mes",
  pnl_dia: "P&L día",
};

const TAB_ORDER: Tab[] = [
  "posiciones",
  "equity",
  "futuros",
  "opciones",
  "forwards",
  "emisora",
  "pnl_mes",
  "pnl_dia",
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("posiciones");
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchPositions();
        if (!cancelled) setPositions(list);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error al cargar");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const addPosition = async (p: Omit<Position, "id">) => {
    try {
      const created = await createPosition(p);
      setPositions((prev) => [created, ...prev]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    }
  };

  const removePosition = async (id: string) => {
    const prev = positions;
    setPositions((ps) => ps.filter((p) => p.id !== id));
    try {
      await deletePosition(id);
    } catch (e) {
      setPositions(prev);
      setError(e instanceof Error ? e.message : "Error al eliminar");
    }
  };

  // Agrupaciones por tab. Filtramos posiciones neteadas (netQty=0) y
  // derivados vencidos antes de mostrarlas en las vistas agregadas.
  // useMemo para no recalcular en cada render.
  const equityGroups = useMemo(
    () =>
      filterLiveGroups(
        groupPositions(positions.filter((p) => p.tipo === "equity"), equityKey),
      ).sort(compareGroups),
    [positions],
  );
  const futurosGroups = useMemo(
    () =>
      filterLiveGroups(
        groupPositions(positions.filter((p) => p.tipo === "futuro"), futuroKey),
      ).sort(compareGroups),
    [positions],
  );
  const opcionesGroups = useMemo(
    () =>
      filterLiveGroups(
        groupPositions(
          positions.filter((p) => p.tipo === "call" || p.tipo === "put"),
          opcionKey,
        ),
      ).sort(compareGroups),
    [positions],
  );
  const forwardsGroups = useMemo(
    () =>
      filterLiveGroups(
        groupPositions(positions.filter((p) => p.tipo === "forward"), forwardKey),
      ).sort(compareGroups),
    [positions],
  );

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard de Posiciones</h1>
          <p className="text-slate-500 text-sm">Equity · Opciones · Futuros · Forwards</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span>
            {positions.length} posición{positions.length === 1 ? "" : "es"}
          </span>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="text-slate-500 hover:text-monex font-medium transition"
            >
              Salir
            </button>
          </form>
        </div>
      </header>

      <nav className="flex gap-1 border-b border-slate-200 mb-6 overflow-x-auto">
        {TAB_ORDER.map((t) => (
          <TabButton key={t} active={tab === t} onClick={() => setTab(t)}>
            {TAB_LABELS[t]}
          </TabButton>
        ))}
      </nav>

      {error && (
        <div className="mb-4 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center text-slate-500 py-12">Cargando…</div>
      ) : (
        <>
          {tab === "posiciones" && (
            <div className="grid gap-6">
              <PositionForm onAdd={addPosition} />
              <PositionsTable positions={positions} onDelete={removePosition} />
            </div>
          )}

          {tab === "equity" && (
            <GroupedInstrumentTab
              groups={equityGroups}
              identityColumns={[tickerColumn]}
              qtyHeader="Neto títulos"
              priceHeader="Precio promedio"
              drilldown="lots"
              onDelete={removePosition}
              emptyMessage="Aún no hay posiciones de equity."
            />
          )}

          {tab === "futuros" && (
            <GroupedInstrumentTab
              groups={futurosGroups}
              identityColumns={[tickerColumn, vencColumn]}
              qtyHeader="Neto contratos"
              priceHeader="Precio promedio"
              drilldown="lots"
              onDelete={removePosition}
              emptyMessage="Aún no hay posiciones en futuros."
            />
          )}

          {tab === "opciones" && (
            <GroupedInstrumentTab
              groups={opcionesGroups}
              identityColumns={[tickerColumn, tipoOpcionColumn, strikeColumn, vencColumn]}
              qtyHeader="Neto contratos"
              priceHeader="Prima promedio"
              showExposure
              onDelete={removePosition}
              emptyMessage="Aún no hay posiciones en opciones."
            />
          )}

          {tab === "forwards" && (
            <GroupedInstrumentTab
              groups={forwardsGroups}
              identityColumns={[tickerColumn, vencColumn]}
              qtyHeader="Neto títulos"
              priceHeader="Precio promedio"
              drilldown="lots"
              onDelete={removePosition}
              emptyMessage="Aún no hay posiciones en forwards."
            />
          )}

          {tab === "emisora" && (
            <EmisoraTab positions={positions} onDelete={removePosition} />
          )}

          {tab === "pnl_mes" && <PnLTab positions={positions} period="month" />}
          {tab === "pnl_dia" && <PnLTab positions={positions} period="day" />}
        </>
      )}
    </main>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition whitespace-nowrap ${
        active
          ? "border-monex text-monex"
          : "border-transparent text-slate-500 hover:text-slate-800"
      }`}
    >
      {children}
    </button>
  );
}
