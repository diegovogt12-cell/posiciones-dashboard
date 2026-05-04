"use client";

import { useState } from "react";
import { parsePricesCSV, uploadPrices } from "@/lib/prices";

interface Props {
  onUploaded?: () => void;
}

/**
 * Componente de upload del CSV de precios.
 * - Acepta archivo .csv
 * - Parsea cliente-side (no toca el server hasta confirmar)
 * - Muestra preview de filas válidas + lista de errores con línea
 * - Bulk insert/upsert al confirmar
 */
export default function PriceUploader({ onUploaded }: Props) {
  const [parseResult, setParseResult] = useState<ReturnType<typeof parsePricesCSV> | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setUploadMsg(null);
    setFileName(file.name);
    const text = await file.text();
    const result = parsePricesCSV(text);
    setParseResult(result);
  };

  const handleConfirm = async () => {
    if (!parseResult || parseResult.rows.length === 0) return;
    setUploading(true);
    setUploadMsg(null);
    try {
      const res = await uploadPrices(parseResult.rows);
      setUploadMsg(`✓ ${res.inserted} precios cargados/actualizados.`);
      setParseResult(null);
      setFileName(null);
      onUploaded?.();
    } catch (e) {
      setUploadMsg(`Error al subir: ${e instanceof Error ? e.message : "desconocido"}`);
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setParseResult(null);
    setFileName(null);
    setUploadMsg(null);
  };

  const fechasUnicas = parseResult
    ? Array.from(new Set(parseResult.rows.map((r) => r.fecha))).sort()
    : [];

  return (
    <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-sm">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Subir vector de precios</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            CSV con columnas: <code className="font-mono">fecha,tipo,ticker,strike,venc_mes,venc_anio,venc_fecha,precio</code>
          </p>
        </div>

        {!parseResult && (
          <label className="inline-flex items-center gap-2 cursor-pointer bg-monex text-white text-sm font-medium rounded px-4 py-2 hover:bg-monexHover transition">
            <span>Elegir CSV</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = ""; // reset
              }}
            />
          </label>
        )}
      </div>

      {uploadMsg && (
        <div className={`mt-3 text-sm ${uploadMsg.startsWith("✓") ? "text-emerald-600" : "text-rose-600"}`}>
          {uploadMsg}
        </div>
      )}

      {parseResult && (
        <div className="mt-4 grid gap-3">
          <div className="text-xs text-slate-600 flex flex-wrap items-center gap-3">
            <span className="font-medium text-slate-900">{fileName}</span>
            <span>
              {parseResult.rows.length} fila{parseResult.rows.length === 1 ? "" : "s"} válida
              {parseResult.rows.length === 1 ? "" : "s"}
            </span>
            {parseResult.errors.length > 0 && (
              <span className="text-rose-600">
                {parseResult.errors.length} error{parseResult.errors.length === 1 ? "" : "es"}
              </span>
            )}
            {fechasUnicas.length > 0 && (
              <span className="text-slate-500">
                Fechas: {fechasUnicas.length === 1 ? fechasUnicas[0] : `${fechasUnicas[0]} … ${fechasUnicas[fechasUnicas.length - 1]} (${fechasUnicas.length})`}
              </span>
            )}
          </div>

          {parseResult.errors.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded p-3 text-xs">
              <div className="text-rose-700 font-medium mb-1">Errores (estas filas no se subirán)</div>
              <ul className="space-y-0.5 text-rose-600 max-h-32 overflow-y-auto">
                {parseResult.errors.slice(0, 50).map((e, i) => (
                  <li key={i}>
                    Línea {e.line}: {e.message}
                  </li>
                ))}
                {parseResult.errors.length > 50 && (
                  <li className="text-slate-500">… y {parseResult.errors.length - 50} más</li>
                )}
              </ul>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              disabled={uploading || parseResult.rows.length === 0}
              className="bg-monex text-white text-sm font-medium rounded px-4 py-2 hover:bg-monexHover transition disabled:opacity-50"
            >
              {uploading ? "Subiendo…" : `Confirmar y subir ${parseResult.rows.length} precios`}
            </button>
            <button
              onClick={handleCancel}
              disabled={uploading}
              className="bg-slate-100 text-slate-700 text-sm font-medium rounded px-4 py-2 hover:bg-slate-200 transition disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
