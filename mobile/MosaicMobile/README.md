# Mosaic for Reddit - Mobile App

A React Native mobile version of the Mosaic for Reddit browser extension. Browse Reddit media in a beautiful masonry layout on your mobile device.

## Features

- **Masonry Grid Layout**: Pinterest-style responsive grid for Reddit media
- **Media Support**: Images, GIFs, videos, and Reddit galleries
- **Media Viewer**: Full-featured viewer with navigation
- **Customization**: Adjustable columns, filters, sorting options
- **Watchlist**: Save your favorite subreddits and users
- **Favorites**: Mark and save favorite media items
- **NSFW Filtering**: Toggle NSFW content visibility
- **Reddit Browsing**: Public Reddit feeds without account sign-in
- **Privacy-First**: All data stored locally, no cloud sync, no tracking
- **Dark Theme**: Optimized dark mode by default

## Tech Stack

- **Framework**: Expo SDK 58
- **Language**: TypeScript
- **Navigation**: Expo Router (file-based routing)
- **Storage**: expo-secure-store for local preferences and tokens
- **Data Source**: Public Reddit JSON feeds
- **Images**: expo-image for optimized image loading

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Expo CLI installed globally (or use npx)
- For iOS: macOS with Xcode (or use Expo Go app)
- For Android: Android Studio with emulator or physical device
- **Reddit app registered** (see above)

### Installation

```bash
cd mobile/MosaicMobile
npm install
```

### Running the App

#### Development Mode (Expo Go)

1. Install the Expo Go app on your mobile device
2. Start the development server:
   ```bash
   npx expo start
   ```
3. Scan the QR code with Expo Go app
4. Confirm the first-run age profile, then browse a subreddit or feed.

#### Android Development Build

```bash
npx expo run:android
```

#### iOS Development Build (macOS only)

```bash
npx expo run:ios
```

#### Web Preview

```bash
npx expo start --web
```

## Project Structure

```
src/
├── app/              # Expo Router screens
│   ├── _layout.tsx   # Root layout with navigation
│   ├── login.tsx     # Reddit OAuth login screen
│   ├── index.tsx     # Home screen (watchlist)
│   ├── wall.tsx      # Masonry media wall
│   ├── viewer.tsx    # Media viewer modal
│   └── settings.tsx  # Settings screen
├── components/       # Reusable components
├── hooks/           # Custom hooks
├── services/        # API and data services
│   ├── auth.ts      # Reddit OAuth authentication
│   └── redditApi.ts # Reddit API service
├── store/          # State management
│   └── preferences.ts # Preferences and storage
├── types/          # TypeScript types
│   └── index.ts
└── utils/          # Utility functions
```

## Configuration

### App Configuration

Edit `app.json` to change:
- App name and bundle ID
- Icon and splash screen
- Build settings for iOS/Android
- **scheme**: Must match your Reddit redirect URI (default: "mosaic")

### Reddit API Configuration

Edit `src/services/auth.ts`:
- `REDDIT_CLIENT_ID`: Your Reddit app client ID
- `REDIRECT_URI`: Auto-generated from app.json scheme

### User Preferences

Preferences are stored locally using expo-secure-store:
- Filter type (all, images, videos, gifs)
- Sort method (hot, new, top, rising)
- Time range (for top sort)
- Column count (1-4)
- NSFW visibility
- Turbo mode

## Development

### Type Checking

```bash
npx tsc --noEmit
```

### Linting

```bash
npx expo lint
```

### Building for Production

#### Using EAS (Expo Application Services)

1. Install EAS CLI:
   ```bash
   npm install -g eas-cli
   ```

2. Configure EAS:
   ```bash
   eas build:configure
   ```

3. Build for Android:
   ```bash
   eas build --platform android
   ```

4. Build for iOS:
   ```bash
   eas build --platform ios
   ```

## Known Limitations

- Video playback is not yet fully implemented (placeholder shown)
- No swipe gestures in viewer (removed gesture-handler dependency)
- Gallery navigation could be improved
- No slideshow mode yet

## Future Enhancements

- Full video playback with controls
- Swipe gestures using React Native's built-in handlers
- Slideshow mode
- Advanced image filters
- More theming options
- Profile support
- User following features
- Download media option
- Share functionality

## Privacy & Data

- All user data stored locally on device
- No cloud synchronization
- No analytics or tracking
- Reddit OAuth tokens stored securely on device
- Tokens never shared with third parties

## License

Proprietary software. Copyright © 2026 John Dowe. All Rights Reserved.

## Author

John Dowe - Independent Software Developer
