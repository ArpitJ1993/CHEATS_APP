# Hard work and patience cannot be substituted by cheating

> **Version 2** — refreshed architecture with multi-vendor model discovery and improved multimodal workflows.

Author: Arpit J Soni  
LinkedIn: [linkedin.com/in/arpit-j-soni](https://www.linkedin.com/in/arpit-j-soni)

**Download the Windows installer:** [Download the Windows installer](https://www.arpitjsoni.com/CHEATS_APP_Windows_Setup.zip)

## Why “LeetCode-style” interviews are not the best measurement
- LeetCode-style interviews often optimize for short-term memorization and pattern matching, not for real-world software engineering outcomes such as system design, collaboration, debugging, and iteration under ambiguity.
- They can exclude strong engineers who excel in building maintainable systems, communicating tradeoffs, and delivering end-to-end features.
- Data structures and algorithms are still important: they inform complexity analysis, help identify performance bottlenecks, and build problem-solving intuition.  
- The issue is the format: solving one-off hard puzzles under a 30–40 minute time limit is neither inclusive nor indicative of day-to-day software impact.

## Software required and local run steps
- Prerequisites:
  - Node.js 18+ and npm 9+
  - macOS 13+ or Windows 10/11
  - OpenAI API key (set as `OPENAI_API_KEY` or `REACT_APP_OPENAI_API_KEY`)
- Setup
  ```bash
  # from project root
  npm ci
  npm run electron-dev
  ```
  - The command starts the React dev server and launches Electron after the app is reachable.

## Version 2 Highlights
- **Choose your favorite LLM** for every request—swap between OpenAI (ChatGPT), Google Gemini, Perplexity, or Claude (Anthropic) right from the app.
- **Unified multimodal support** across all providers: mix text plus multiple screenshots in one prompt and get a single streaming answer.
- **Smarter fallbacks** so retired or unavailable models are replaced automatically without you touching settings.
- **Cleaner setup** that keeps your provider configuration in sync and ready for future upgrades (voice, tools, etc.).

## Core Features
- Screenshot capture with automatic window-hide during capture (restores immediately).
- Multimodal querying (text + screenshots) with streaming AI responses.
- Meeting transcription page with dual-stream setup (microphone + system audio; renderer code provided).
- Screen-share privacy: Hide app from screen sharing while keeping it visible for you.
- Global keyboard shortcuts for screenshots, visibility toggle, window move, and opacity control.
- Configurable settings including theme, font size, API key, participants’ names, and shortcuts.
- Theming built on an Aurora-inspired palette with CSS variables applied app-wide.

## Build desktop app (macOS)
- Requirements: Xcode Command Line Tools, Apple Developer account for signing/notarization (recommended for distribution).
- Build steps
  ```bash
  npm ci
  npm run electron-pack
  ```
- Artifacts: `dist/Visual Studio Code Desktop-<version>-arm64.dmg` (and `.zip`), plus unpacked `.app` under `dist/mac-arm64/`.
- Optional signing & notarization
  ```bash
  export CSC_IDENTITY_AUTO_DISCOVERY=true
  export APPLE_ID="your-apple-id@example.com"
  export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
  npm run electron-pack
  ```

## Build desktop app (Windows)
- Requirements: Windows 10/11. Optional code-signing certificate for best install UX.
- Build steps
  ```powershell
  npm ci
  npm run electron-pack
  ```
- Artifacts: NSIS installer `dist/Visual Studio Code Desktop-<version>.exe`.
- Optional Windows signing (via electron-builder)
  - Set `CSC_LINK` (path/base64 to PFX) and `CSC_KEY_PASSWORD`, or use store-based options.

## Keyboard shortcuts
- In-app
  - CmdOrCtrl+H: Take screenshot (also registered globally).
  - CmdOrCtrl+R: Reset the current session.
  - CmdOrCtrl+S: Save the current response.
  - Shift+Enter (while holding Cmd/Ctrl): Submit the current query.
- Global
  - CmdOrCtrl+Shift+V: Toggle “visible to screen share” (privacy mode on/off; window stays visible to you).
  - CmdOrCtrl+Up/Down/Left/Right: Move window by 50px.
  - CmdOrCtrl+Alt+. / CmdOrCtrl+Alt+,: Increase / Decrease app opacity.

## Generate icons with electron-icon-maker
- This repo exposes a helper command that forwards flags to `electron-icon-maker`.
- Source image: a square PNG with sufficient resolution (at least 1024×1024 recommended).
- Command:
  ```bash
  npm run make-icons -- --input /absolute/path/to/source.png --output /absolute/path/to/output-dir
  ```
- Example using this repo’s asset layout:
  ```bash
  npm run make-icons -- \
    --input Desktop/CHEAT/CHEATS/public/assets/vscode.png \
    --output Desktop/CHEAT/CHEATS/public/assets
  ```
- The generated `.icns` (mac) and `.ico` (windows) can be referenced by the build config and at runtime (tray/window icons).

## Change the application name
- Update in `package.json`:
  - `name`: npm package name (optional for distribution but keep consistent).
  - `build.productName`: The user-facing application name in installers and the `.app`/`.exe`.
  - `build.appId`: Reverse-DNS identifier (change to your domain, e.g., `com.yourco.product`).
- Optional UI title: If you want a custom window title beyond the product name, set it via the renderer or in `BrowserWindow` options.

## Change the application icon
- Build-time (installers):
  - macOS: `build.mac.icon` → `public/assets/your.icns`
  - Windows: `build.win.icon` → `public/assets/your.ico`
- Runtime (tray/window):
  - File: `public/electron.js` picks icons per platform from `public/assets` (`vscode.icns` on mac, `vscode.ico` on win, `vscode.png` as fallback for others). Replace those file paths with your own.
- After replacing icons, rebuild:
  ```bash
  npm run electron-pack
  ```

## Social links
- Personal site: [arpitjsoni.com](https://www.arpitjsoni.com)
- Twitter/X: [`x.com/arpitsoni1893`](https://x.com/arpitsoni1893)
- YouTube: [`youtube.com/@ArpitJSoni_1`](https://www.youtube.com/@ArpitJSoni_1)

## References
- Twitter/X profile mentioned above for author identity: [`https://x.com/arpitsoni1893`](https://x.com/arpitsoni1893)


