import { Position } from "./types";

const KEY_V1 = "posiciones:v1"; // legacy: guardaba { nocional }
const KEY_V2 = "posiciones:v2"; // actual: guarda { precio }

interface LegacyPosition {
  id: string;
  fecha: string;
  tipo: Position["tipo"];
  ticker: string;
  posicion: number;
  nocional: number;
}

function migrateFromV1(legacy: LegacyPosition[]): Position[] {
  return legacy.map((l) => ({
    id: l.id,
    fecha: l.fecha,
    tipo: l.tipo,
    ticker: l.ticker,
    posicion: l.posicion,
    // Derivar precio del nocional anterior: nocional = precio * posicion.
    // Usa |posicion| para preservar magnitud; si posicion=0, precio=0.
    precio: l.posicion !== 0 ? Math.abs(l.nocional / l.posicion) : 0,
  }));
}

export function loadPositions(): Position[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY_V2);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as Position[]) : [];
    }
    // Migración desde v1 si existe
    const legacyRaw = window.localStorage.getItem(KEY_V1);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw);
      if (Array.isArray(legacy)) {
        const migrated = migrateFromV1(legacy as LegacyPosition[]);
        window.localStorage.setItem(KEY_V2, JSON.stringify(migrated));
        return migrated;
      }
    }
    return [];
  } catch {
    return [];
  }
}

export function savePositions(positions: Position[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY_V2, JSON.stringify(positions));
}
