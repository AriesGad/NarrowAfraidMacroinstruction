# Base44 Setup Notes

## What this project is

A pnpm monorepo (lockfile v9, Node 22+) whose main user-facing app is **aries-tunnel** — an Expo SDK 57 React Native VPN-tunnel client UI that also runs on web (`expo start --web`).

## Key facts

- The aries-tunnel app is **entirely client-side**: state lives in AsyncStorage / expo-secure-store; data comes from built-in catalogs (`data/serverCatalog.ts`, `data/tweakCatalog.ts`). It does NOT call the api-server.
- The **api-server** (Express 5, port 5000) and **lib/db** (Drizzle/Postgres) are scaffolding — the DB schema is empty (`export {}`) and the API only exposes `/api/healthz`. They are not needed to render the app.
- No external secrets are required to boot the app.
- The **mockup-sandbox** package is an internal Vite component-preview tool, not the main app.

## How to run

```
docker compose -f docker-compose.base44.yml up -d
```

The web service installs pnpm, runs `pnpm install --frozen-lockfile` at the workspace root, then starts `expo start --web --port 3000` from `artifacts/aries-tunnel`.

First load is slow — Metro bundles on the first request (30–60 s). Wait for it.

## Verifying

```bash
curl -sf -H "Host: external-preview.example.com" http://localhost:3000/
```

Should return the Expo web HTML shell. The JS bundle is served from the same port via relative URLs, so the preview's external hostname works.

## Gotchas

- `pnpm-workspace.yaml` sets `minimumReleaseAge: 1440` (supply-chain defense). With `--frozen-lockfile` this is not triggered.
- The root `preinstall` script deletes `package-lock.json` / `yarn.lock` and requires pnpm (not npm/yarn).
- Expo native modules (expo-secure-store, expo-network, expo-keep-awake) are imported at the top level in `AppStateContext.tsx`; on web these resolve to no-op shims.
