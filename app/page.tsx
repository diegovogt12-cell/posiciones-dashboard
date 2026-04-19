"use client";

import { useEffect, useState } from "react";
import PositionForm from "@/components/PositionForm";
import PositionsTable from "@/components/PositionsTable";
import Totales from "@/components/Totales";
import { loadPositions, savePositions } from "@/lib/storage";
import { Position } from "@/lib/types";

type Tab = "posiciones" | "totales";

export default function Home() {
  const [tab, setTab] = useState<Tab>("posiciones");
  const [positions, setPositions] = useState<Position[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setPositions(loadPositions());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) savePositions(positions);
  }, [positions, hydrated]);

  const addPosition = (p: Position) => setPositions((prev) => [p, ...prev]);
  const deletePosition = (id: string) => setPositions((prev) => prev.filter((p) => p.id !== id));

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard de Posiciones</h1>
          <p className="text-slate-500 text-sm">Equity · Opciones · Futuros · Forwards</p>
        </div>
        <div className="text-xs text-slate-500">
          {positions.length} posición{positions.length === 1 ? "" : "es"}
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

      {tab === "posiciones" && (
        <div className="grid gap-6">
          <PositionForm onAdd={addPosition} />
          <PositionsTable positions={positions} onDelete={deletePosition} />
        </div>
      )}

      {tab === "totales" && <Totales positions={positions} />}
    </main>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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
