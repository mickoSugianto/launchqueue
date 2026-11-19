# LaunchQueue

[![LaunchQueue CI/CD Pipeline](https://github.com/mickoSugianto/launchqueue/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/mickoSugianto/launchqueue/actions/workflows/ci.yml)
![Next.js 16.2.4](https://img.shields.io/badge/Next.js-16.2.4-000000?logo=nextdotjs&logoColor=white)
![React 19.2.4](https://img.shields.io/badge/React-19.2.4-149ECA?logo=react&logoColor=white)
![TypeScript 5](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![MSW 2](https://img.shields.io/badge/MSW-2.13.4-FF6A33)

**Live Demo:** [launchqueue.vercel.app](https://launchqueue.vercel.app/)

A high-concurrency flash-drop and pre-order simulation engine built with Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, SWR, React Hook Form + Zod, Radix UI / shadcn/ui, and Mock Service Worker (MSW v2). All `/api/*` endpoints run entirely in the browser via MSW—no external backend, database, or `.env` configuration is required.

## Engineering Highlights

- **MSW Bootstrapping Gatekeeper (`MSWProvider`):** Blocks child route rendering until `public/mockServiceWorker.js` (`v2.13.5`) is active (with retry UI on failure), preventing mount-time `useSWR` requests from bypassing interception.
- **Concurrency & Anti-Scalp Locking:** Live `5s` SWR drop polling triggers the Chaos Simulator (`0–3` units drained per poll once live); `POST /api/checkout/lock` enforces stock checks (`409 SOLD_OUT`), launch time (`403 DROP_NOT_ACTIVE`), and a `maxPurchase: 1` active unpaid hold per campaign (`409 MAX_PURCHASE_EXCEEDED`, excluding `debug_123`).
- **Idempotent Timeout Sweeper & Stock Reclamation:** 15-minute `AWAITING_PAYMENT` checkout windows (`CheckoutTimer` + lazy `sweepExpiredOrders` / `expireOrderIfNeeded`) persist `EXPIRED` and restore inventory once, while keeping paid and fulfilled receipts accessible indefinitely.
- **Validated Checkout & MSW Handler-Side Totals:** React Hook Form + Zod (`onTouched`, trimmed fields, phone/postal regex, dynamic city sync from `/api/shipping-rates` for `Jakarta`, `Bandung`, `Surabaya`, `Bali`, and `Medan`) paired with MSW handler-side IDR fee/total recalculation and duplicate-submit guards (`409 ORDER_ALREADY_COMPLETED`).
- **Optimistic Admin Kanban & Cross-Tab Sync:** The 4-column `/admin` board and `PATCH /api/admin/orders/:id` share `ORDER_STATUS_FLOW`, using instant SWR `mutate()` updates with `toast.error()` rollback and `3s` cross-tab sync to `/receipt/[sessionId]` via `localStorage["dbOrders"]`.

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Framework & UI** | Next.js `16.2.4` (App Router, `Inter` via `next/font/google`), React `19.2.4`, TypeScript `^5` |
| **Styling & Components** | Tailwind CSS `^4`, `shadcn` `^4.4.0`, `radix-ui` `^1.4.3`, `lucide-react` `^1.9.0`, `sonner` `^2.0.7` |
| **Data, Forms & Validation** | SWR `^2.4.1`, React Hook Form `^7.74.0`, `@hookform/resolvers` `^5.2.2`, Zod `^4.4.1` |
| **API Simulation** | Mock Service Worker (`msw` `^2.13.4`, worker `2.13.5`) |
| **Testing & Linting** | Jest `^30.4.2`, React Testing Library `^16.3.2`, ESLint `^9` |

## Getting Started

**Prerequisites:** `Node.js 20.9+` (Next.js `16.2.4` requires `node >= 20.9.0`; CI runs on Node `20`) and `npm`.

```bash
git clone https://github.com/mickoSugianto/launchqueue.git
cd launchqueue
npm ci        # or npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Start editing the homepage at `src/app/page.tsx`.

## Routes & Interactive Demo Walkthrough

| Route | Purpose |
| :--- | :--- |
| `/` | Active campaign catalog (`src/app/page.tsx`) with `"Open Admin Board"` link in footer |
| `/[brand]/[slug]` | Drop countdown, live stock polling, and variant lock (e.g. `/kith/knicks-hoodie`, `/fear-of-god/relaxed-fear-of-good-tee`) |
| `/checkout/[sessionId]` | 15-minute locked checkout session with city-based IDR shipping & fee calculation |
| `/receipt/[sessionId]` | Live pre-order fulfillment tracker (seeded order available at `/receipt/debug_123`) |
| `/admin` | 4-column seller fulfillment Kanban board with optimistic status transitions |

**Quick Demo Flow:**
1. Visit `/` and wait ~15 seconds from initial tab load/reload for seeded drops to go live (or reload `/kith/knicks-hoodie` to watch the 15-second countdown cleanly).
2. Select a colorway and size, click **Buy Now** to lock 1 unit for 15 minutes at `/checkout/[sessionId]`, and submit shipping details.
3. Click **Open Admin Board** in the `/` footer (or open `/admin` in a second tab) to advance orders across columns and watch `/receipt/[sessionId]` (or `/receipt/debug_123`) update within `3s`.

**Simulation & Persistence Notes:** Campaign inventory is held per tab in `globalThis.dbCampaigns` and resets cleanly on reload (`12` units/variant, `dropDate = now + 15s` on MSW module load), while orders persist across reloads and browser tabs via `localStorage["dbOrders"]`. Once a drop is live, the Chaos Simulator randomly drains `0–3` units per `5s` poll to simulate concurrent buyers.

## Scripts, Testing & CI

| Script | Command | Purpose |
| :--- | :--- | :--- |
| `dev` | `npm run dev` | Start Next.js development server |
| `build` | `npm run build` | Build production bundle |
| `start` | `npm run start` | Serve production build locally |
| `lint` | `npm run lint` | Run ESLint (`eslint-config-next`) |
| `typecheck` | `npm run typecheck` | Clean `.next/dev/types`, run `next typegen && tsc --noEmit` |
| `test` | `npm run test` | Run Jest & React Testing Library (`7` suites, `38` tests in `__tests__/`) |
| `test:watch` | `npm run test:watch` | Run Jest in watch mode |

Automated checks run via [`.github/workflows/ci.yml`](.github/workflows/ci.yml) on pushes and pull requests to `main` (`npm ci` → `lint` → `typecheck` → `test` → `build`).

## Project Structure & Architecture

```text
src/
├── app/                      # App Router pages (/, /[brand]/[slug], /checkout/[sessionId], /receipt/[sessionId], /admin)
├── components/               # UI primitives, DropCountdown, checkout form/timer/summary, MSWProvider
├── lib/                      # SWR polling hooks, ORDER_STATUS_FLOW & city constants, brand/UI utils
├── mocks/                    # Seed catalog/shipping data (data.ts), browser worker, MSW handlers (handlers.ts)
└── types/                    # Domain TypeScript types & interfaces (Campaign, Order, OrderStatus, ShippingRates)
__tests__/                    # 7 Jest/RTL test suites (38 tests) covering pages, timers, and MSW handlers
public/
├── mockServiceWorker.js      # Generated MSW v2.13.5 Service Worker
└── images/                   # Local product and size-guide imagery
.github/
└── workflows/
    └── ci.yml                # GitHub Actions CI pipeline (lint, typecheck, test, build)
```

For Mermaid architecture diagrams, state-transition matrices, and the full 8-endpoint mock API contract, see [`SYSTEM_DESIGN.md`](SYSTEM_DESIGN.md).

## Live Demo & Deployment

- **Live Deployment:** [https://launchqueue.vercel.app/](https://launchqueue.vercel.app/)
- **Local Production Run:** `npm run build && npm run start` runs without environment variables.
- **Service Worker Requirement:** `public/mockServiceWorker.js` requires a secure context—serve over **HTTPS** (e.g., Vercel) or **`localhost`**.
