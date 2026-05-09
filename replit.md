# GuitarTune - Replit Agent Guide

## Overview

GuitarTune is a mobile guitar tuner application built with Expo (React Native). It uses the device microphone to detect pitch and helps users tune their guitar strings. The app features real-time frequency detection via autocorrelation, a visual tuner dial, string selection, and a premium tier system. The UI supports bilingual English/Spanish with auto-detection. It includes a backend Express server for API support and uses a PostgreSQL database with Drizzle ORM for user management.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

- **2026-05-09**: Added professional/multi-instrument support — Bass guitar (4-str, 5-str, Drop D, Drop A), Ukulele (Standard GCEA, Low-G, Baritone), 7-String guitar (Standard, Drop A). Added `instrument` field to `TuningConfig`. Extended `autoCorrelate` to 28Hz minimum for bass detection. Added `getInstrumentFreqRange()` and `scaleStringsToReference()` helpers.
- **2026-05-09**: Added Reference Pitch A4 selector — cycles through 432/434/436/438/440/442/444/446 Hz. Displayed as compact pill in main screen (glows cyan when non-standard). Affects `frequencyToNote`, `findClosestString`, and all frequency calculations. Critical for studio musicians and classical players.
- **2026-05-09**: TuningSelector now groups by instrument (Guitar → Bass → Ukulele sections) for clear multi-instrument navigation. Added instrument badge in main screen when non-guitar tuning is active.
- **2026-05-09**: Updated `ALL_TUNINGS` from 10 → 20 tunings. Updated landing page from "10 Guitar Tunings" → "20+ Instrument Tunings". Updated premium screen feature checklist to highlight Bass & Ukulele and Reference Pitch as pro features.
- **2026-02-13**: Added 3-tier pricing model: Monthly ($1.99/mo), Annual ($9.99/yr), Lifetime ($14.99 one-time) with full i18n support and backend webhook handling for lifetime purchases
- **2026-02-13**: Complete UI redesign to professional digital tuner aesthetic — dark theme (#0A0A0A) with cyan/teal accent (#4AEDC4), large semicircular dial meter (41 outer segments, 81 inner ticks, color-coded zones), LCD-style frequency/cents displays, big note character (72px), horizontal string selector with frequencies, vertical string visualization at bottom, compact mic button with tuning selector
- **2026-02-08**: Added bilingual i18n system (`lib/i18n.ts`) with 68+ translation keys, auto-detects device locale (English primary, Spanish secondary)
- **2026-02-08**: Translated all UI from Spanish to English as primary language
- **2026-02-08**: Added competitive price comparison table to premium screen (vs other tuner apps)
- **2026-02-08**: Redesigned landing page (`server/templates/landing-page.html`) with dark theme, competitive messaging, tuning showcase, and pricing
- **2026-02-08**: Added ASO description to `app.json` for US/Europe market targeting
- **2026-02-08**: Installed `expo-localization` for device locale detection

## System Architecture

### Frontend (Expo / React Native)

- **Framework**: Expo SDK 54 with expo-router for file-based routing
- **Navigation structure**: 
  - `app/index.tsx` — Main tuner screen (home)
  - `app/(auth)/` — Auth flow (login/register) presented as modal
  - `app/premium.tsx` — Premium upsell screen with competitive comparison
  - `app/_layout.tsx` — Root layout with Stack navigator
- **State management**: React Context for auth (`lib/auth-context.tsx`), React Query (`@tanstack/react-query`) for server state
- **Styling**: Dark theme only (light theme mirrors dark in `constants/colors.ts`), using `react-native-reanimated` for animations
- **Fonts**: DM Sans (loaded via `@expo-google-fonts/dm-sans`)
- **Key libraries**: `react-native-reanimated`, `react-native-gesture-handler`, `react-native-keyboard-controller`, `expo-haptics`, `expo-linear-gradient`, `expo-localization`

### Internationalization (`lib/i18n.ts`)

- Uses `expo-localization` `getLocales()` for device language detection
- Supports English (primary) and Spanish (secondary)
- 68+ translation keys covering tuner, premium, auth, and tuning selector UI
- Type-safe `t()` function with `TranslationKey` type
- Falls back to English for unsupported languages

### Tuner Engine (`lib/tuner-engine.ts`)

- Implements autocorrelation-based pitch detection (`autoCorrelate` function) with confidence validation
- Supports 10 guitar tunings: Standard + 3 free (Double Drop D, Open C, All Fourths) + 6 premium (Drop D, Open G, DADGAD, Open D, Open E, Drop C)
- `TuningConfig` interface defines each tuning with id, name, shortName, strings, isPremium, genre
- `FrequencyStabilizer` class provides noise filtering: median filter over 6 readings, rejects unstable/noisy frequencies, auto-clears after silence
- RMS threshold at 0.02 and autocorrelation confidence > 0.5 to reject ambient noise
- Provides `frequencyToNote`, `findClosestString`, `getCentsFromTarget`, and `getTuningStatus` utilities
- `findClosestString` accepts optional tuning parameter (defaults to STANDARD_TUNING)
- Haptic feedback (vibration) triggers when within ±5 cents of target frequency

### Pricing & Payment (LemonSqueezy + Solana Pay)

#### Solana Pay (Phantom wallet — crypto option)
- **Quarterly (3 months)**: 4.99 USDC or 0.035 SOL — gives 90 days access
- **Lifetime**: 14.99 USDC or 0.10 SOL — permanent access
- **Payment flow**: User selects plan (quarterly/lifetime) → picks token (USDC/SOL) → taps Phantom button → backend generates Solana Pay URL with unique reference key → app opens Phantom → user confirms → backend polls blockchain every 3s for up to 2 min → activates subscription
- **Endpoints**: `POST /api/checkout/solana/create` (body: `{userId, plan: quarterly|lifetime, token: usdc|sol}`) → `GET /api/checkout/solana/verify` (checks blockchain)
- **Required env var**: `SOLANA_WALLET_ADDRESS` — Phantom wallet address (`HUAiWhbJiX8WQTZJ8m139RYdDHjhq9pfSm5yH54xAfEt`)
- **Optional env vars**: `SOLANA_RPC_URL` (defaults to mainnet-beta), `SOLANA_QUARTERLY_SOL` (default 0.035), `SOLANA_LIFETIME_SOL` (default 0.10)
- **USDC mint** (Solana mainnet): `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- **SOL payments**: URL omits `spl-token` param — native SOL transfer
- **Frontend**: Purple (#9945FF) Phantom button + USDC/SOL token toggle visible for quarterly and lifetime plans
- **SDK note**: `@phantom/react-native-sdk` v1.0.7 (social login embedded wallet) requires native APK build — NOT compatible with Expo Go. For production APK: needs `PHANTOM_APP_ID` from phantom.com/portal

### Pricing & Payment (LemonSqueezy)
- Monthly: $1.99/month
- Annual: $9.99/year (58% savings)
- Lifetime: $14.99 one-time purchase (forever access)
- **Payment flow**: User selects plan (monthly/annual/lifetime) → app calls `/api/checkout/url` to get checkout URL with user_id → opens LemonSqueezy checkout in browser → webhook confirms payment → app polls `/api/subscription/status` to verify
- **Webhook endpoint**: `POST /api/webhooks/lemonsqueezy` — verifies HMAC-SHA256 signature, handles subscription_created, subscription_updated, subscription_cancelled, subscription_expired, subscription_paused, subscription_resumed, order_created (for lifetime) events
- **Environment variables needed**: `LEMONSQUEEZY_WEBHOOK_SECRET`, `LEMONSQUEEZY_CHECKOUT_URL_MONTHLY`, `LEMONSQUEEZY_CHECKOUT_URL_ANNUAL`, `LEMONSQUEEZY_CHECKOUT_URL_LIFETIME`, `LEMONSQUEEZY_VARIANT_ANNUAL`, `LEMONSQUEEZY_VARIANT_LIFETIME`
- **Fallback**: If webhook hasn't arrived after 18s of polling, falls back to manual confirmation dialog
- Competitive positioning: 78% cheaper than GuitarTuna ($9/month)
- Premium screen includes comparison table vs competitor apps (ads, price, bloat)
- Audio input handled via Web Audio API (`AudioContext`) in `app/index.tsx`

### Authentication

- **Current implementation**: Fully client-side using AsyncStorage (no server auth yet)
- Users are stored locally with SHA-256 hashed passwords (via `expo-crypto`)
- The auth context (`lib/auth-context.tsx`) manages login, register, logout, and premium upgrade
- The server has a `users` table schema ready but routes are not yet wired up

### Backend (Express)

- **Location**: `server/` directory
- **Entry point**: `server/index.ts` — Express server with CORS setup for Replit domains and localhost
- **Routes**: `server/routes.ts` — Currently empty, ready for API route registration (prefix `/api`)
- **Storage**: `server/storage.ts` — In-memory storage (`MemStorage`) implementing `IStorage` interface with user CRUD operations
- **Build**: Uses `esbuild` to bundle for production (`server_dist/`)
- **Static serving**: Serves Expo web build in production, proxies to Metro in development
- **Landing page**: `server/templates/landing-page.html` — Dark-themed marketing page with competitive comparison, tuning showcase, pricing cards, QR code for Expo Go

### Database (PostgreSQL + Drizzle ORM)

- **Schema**: `shared/schema.ts` — Single `users` table with `id` (UUID), `username`, `password`
- **ORM**: Drizzle ORM with `drizzle-zod` for schema validation
- **Config**: `drizzle.config.ts` — Requires `DATABASE_URL` environment variable
- **Migrations**: Output to `./migrations` directory
- **Push command**: `npm run db:push` uses `drizzle-kit push`
- **Note**: The storage layer currently uses in-memory storage, not the database. The database schema is defined but not yet connected to the storage implementation.

### Key Design Patterns

- **Shared schema**: `shared/schema.ts` is shared between server and client for type safety
- **Path aliases**: `@/*` maps to root, `@shared/*` maps to `./shared/*`
- **Separation of concerns**: Tuner logic is isolated in `lib/tuner-engine.ts`, UI components are modular (`TunerDial`, `NoteDisplay`, `StringSelector`, `TuningSelector`)
- **Error handling**: Custom `ErrorBoundary` component with fallback UI and app restart capability
- **i18n**: All user-facing strings go through `t()` from `lib/i18n.ts`

### Scripts

- `expo:dev` — Start Expo dev server (configured for Replit)
- `server:dev` — Start Express server in development with `tsx`
- `server:prod` — Run production server from `server_dist/`
- `db:push` — Push Drizzle schema to PostgreSQL

## External Dependencies

- **PostgreSQL**: Required for user data persistence (via `DATABASE_URL` environment variable). Currently schema-only; in-memory storage is the active implementation.
- **Expo ecosystem**: Extensive use of Expo modules (haptics, crypto, secure-store, image, linear-gradient, web-browser, splash-screen, localization)
- **Replit environment**: Server relies on `REPLIT_DEV_DOMAIN`, `REPLIT_DOMAINS`, and `REPLIT_INTERNAL_APP_DOMAIN` for CORS and URL configuration
- **Device microphone**: Core functionality requires microphone access for pitch detection (permissions configured in `app.json` for both iOS and Android)
- **No external APIs or third-party services** are currently integrated beyond the local PostgreSQL database

## Market Strategy

- **Target markets**: US and Europe (English-speaking users), Mexico (bilingual advantage)
- **Positioning**: "No ads, no bloat, fair price" — 78% cheaper than competitors (Dunford statement in competitive-analysis report)
- **ASO keywords**: guitar tuner, no ads, drop d tuner, accurate tuner, open g tuning, guitartuna alternative
- **Freemium model**: Standard + 3 alternative tunings free, 6 premium tunings for $1.99/mo or $9.99/yr

### Go-To-Market Assets (built March 2026)

#### Competitive Analysis Report
- **Route**: `/competitive-analysis` (HTML report, also `server/templates/competitive-analysis.html`)
- **Contents**: Dunford positioning statement, feature matrix (GuitarTune vs 4 competitors), 2×2 positioning map, white space analysis, 3 battlecard recommendations
- **Data source**: `server/seo-data.ts` — `COMPETITORS` array

#### Ad Creative Assets (3 Angles)
- **Location**: `server/templates/ads/`
- **Served at**: `/ads/<filename>.html`
- **Files**:
  - Angle A (Pain — "GuitarTuna shows ads while you're tuning. We don't."): `angle-a-feed.html` (1080×1080), `angle-a-portrait.html` (1080×1350), `landing-angle-a.html`
  - Angle B (Outcome — "In tune in under 10 seconds. No ads. Ever."): `angle-b-feed.html`, `angle-b-portrait.html`, `landing-angle-b.html`
  - Angle C (Identity — "The tuner for guitarists who take it seriously."): `angle-c-feed.html`, `angle-c-portrait.html`, `landing-angle-c.html`
- **Spec**: Viewport-relative, flat dark (#0A0A0A) + cyan (#4AEDC4), embed-ready as iframes

#### Google RSA + TikTok Copy
- **Route**: `/ad-copy` (HTML document, also `server/templates/ad-copy.html`)
- **Contents**: 15 Google RSA headlines (≤30 chars), 5 descriptions (≤90 chars), 3 TikTok Spark Ad scripts (hook + body + CTA, ≤60s), targeting parameters for both platforms

#### Programmatic SEO Pages
- **Routes**: Registered in `server/seo-routes.ts`, data in `server/seo-data.ts`
- **Hub pages**: `/compare` (all competitor comparisons), `/tunings` (all tuning guides)
- **Competitor comparison pages**: `/vs/[slug]` — 8 competitors: guitartuna, fender-tune, boss-tuner, pano-tuner, chromatic-guitar-tuner, guitar-tuna-pro, ultimate-guitar-tuner, n-track-tuner
- **Tuning guide pages**: `/tunings/[slug]` — 15 tunings: standard, drop-d, open-g, dadgad, open-d, open-e, drop-c, double-drop-d, open-c, all-fourths, drop-b, open-a, half-step-down, whole-step-down, nashville
- **SEO features**: SSR-rendered, canonical URLs, FAQPage JSON-LD schema, SoftwareApplication schema, internal linking, unique content per page
- **Sitemap**: `/sitemap.xml` — covers all 26 SEO pages

#### 30-Day Launch Playbook
- **Route**: `/launch-playbook` (HTML document, also `server/templates/launch-playbook.html`)
- **Contents**: Week-by-week execution plan (Weeks 1–4) with ASO setup, paid ads (Meta/Google/TikTok), SEO indexing, review seeding, retention optimization, budget allocation ($1,350 total), targeting parameters for Meta/TikTok/Google, daily operational checklist, and KPI targets per week
