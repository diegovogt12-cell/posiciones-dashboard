# Dashboard de Posiciones

Dashboard en Next.js para llevar posiciones abiertas de equity, opciones (calls / puts), futuros y forwards. Pensado para reemplazar el Excel actual.

## Campos por posición

- **Fecha** de la posición
- **Tipo**: equity, call, put, futuro, forward
- **Ticker / subyacente** (emisora si es equity, subyacente si es derivado)
- **Posición**: número de títulos o contratos (+ largo, − corto)
- **Precio** unitario del título / contrato

El **nocional** se calcula automáticamente (precio × posición) y preserva el signo de la posición.

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
