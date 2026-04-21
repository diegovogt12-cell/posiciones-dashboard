"use client";

import { useEffect, useState } from "react";
import PositionForm from "@/components/PositionForm";
import PositionsTable from "@/components/PositionsTable";
import Totales from "@/components/Totales";
import { fetchPositions, createPosition, deletePosition } from "@/lib/storage";
import { Position } from "@/lib/types";

type Tab = "posiciones" | "totales";

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
    setPositions((ps) => ps.filter((p) => p.id !== id)); // optimista
    try {
      await deletePosition(id);
    } catch (e) {
      setPositions(prev); // revert
      setError(e instanceof Error ? e.message : "Error al eliminar");
    }
  };

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

      <nav className="flex gap-1 border-b border-slate-200 mb-6">
        <TabButton active={tab === "posiciones"} onClick={() => setTab("posiciones")}>
          Posiciones
        </TabButton>
        <TabButton active={tab === "totales"} onClick={() => setTab("totales")}>
          Totales
        </TabButton>
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
          {tab === "totales" && <Totales positions={positions} />}
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
      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
        active
          ? "border-monex text-monex"
          : "border-transparent text-slate-500 hover:text-slate-800"
      }`}
    >
      {children}
    </button>
  );
}
