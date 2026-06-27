# Detected Provider

- **Provider (Maestro toolType)**: opencode
- **Confidence**: high
- **Detected on**: 2026-06-27

## Signals

### Self-identification
I am running inside the `opencode` AI coding harness, acting as the Maestro agent "Amplenote Kanban".

### PATH probe
- `claude`: `/Users/thewytchhaus/.local/bin/claude`
- `codex`: `/usr/local/bin/codex`
- `opencode`: `/Users/thewytchhaus/.opencode/bin/opencode`
- `droid`: `/Users/thewytchhaus/.local/bin/droid`
- `copilot`: `/usr/local/bin/copilot`
- `gemini`: `/usr/local/bin/gemini`
- `qwen`: `not-found`

## Reconciliation Notes
I confidently self-identify as `opencode`. While multiple CLI binaries are present on the `PATH`, this is expected on a developer machine testing various tools, and the presence of `/Users/thewytchhaus/.opencode/bin/opencode` confirms the harness binary is available. The self-identification is authoritative.

## Supported by Superpowers?
yes

- `claude-code`, `codex`, `opencode`, `factory-droid`, `copilot-cli`, `gemini-cli` → yes
- `qwen3-coder` → no (no upstream install path documented)
- `unknown` → no (cannot proceed; document 2 will exit cleanly)