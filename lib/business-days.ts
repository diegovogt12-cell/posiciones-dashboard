import type { ExpirationMonth } from "./types";

/**
 * Calendario de días hábiles BMV / MexDer.
 *
 * Hardcoded para 2026-2030. Si el dashboard sigue en uso después de 2030,
 * actualizar la lista con el calendario oficial publicado por la BMV
 * (https://www.bmv.com.mx/ → "Acerca de" → "Días no laborales").
 *
 * Incluye:
 *   - Feriados federales que cierran la BMV (Año Nuevo, Constitución,
 *     Juárez, Trabajo, Independencia, Revolución, Navidad)
 *   - Jueves Santo y Viernes Santo (varían cada año según Pascua)
 */

export const BMV_HOLIDAYS: ReadonlySet<string> = new Set([
  // 2026
  "2026-01-01", "2026-02-02", "2026-03-16", "2026-04-02", "2026-04-03",
  "2026-05-01", "2026-09-16", "2026-11-16", "2026-12-25",
  // 2027
  "2027-01-01", "2027-02-01", "2027-03-15", "2027-03-25", "2027-03-26",
  "2027-05-01", "2027-09-16", "2027-11-15", "2027-12-25",
  // 2028
  "2028-01-01", "2028-02-07", "2028-03-20", "2028-04-13", "2028-04-14",
  "2028-05-01", "2028-09-16", "2028-11-20", "2028-12-25",
  // 2029
  "2029-01-01", "2029-02-05", "2029-03-19", "2029-03-29", "2029-03-30",
  "2029-05-01", "2029-09-16", "2029-11-19", "2029-12-25",
  // 2030
  "2030-01-01", "2030-02-04", "2030-03-18", "2030-04-18", "2030-04-19",
  "2030-05-01", "2030-09-16", "2030-11-18", "2030-12-25",
]);

/** Devuelve "yyyy-mm-dd" en zona horaria local. */
function ymd(d: Date): string {
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * `true` si la fecha cae en lunes-viernes y NO está en la lista de feriados
 * BMV. Sábado, domingo, y feriados federales devuelven `false`.
 */
export function isBusinessDay(d: Date): boolean {
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return false; // domingo / sábado
  return !BMV_HOLIDAYS.has(ymd(d));
}

/**
 * Devuelve el día hábil **estrictamente anterior** a `d`.
 * Salta fines de semana y feriados BMV.
 *
 * Ejemplos:
 *   - lunes laboral → viernes laboral
 *   - sábado → viernes laboral
 *   - martes después de un lunes feriado → viernes anterior
 */
export function previousBusinessDay(d: Date): Date {
  const cursor = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  do {
    cursor.setDate(cursor.getDate() - 1);
  } while (!isBusinessDay(cursor));
  return cursor;
}

/** Devuelve "yyyy-mm-dd" del día hábil anterior a hoy. */
export function tMinus1ISO(): string {
  return ymd(previousBusinessDay(new Date()));
}

// ============================================================
// Vencimiento de derivados (futuros + opciones trimestrales)
// ============================================================

const QUARTERLY_MONTH_INDEX: Record<ExpirationMonth, number> = {
  MAR: 2,
  JUN: 5,
  SEP: 8,
  DIC: 11,
};

/**
 * Tercer viernes del mes de vencimiento — convención BMV / MexDer para
 * opciones (y la mayoría de futuros) trimestrales.
 *
 * Algoritmo: día 1 del mes → primer viernes = (5 − dayOfWeek + 7) % 7 días
 * después → tercer viernes = primer viernes + 14 días.
 *
 * Ejemplos verificables manualmente:
 *   MAR26 → 2026-03-20
 *   JUN26 → 2026-06-19
 *   SEP26 → 2026-09-18
 *   DIC26 → 2026-12-18
 */
export function quarterlyExpiryDate(vencMes: ExpirationMonth, vencAnio: number): Date {
  const monthIdx = QUARTERLY_MONTH_INDEX[vencMes];
  const first = new Date(vencAnio, monthIdx, 1);
  const dayOfWeek = first.getDay(); // 0=Dom, 5=Vie
  const firstFridayDay = 1 + ((5 - dayOfWeek + 7) % 7);
  return new Date(vencAnio, monthIdx, firstFridayDay + 14);
}

/** Versión ISO yyyy-mm-dd. */
export function quarterlyExpiryISO(vencMes: ExpirationMonth, vencAnio: number): string {
  return ymd(quarterlyExpiryDate(vencMes, vencAnio));
}
