# Contributing to miki desktop

Thanks for your interest in contributing! This project welcomes bug reports, feature requests, and pull requests.

## Getting Started

- Review the project overview and architecture docs in `docs/`.
- Use the integrated CLI `./dev.sh` for setup and development.
- Prefer Bun for Node tasks (`bun run ...`) as described in the README.

## Development Setup

```bash
./dev.sh doctor
./dev.sh install
./dev.sh setup-python
./dev.sh build-all
./dev.sh start
```

If the interactive menu does not work in your environment, use the subcommands listed in the README (for example `bun --cwd desktop run dev`).

## Coding Standards

- Follow existing code style and patterns in each directory.
- Keep CommonJS in `desktop/` (`require` / `module.exports`).
- JSON/HTML use 2-space indentation; JS follows existing double quotes.
- Avoid adding temporary helper scripts; prefer existing Bun scripts.

## Pull Requests

- Keep PRs focused and describe the behavior change.
- Add screenshots for renderer UI changes (`desktop/renderer/`).
- Include related issue links when available.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
