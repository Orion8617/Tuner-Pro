# GuitarTune - Replit Agent Guide

## Overview

GuitarTune is a mobile guitar tuner application built with Expo (React Native). It uses the device microphone to detect pitch and helps users tune their guitar strings. The app features real-time frequency detection via autocorrelation, a visual tuner dial, string selection, and a premium tier system. The UI supports bilingual English/Spanish with auto-detection. It includes a backend Express server for API support and uses a PostgreSQL database with Drizzle ORM for user management.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

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
- Lifetime Access: **14.99 USDC** on Solana mainnet
- **Payment flow**: User selects Lifetime plan → taps "Pay with Phantom" → backend generates Solana Pay URL with unique reference key + USDC mint → app opens URL (Phantom deep link on Android, browser fallback) → user confirms in Phantom → backend polls `getSignaturesForAddress(reference)` every 3s for up to 2 min → on confirmation activates lifetime subscription
- **Endpoints**: `POST /api/checkout/solana/create` (generates URL + session), `GET /api/checkout/solana/verify` (checks blockchain)
- **Required env var**: `SOLANA_WALLET_ADDRESS` — your Phantom/Solana wallet address to receive payments
- **Optional env var**: `SOLANA_RPC_URL` — defaults to `https://api.mainnet-beta.solana.com`
- **USDC mint** (Solana mainnet): `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- **Frontend**: Purple (#9945FF) Phantom button visible only on Lifetime plan tab; polls backend after redirecting to wallet

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

- **Target markets**: US and Europe (English-speaking users)
- **Positioning**: "No ads, no bloat, fair price" — 78% cheaper than competitors
- **ASO keywords**: guitar tuner, no ads, drop d tuner, accurate tuner, open g tuning
- **Freemium model**: Standard + 3 alternative tunings free, 6 premium tunings for $1.99/mo or $9.99/yr
