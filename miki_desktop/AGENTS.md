# Repository Guidelines

## Project Structure & Module Organization
- `main.js`: Electron main process (window creation, lifecycle).
- `preload.js`: Secure bridge via `contextBridge` (no direct Node access in renderer).
- `renderer/`: UI assets (`index.html`, `renderer.js`). Styling is Tailwind via CDN.
- `package.json`: Scripts and Electron dependency.
- `README.md`: Quick start notes.

There are currently no dedicated test or build output directories in this repo.

## Build, Test, and Development Commands
- `bun install`: Install dependencies.
- `bun run dev`: Launch the Electron app locally.
- `bun run start`: Same as `dev` (Electron entry point).

If you add a build step (e.g., packaging), document it here and in `package.json`.

## Coding Style & Naming Conventions
- Use 2-space indentation in JSON/HTML; JS follows existing style (double quotes).
- Keep filenames lowercase and descriptive (`renderer/renderer.js`).
- Prefer clear, short function names in the main process (e.g., `createWindow`).
- No formatter/linter is configured yet; keep changes consistent with existing files.

## Testing Guidelines
No automated tests are set up. If you add tests, also add:
- A `test` script in `package.json` (e.g., `bun test`).
- A clear location such as `tests/` or `renderer/__tests__/`.
- Test naming like `*.test.js`.

## Commit & Pull Request Guidelines
Recent commit history mixes conventional-style prefixes (e.g., `feat:`) with short summaries.
Follow that pattern:
- Use a short, present-tense summary, optionally with a type (`feat:`, `fix:`).
- Keep the first line under ~72 characters.

Pull requests should include:
- A concise description of behavior changes.
- Screenshots for UI changes in `renderer/`.
- Any relevant issue links.

## Security & Configuration Tips
- Keep `nodeIntegration: false` and `contextIsolation: true` in `main.js`.
- Update CSP in `renderer/index.html` if new external assets are needed.
