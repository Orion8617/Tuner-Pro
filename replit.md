# GuitarTune - Replit Agent Guide

## Overview

GuitarTune is a mobile guitar tuner application built with Expo (React Native). It uses the device microphone to detect pitch and helps users tune their guitar strings. The app features real-time frequency detection via autocorrelation, a visual tuner dial, string selection, and a premium tier system. The UI is in Spanish. It includes a backend Express server for API support and uses a PostgreSQL database with Drizzle ORM for user management.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (Expo / React Native)

- **Framework**: Expo SDK 54 with expo-router for file-based routing
- **Navigation structure**: 
  - `app/index.tsx` — Main tuner screen (home)
  - `app/(auth)/` — Auth flow (login/register) presented as modal
  - `app/premium.tsx` — Premium upsell screen presented as modal
  - `app/_layout.tsx` — Root layout with Stack navigator
- **State management**: React Context for auth (`lib/auth-context.tsx`), React Query (`@tanstack/react-query`) for server state
- **Styling**: Dark theme only (light theme mirrors dark in `constants/colors.ts`), using `react-native-reanimated` for animations
- **Fonts**: DM Sans (loaded via `@expo-google-fonts/dm-sans`)
- **Key libraries**: `react-native-reanimated`, `react-native-gesture-handler`, `react-native-keyboard-controller`, `expo-haptics`, `expo-linear-gradient`

### Tuner Engine (`lib/tuner-engine.ts`)

- Implements autocorrelation-based pitch detection (`autoCorrelate` function)
- Supports standard guitar tuning (E2, A2, D3, G3, B2, E4)
- Provides `frequencyToNote`, `findClosestString`, `getCentsFromTarget`, and `getTuningStatus` utilities
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
- **Separation of concerns**: Tuner logic is isolated in `lib/tuner-engine.ts`, UI components are modular (`TunerDial`, `NoteDisplay`, `StringSelector`)
- **Error handling**: Custom `ErrorBoundary` component with fallback UI and app restart capability

### Scripts

- `expo:dev` — Start Expo dev server (configured for Replit)
- `server:dev` — Start Express server in development with `tsx`
- `server:prod` — Run production server from `server_dist/`
- `db:push` — Push Drizzle schema to PostgreSQL

## External Dependencies

- **PostgreSQL**: Required for user data persistence (via `DATABASE_URL` environment variable). Currently schema-only; in-memory storage is the active implementation.
- **Expo ecosystem**: Extensive use of Expo modules (haptics, crypto, secure-store, image, linear-gradient, web-browser, splash-screen)
- **Replit environment**: Server relies on `REPLIT_DEV_DOMAIN`, `REPLIT_DOMAINS`, and `REPLIT_INTERNAL_APP_DOMAIN` for CORS and URL configuration
- **Device microphone**: Core functionality requires microphone access for pitch detection (permissions configured in `app.json` for both iOS and Android)
- **No external APIs or third-party services** are currently integrated beyond the local PostgreSQL database