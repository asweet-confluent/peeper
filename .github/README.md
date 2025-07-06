# GitHub Actions & Auto-Update Setup

This repository uses [electron-updater](https://www.electron.build/auto-update) for automatic releases and updates, following the official electron-builder documentation. The setup is simple, maintainable, and follows best practices.

## Overview

The project now uses the official `electron-updater` package which provides:
- ✅ **Automatic updates** for Windows, macOS, and Linux
- ✅ **Built-in release management** via electron-builder
- ✅ **Simple configuration** with minimal GitHub Actions
- ✅ **Native update dialogs** and progress indicators
- ✅ **Staged rollouts** support

## Auto-Update Setup

### Dependencies
- ✅ `electron-updater@^6.6.5` - Handles automatic updates
- ✅ `electron-log@^5.2.0` - Logging for the auto-updater

### Configuration

The project is configured in `electron-builder.mjs`:
```javascript
// Auto-updater configuration  
publish: {
  provider: 'github',
  owner: 'asweet-confluent', 
  repo: 'peeper'
},

// Auto-updater support (generates metadata files)
generateUpdatesFilesForAllChannels: true,
```

### Auto-Updater Module
Located in `packages/main/src/modules/AutoUpdater.ts`, this module:
- Checks for updates automatically on app start (5 seconds delay)
- Shows user-friendly dialogs for update availability
- Handles download progress and installation
- Performs periodic update checks (every hour)
- Only runs update checks for packaged applications

## Release Workflow

### GitHub Actions (`.github/workflows/release.yml`)
The release workflow is simple and follows electron-updater best practices:

**Triggers:** Git tags starting with `v` (e.g., `v1.0.0`) or manual dispatch

**Process:**
1. Builds for Windows, macOS, and Linux simultaneously
2. Runs type checking
3. Uses `npm run release` which calls `electron-builder build --publish=always`
4. Automatically publishes to GitHub Releases with proper metadata

**What Gets Published:**
- **Windows**: `.exe` installer + update metadata
- **macOS**: `.dmg` + `.zip` (required for updates) + metadata  
- **Linux**: `.deb`, `.AppImage`, `.tar.gz` + metadata

## Platform Support

| Platform | Formats | Auto-Update |
|----------|---------|-------------|
| **Windows** | NSIS installer (`.exe`) | ✅ |
| **macOS** | DMG + ZIP (required for updates) | ✅ |
| **Linux** | DEB, AppImage, TAR.GZ | ✅ |

## Auto-Update Process

1. **App starts** → Auto-updater checks for updates after 5 seconds
2. **Update found** → Shows dialog asking user to download
3. **User accepts** → Downloads update in background with progress
4. **Download complete** → Shows dialog asking user to restart
5. **User restarts** → Update is automatically installed

### Update Checks
- **Initial**: 5 seconds after app startup
- **Periodic**: Every hour while app is running
- **Only for packaged apps**: Development builds skip update checks

## How to Release

### Simple Tag-Based Release

1. **Update version in package.json:**
   ```bash
   npm version patch  # 1.0.0 -> 1.0.1
   npm version minor  # 1.0.0 -> 1.1.0
   npm version major  # 1.0.0 -> 2.0.0
   ```

2. **Push the tag:**
   ```bash
   git push origin main
   git push origin --tags
   ```

That's it! The workflow will automatically:
- Build for all platforms
- Create GitHub release  
- Upload all artifacts with proper metadata for auto-updates

## Benefits of This Setup

### For Users
- ✅ **Automatic updates** - No manual downloads needed
- ✅ **User control** - Option to download now or later  
- ✅ **Progress feedback** - See download progress
- ✅ **Safe updates** - Code signature validation
- ✅ **Cross-platform** - Works on Windows, macOS, and Linux

### For Developers  
- ✅ **Simple workflow** - Just tag and push
- ✅ **Official implementation** - Uses electron-builder's built-in publishing
- ✅ **Reliable** - Based on well-tested electron-updater
- ✅ **Maintainable** - Minimal custom code
- ✅ **GitHub integration** - Leverages GitHub Releases

## Migration Complete

This setup replaces any previous custom GitHub Actions release systems with the official electron-updater workflow. The configuration is now simple, reliable, and follows electron-builder best practices.
- Create GitHub releases
- Upload all binaries and update metadata
- Enable auto-updates for existing users

### Manual Workflow Trigger

1. Go to the Actions tab in your GitHub repository
2. Select "Build and Release"
3. Click "Run workflow"
4. The workflow will build and publish using the current commit

## Auto-Updates

### How It Works

1. **Built-in Checking**: The app automatically checks for updates on startup and hourly
2. **User-Friendly Dialogs**: Native OS dialogs ask users if they want to download/install updates
3. **Background Downloads**: Updates download in the background without blocking the UI
4. **Safe Installation**: Updates are installed on the next app restart

### User Experience

When an update is available:
1. User sees a dialog: "A new version (1.0.1) is available!"
2. They can choose "Download Now" or "Download Later"
3. Download happens in background with progress indication
4. When ready, user can choose "Restart Now" or "Restart Later"

### For Developers

The auto-updater is configured in `packages/main/src/modules/AutoUpdater.ts` and provides:
- Automatic update checking
- Progress notifications
- Error handling
- Development mode detection (skips updates in dev)

## Configuration

### Required Setup

1. **Repository Settings:**
   - Ensure GitHub Actions are enabled
   - No additional secrets required

2. **electron-builder.mjs:**
   - Already configured with proper GitHub publishing
   - Update `owner` and `repo` fields if needed

### Dependencies

The following packages handle auto-updates:
- `electron-updater` - Official auto-update library
- `electron-log` - Logging for update process
- `electron-builder` - Builds and publishes releases

## Version Naming Convention

Use [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes (1.0.0 -> 2.0.0)
- **MINOR**: New features, backwards compatible (1.0.0 -> 1.1.0)
- **PATCH**: Bug fixes, backwards compatible (1.0.0 -> 1.0.1)

### Pre-release versions:
- `1.0.0-alpha.1` - Alpha release
- `1.0.0-beta.1` - Beta release  
- `1.0.0-rc.1` - Release candidate

## Local Development

### Testing Updates

During development, auto-updates are disabled. To test the update mechanism:

1. **Build and package** the app locally
2. **Create a test release** on GitHub
3. **Install the packaged app** (not the dev version)
4. **Create a newer version** and release it
5. **The installed app** will detect and download the update

### Local Building

```bash
# Build for development
npm run build

# Build for current platform only
npm run compile

# Build for all platforms (requires platform-specific tools)
npm run dist:all

# Build and publish (requires GH_TOKEN)
npm run release
```

## Troubleshooting

### Common Issues

1. **Updates not detected:**
   - Ensure the app is packaged (not running in dev mode)
   - Check GitHub releases have the required metadata files (`latest.yml`, etc.)
   - Verify repository name in `electron-builder.mjs` matches actual repo

2. **Build failures:**
   - Check the Actions tab for detailed error logs
   - Ensure all dependencies are correctly installed
   - Verify code signing certificates if used

3. **Permission issues:**
   - Ensure repository has GitHub Actions enabled
   - Check that the workflow has write permissions to create releases

### Files and Structure

- `.github/workflows/release.yml` - Main release workflow
- `electron-builder.mjs` - Build and publish configuration
- `packages/main/src/modules/AutoUpdater.ts` - Auto-update implementation

## Migration Benefits

Switching to `electron-updater` provides:

- ✅ **90% less complexity** - No custom GitHub Actions scripts needed
- ✅ **Official support** - Maintained by the Electron team
- ✅ **Better reliability** - Proven solution used by thousands of apps
- ✅ **Native UX** - OS-native update dialogs and notifications
- ✅ **Advanced features** - Staged rollouts, progress tracking, error recovery

The workflow is now much simpler and more maintainable!
