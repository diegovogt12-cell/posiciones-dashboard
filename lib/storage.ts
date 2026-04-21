import { Position } from "./types";

/**
 * Cliente de persistencia contra /api/positions.
 *
 * Antes: guardaba todo en localStorage (single-user).
 * Ahora: lee/escribe en Supabase vía Route Handlers — todas las sesiones
 * autenticadas del equipo DVV ven el mismo conjunto de posiciones.
 */

export async function fetchPositions(): Promise<Position[]> {
  const res = await fetch("/api/positions", { cache: "no-store" });
  if (!res.ok) {
    if (res.status === 401) {
      // Sesión expirada — el middleware eventualmente redirige a /login.
      return [];
    }
    throw new Error(`GET /api/positions ${res.status}`);
  }
  const { positions } = await res.json();
  return positions as Position[];
}

export async function createPosition(p: Omit<Position, "id">): Promise<Position> {
  const res = await fetch("/api/positions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(p),
  });
  if (!res.ok) throw new Error(`POST /api/positions ${res.status}`);
  const { position } = await res.json();
  return position as Position;
}

export async function deletePosition(id: string): Promise<void> {
  const res = await fetch(`/api/positions/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`DELETE /api/positions/${id} ${res.status}`);
}
