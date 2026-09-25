# Wallet Tracker

PWA para seguimiento de activos (cripto, acciones, CEDEARs, bonos, ETFs). Backend en Supabase, deploy automático a GitHub Pages.

## Qué incluye

- Alta/edición de activos con **precio actual manual**
- Movimientos de compra/venta
- Cálculo de cantidad, costo promedio, valor de mercado y **P&L no realizado**
- Instalable como Progressive Web App
- Pipeline de GitHub Actions que buildéa y publica en Pages al pushear a `main`/`master`

## Setup local

1. Copiá el entorno:

```bash
cp .env.example .env.local
```

2. Completá las variables (proyecto Supabase `WalletTracker` ya creado):

```env
VITE_SUPABASE_URL=https://rzsordxmnwzqpdodreyz.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

3. Instalá y corré:

```bash
npm install
npm run dev
```

## Deploy a GitHub Pages

1. Creá el repo en GitHub y subí el código.
2. En el repo: **Settings → Pages → Source = GitHub Actions**.
3. Agregá estos secrets en **Settings → Secrets and variables → Actions**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Push a `main` (o `master`). El workflow `.github/workflows/deploy.yml` buildéa con `base` = `/nombre-del-repo/` y publica.

La URL queda en `https://<usuario>.github.io/<nombre-del-repo>/`.

## Uso sugerido

1. Creá un activo (ej. BTC, AAPL, GGAL).
2. Cargá el **precio actual** (lo actualizás vos a mano cuando quieras).
3. Registrá la compra inicial como movimiento tipo **Compra**.
4. Mirás el P&L del activo para decidir si vender.

## Seguridad

- Login con email/password (Supabase Auth).
- Las tablas solo son accesibles para usuarios autenticados.
- No hay registro público en la app: el usuario se crea desde el panel/admin.

El schema está en `supabase/schema.sql`.
