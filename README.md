# Dashboard de Posiciones

Dashboard en Next.js para llevar posiciones abiertas de equity, opciones (calls / puts), futuros y forwards. Pensado para reemplazar el Excel actual.

## Campos por posición

- **Fecha** de la posición
- **Tipo**: equity, call, put, futuro, forward
- **Ticker / subyacente** (emisora si es equity, subyacente si es derivado)
- **Strike** (solo opciones): precio de ejercicio
- **Vencimiento**:
  - **Opciones y futuros**: ciclo trimestral MAR / JUN / SEP / DIC + año
  - **Forwards**: fecha libre (OTC)
- **Posición**: número de títulos o contratos (+ largo, − corto)
- **Precio** (prima por acción en opciones; precio unitario en equity/futuros/forwards)

### Cálculo de nocional

```
nocional (prima) = precio × posición × multiplicador
```

con multiplicador **100** para derivados listados (futuro, call, put) y **1** para equity y forward. El signo de la posición se preserva (largo + / corto −).

Para **opciones** además se calcula la **exposición al subyacente**:

```
exposición = strike × posición × multiplicador
```

Ambas métricas se muestran por posición y agregadas en la pestaña Totales.

## Pestañas

- **Posiciones**: captura y listado de posiciones abiertas.
- **Totales**: totales globales, desglose por tipo de instrumento y por ticker.

Los datos se persisten en `localStorage` del navegador (no hay backend). Si más adelante quieres multi-usuario o histórico, conviene migrar a Vercel Postgres o Vercel KV.

## Correr en local

```bash
npm install
npm run dev
```

Abre http://localhost:3000.

## Deploy a Vercel

1. Sube el repo a GitHub (o GitLab/Bitbucket).
2. En https://vercel.com importa el repo. Vercel detecta Next.js automáticamente.
3. Deploy. No requiere variables de entorno.

Alternativa con CLI:

```bash
npm install -g vercel
vercel        # preview
vercel --prod # producción
```
