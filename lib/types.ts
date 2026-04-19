export type InstrumentType = "equity" | "call" | "put" | "futuro" | "forward";

export interface Position {
  id: string;
  fecha: string;          // ISO date yyyy-mm-dd
  tipo: InstrumentType;
  ticker: string;         // emisora o subyacente
  posicion: number;       // + largo, - corto (títulos o contratos)
  precio: number;         // precio / prima unitaria del título o contrato
  strike?: number;        // precio de ejercicio (solo para call / put)
}

export const isOption = (t: InstrumentType): boolean => t === "call" || t === "put";

// Nocional derivado: preserva el signo de la posición (largo + / corto -).
export const notional = (p: Position): number => p.precio * p.posicion;

export const INSTRUMENT_LABELS: Record<InstrumentType, string> = {
  equity: "Equity",
  call: "Call",
  put: "Put",
  futuro: "Futuro",
  forward: "Forward",
};

export const INSTRUMENT_OPTIONS: InstrumentType[] = [
  "equity",
  "call",
  "put",
  "futuro",
  "forward",
];
