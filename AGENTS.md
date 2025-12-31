# Repository Guidelines

## Project Structure & Module Organization
- `desktop/`: Electron desktop app.
  - `desktop/main.js`: Main process (window + backend spawn).
  - `desktop/preload.js`: Secure bridge via `contextBridge`.
  - `desktop/renderer/`: UI (`index.html`, `renderer.js`) using Tailwind CDN.
  - `desktop/backend-src/`: Node controller entry for desktop builds.
  - `desktop/backend/`: Bundled controller/executor output (gitignored).
- `src/controller/`: LLM control logic (shared by desktop backend build).
- `src/executor/`: macOS automation executor (Python).
- `venv/`: Python virtual environment.

## Build, Test, and Development Commands
- `npm --prefix desktop install`: Install desktop dependencies.
- `npm --prefix desktop run dev`: Launch the Electron app.
- `npm --prefix desktop run build:backend`: Bundle desktop controller.
- `npm --prefix desktop run dist`: Build a desktop distributable.

## Coding Style & Naming Conventions
- Use 2-space indentation in JSON/HTML; JS follows existing style (double quotes).
- Keep filenames lowercase and descriptive (`desktop/renderer/renderer.js`).
- Prefer clear, short function names in the main process (`createWindow`, `ensureController`).
- Format TypeScript/Python with existing tooling (`prettier`, `autopep8`) where applicable.

## Testing Guidelines
No automated tests are set up. If you add tests, include:
- A `test` script at the relevant level (`desktop/package.json`).
- A clear location such as `desktop/renderer/__tests__/`.
- Test naming like `*.test.js`.

## Commit & Pull Request Guidelines
Recent commit history mixes conventional-style prefixes (e.g., `feat:`) with short summaries.
Follow that pattern:
- Use a short, present-tense summary, optionally with a type (`feat:`, `fix:`).
- Keep the first line under ~72 characters.

Pull requests should include:
- A concise description of behavior changes.
- Screenshots for UI changes in `desktop/renderer/`.
- Any relevant issue links.

## Security & Configuration Tips
- Keep `nodeIntegration: false` and `contextIsolation: true` in `desktop/main.js`.
- Update CSP in `desktop/renderer/index.html` if new external assets are needed.
