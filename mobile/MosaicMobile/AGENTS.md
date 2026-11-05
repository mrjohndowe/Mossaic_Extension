# Mosaic for Reddit - Mobile App

This is an Expo/React Native mobile application that is a mobile version of the Mosaic for Reddit browser extension. It provides a masonry layout media browser for Reddit content.

## Project Overview

- **App Name**: Mosaic for Reddit
- **Framework**: Expo SDK 58 with React Native
- **Navigation**: Expo Router (file-based routing)
- **Data Source**: Web scraping Reddit (no API authentication required)
- **Storage**: expo-secure-store for local preferences

## Key Features

- Masonry grid layout for Reddit media
- Media viewer with zoom, pan, and navigation
- Support for images, GIFs, videos, and galleries
- Customizable settings (columns, filters, sorting)
- Favorites and watchlist functionality
- NSFW filtering options
- Dark theme by default

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Project Structure

```
src/
├── app/              # Expo Router screens
│   ├── _layout.tsx   # Root layout with navigation
│   ├── index.tsx     # Home screen (watchlist)
│   ├── wall.tsx      # Masonry media wall
│   ├── viewer.tsx    # Media viewer modal
│   └── settings.tsx  # Settings screen
├── components/       # Reusable components (to be added)
├── hooks/           # Custom hooks (to be added)
├── services/        # API and data services
│   └── redditApi.ts # Reddit web scraping service
├── store/          # State management
│   └── preferences.ts # Preferences and storage
├── types/          # TypeScript types
│   └── index.ts
└── utils/          # Utility functions (to be added)
```

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) — no local Xcode or Android Studio required. Run EAS CLI as `npx eas-cli@latest <command>`; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
- The app uses web scraping instead of Reddit's API to avoid OAuth authentication complexity
- All data is stored locally using expo-secure-store (no cloud sync)
