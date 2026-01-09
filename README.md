# miki desktop

[日本語](./docs/README_JP.md) | English

An automated operation agent for macOS (desktop application).
Provides a foreground control panel with Electron and executes OS operations in collaboration with a Python Executor.

## Quick Start (Recommended)

### Integrated CLI `dev.sh`

`dev.sh` is an integrated CLI that handles everything from setup to startup, build, and distribution. It displays a status panel (Bun / node_modules / venv / build artifacts, etc.) and allows you to safely operate from a color-coded menu.

```bash
# Interactive menu (with status display)
./dev.sh

# Status check and suggestions for next steps
./dev.sh doctor
```

If your terminal cannot display emojis, you can switch to text display using an environment variable.

```bash
MIKI_DEV_NO_EMOJI=1 ./dev.sh
```

The same functions as number selection are also available as subcommands. If you are familiar with them, you can call them directly.

```bash
./dev.sh install         # Install Node dependencies
./dev.sh setup-python    # Create/regenerate Python virtual environment
./dev.sh build-all       # Build renderer, backend, and executor all at once
./dev.sh start --debug   # Start in debug mode
./dev.sh dist            # Distribution build
```

**Initial setup procedure** (all can be executed from dev.sh):
```bash
# 1. Check status (follow instructions if warnings appear)
./dev.sh doctor

# 2. Install Node dependencies
./dev.sh install

# 3. Setup Python virtual environment (regenerate if broken)
./dev.sh setup-python

# 4. Build including backend/executor
./dev.sh build-all

# 5. Start the application
./dev.sh start
```

### Development Script Command List

- `start` / `start --debug` - Start the app (development/debug)
- `start-fresh` - Reset setup flags and start
- `build-all` - Build renderer, backend, and executor all at once
- `build-renderer` - Build frontend (renderer)
- `build-backend` / `build` - Build backend
- `build-executor` - Build Python executor (venv required)
- `dist` - Build distribution package
- `install` - Install Node dependencies
- `setup-python` - Setup/regenerate Python virtual environment
- `doctor` / `status` - Check status and display recommended actions
- `clean` - Delete build artifacts (with confirmation)
- `reset-setup` - Reset setup flags
- `logs` - Open app log directory
- `help` / `menu` - Display help or interactive menu

### How to Add Features to dev.sh

`dev.sh` is structured to register small tasks.

1. Add one line to `MENU_ITEMS`: `key|label|execution_function|kind`
   - `kind` is one of `safe` / `slow` / `info` / `danger` (used for color coding and icons. Unknown values are displayed as `safe` equivalent)
2. Define the added function body in the same file (call `preflight_node` / `preflight_python` if there are environment prerequisites)
3. If you want to call it from a subcommand, add `key)` to the `case` at the bottom

Example: `my-task|📝 My Custom Task|my_function|safe`

`key` is a guideline for subcommand names and identifiers. Since the interactive menu uses `label` / `kind` for display, adding to `case` is necessary when treating it as a subcommand.

You can integrate new tasks with minimal editing, so please also consolidate project-specific processing in dev.sh.

### Debug Mode

If you want to check the agent's behavior in detail, use the `--debug` flag:

```bash
./dev.sh start --debug
# or
bun run dev -- --debug
```

In debug mode, the following information is output:
- Details of tools called by the agent (`elementsJson`, `webElements`, etc.)
- Tool execution results
- Content sent to AI (prompts, history, screenshots)
- Responses from AI
- Screenshots of each step are saved in `desktop/backend/.screenshot/`


## Setup (Manual)

```bash
bun --cwd desktop install
```

## Startup (Manual)

```bash
bun --cwd desktop run dev
```

## Backend Build

The Controller is bundled for Node, and the Executor is bundled with PyInstaller.

```bash
bun --cwd desktop run build:backend
```

Python Executor example:

```bash
source venv/bin/activate
pyinstaller --name miki-executor --onedir src/executor/main.py --distpath desktop/backend/executor
```

## Distribution Build
Distribution builds can be executed all at once using `dev.sh`.


## Keyboard Shortcuts

- **Command + Shift + Space**: Open/close chat window

You can send requests directly to AI from the chat window.

## Configuration

- `desktop/`: Main Electron app
  - `renderer/index.html`: Main control panel
  - `renderer/chat.html`: Chat window
- `src/controller/`: LLM control logic
- `src/executor/`: MacOS operations (Python)
- `venv/`: Python virtual environment

## Architecture

For a detailed explanation of the system architecture, see the [Architecture documentation](./docs/ARCHITECTURE.md).

## Security Notes

- `desktop/renderer/index.html` and `desktop/renderer/chat.html` use Tailwind CDN,
  so CSP includes `style-src 'unsafe-inline'`.
- For production distribution, either switch Tailwind to build-time compilation to avoid `unsafe-inline`,
  or document this risk.
