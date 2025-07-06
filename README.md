# Peeper - GitHub Notifications

A comprehensive Electron application for managing GitHub notifications with powerful filtering and desktop notification capabilities, built with TypeScript for enhanced type safety and developer experience.

## 🚀 Features

- **🔐 Secure Token Management**: Encrypted storage of GitHub personal access tokens
- **📊 SQLite Database**: Local storage for notifications, inboxes, and configuration
- **📱 Smart API Integration**: Efficient polling with `Last-Modified` headers and `X-Poll-Interval` respect
- **📥 Powerful Inbox System**: Create custom inboxes with expressive filter language
- **🔔 Desktop Notifications**: Configurable per-inbox notifications
- **🎨 Modern UI**: Dark GitHub-themed interface
- **⚡ Advanced Filtering**: Boolean logic, text functions, and field comparisons

## 🛠️ TypeScript Migration

This project has been converted from JavaScript to TypeScript, providing:

- **Type Safety**: Comprehensive type definitions for all data structures
- **Better IDE Support**: Enhanced IntelliSense and code completion
- **Compile-time Error Detection**: Catch errors before runtime
- **Improved Maintainability**: Self-documenting code with type annotations

### Project Structure

```
peeper/
├── src/
│   ├── types.ts                 # TypeScript type definitions
│   ├── database.ts              # SQLite database management
│   ├── github-api.ts            # GitHub API integration
│   ├── notification-manager.ts  # Filtering and notifications
│   ├── preload.ts              # Secure IPC bridge
│   └── renderer/               # React-based frontend
│       ├── index.tsx           # Application entry point
│       ├── index.html          # HTML template
│       ├── styles.css          # Modern dark theme
│       ├── types.ts            # Renderer type definitions
│       └── components/         # React components
│           ├── MainApp.tsx     # Main application component
│           ├── NotificationList.tsx # Notification display with PR status
│           ├── Sidebar.tsx     # Sidebar with inboxes
│           ├── InboxModal.tsx  # Inbox creation/editing
│           ├── PreferencesModal.tsx # Settings modal
│           └── FilterAutocomplete.tsx # Smart filtering UI
├── dist/                       # Compiled JavaScript output
├── main.ts                    # Electron main process
├── package.json               # Dependencies and scripts
├── webpack.config.js          # React build configuration
└── tsconfig.json              # TypeScript configuration
```

## 📋 Requirements

- Node.js (with npm)
- TypeScript (installed as dev dependency)
- GitHub Personal Access Token with `notifications` scope

## 🚀 Getting Started

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Build TypeScript**:
   ```bash
   npm run build
   ```

3. **Start the Application**:
   ```bash
   npm start
   ```

## 📦 Installation

### Pre-built Releases

Download the latest release for your platform:

- **Windows**: Download the `.exe` installer from [Releases](../../releases/latest)
- **macOS**: Download the `.dmg` file from [Releases](../../releases/latest)
- **Linux**: Download the `.deb` package or `.AppImage` from [Releases](../../releases/latest)

### Installation Instructions

#### Windows
1. Download the `.exe` file
2. Run the installer and follow the setup wizard

#### macOS
1. Download the `.dmg` file
2. Open the DMG and drag the app to your Applications folder

#### Linux
**For .deb (Debian/Ubuntu):**
```bash
sudo dpkg -i peeper-*.deb
# If there are dependency issues:
sudo apt-get install -f
```

**For .AppImage:**
```bash
chmod +x peeper-*.AppImage
./peeper-*.AppImage
```

## 🔧 Development

### Available Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run watch` - Watch mode for TypeScript compilation
- `npm start` - Build and start the application
- `npm run dev` - Build and start in development mode
- `npm run compile` - Build and package the Electron app
- `npm run compile:win` - Build for Windows (cross-platform)
- `npm run compile:mac` - Build for macOS (requires macOS)
- `npm run compile:linux` - Build for Linux (cross-platform)
- `npm run dist:all` - Build for all platforms
- `npm run prepare-release` - Prepare a new release

### Building and Releasing

This project includes automated CI/CD with GitHub Actions:

#### Automated Releases
1. **Prepare a release:**
   ```bash
   npm run prepare-release 1.0.1
   ```

2. **Push to trigger build:**
   ```bash
   git push origin main
   git push origin v1.0.1
   ```

3. **Monitor:** GitHub Actions will automatically build for all platforms and create a release.

#### Manual Build Testing
Test builds locally before releasing:
```bash
npm run build              # Test TypeScript compilation
npm run compile            # Test Electron packaging
npm run compile:win        # Test Windows build
npm run compile:linux      # Test Linux build
```

For detailed CI/CD information, see [GitHub Actions Setup](.github/README.md).

### VS Code Tasks

The project includes VS Code tasks for:
- **Build TypeScript**: Compile the project
- **Watch TypeScript**: Run TypeScript in watch mode
- **Start Peeper**: Build and run the application

### TypeScript Configuration

The project uses a comprehensive TypeScript configuration (`tsconfig.json`) with:
- **Target**: ES2020
- **Module**: CommonJS
- **Strict Mode**: Enabled
- **Source Maps**: Generated for debugging
- **Declaration Files**: Support for external modules

## 📖 Type Definitions

### Core Types

- `GitHubNotification`: Raw notification data from GitHub API
- `StoredNotification`: Database-stored notification format
- `Inbox`: Inbox configuration with filtering
- `FilterContext`: Context object for filter evaluation
- `SyncResult`: Result of notification synchronization
- `TokenTestResult`: GitHub token validation result

### Filter Language

The application supports a powerful filter language with:

- **Field Access**: `subject_title`, `subject_type`, `repository_name`, etc.
- **Boolean Logic**: `AND`, `OR`, `NOT`
- **Text Functions**: `contains()`, `startsWith()`, `endsWith()`, `matches()`
- **Comparisons**: `===`, `!==`

### Example Filters

```typescript
// Unread pull requests
'unread AND subject_type === \'PullRequest\''

// Specific repository
'repository_full_name === \'owner/repo\''

// Contains text in title
'contains(subject_title, \'urgent\')'

// Multiple conditions
'reason === \'mention\' OR (unread AND subject_type === \'Issue\')'
```

## 🔒 Security

- **Token Encryption**: GitHub tokens are encrypted using crypto-js
- **Context Isolation**: Renderer process runs in isolated context
- **Secure IPC**: All main-renderer communication through typed IPC handlers

## 🎯 First Time Setup

1. Launch the application
2. Enter your GitHub Personal Access Token
3. The app will validate and securely store the token
4. Create custom inboxes with filters
5. Configure desktop notifications as needed

## 🐛 Troubleshooting

### Common Issues

1. **npm not recognized**: Run `refreshenv` in PowerShell before npm commands
2. **Build errors**: Ensure all TypeScript dependencies are installed
3. **Token issues**: Verify token has `notifications` scope

### Development Tips

- Use `npm run watch` during development for automatic compilation
- Check the `dist/` folder for compiled JavaScript output
- Use VS Code tasks for streamlined development workflow

## 📝 License

ISC License

## 🤝 Contributing

Contributions are welcome! Please ensure TypeScript code follows the existing patterns and includes proper type annotations.
