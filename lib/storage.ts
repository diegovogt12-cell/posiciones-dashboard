import { Position } from "./types";

const KEY = "posiciones:v1";

export function loadPositions(): Position[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Position[]) : [];
  } catch {
    return [];
  }
}

export function savePositions(positions: Position[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(positions));
}
