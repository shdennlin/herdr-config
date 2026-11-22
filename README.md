# herdr-config

Example configuration for the [Herdr](https://herdr.dev) desktop app: a layout, a
keymap, and a few mods. Copy what you want into `~/.config/herdr-app`.

Herdr runs on macOS only. The files here assume macOS paths and tools.

## What's included

| Path | What it is |
|---|---|
| `layouts/example.json` | A layout that uses only mods shipped with Herdr, plus `workspace-status-quiet`. |
| `keys.json` | Example keymap. Global and terminal bindings, plus the `layout:example` section for the spaces-agents sidebar. |
| `mods/workspace-status-quiet/` | A copy of the built-in `workspace-status` mod with the "⌘⇧P commands" hint removed. |
| `contrib/spectra/` | Optional mods for projects that use Spectra (OpenSpec) changes. See its dependencies below. |

## Setup

1. Copy the layout and mods:
   ```sh
   cp layouts/example.json ~/.config/herdr-app/layouts/
   cp -R mods/workspace-status-quiet ~/.config/herdr-app/mods/
   ```
2. Merge the keymap. If you have no `~/.config/herdr-app/keys.json` yet, copy it. If you do, add the `layout:example` section and any global bindings you want to your existing file.
3. Switch to the layout in Herdr with `cmd-shift-l`, or open the layout menu.
4. Check the install:
   ```sh
   herdr-app status          # "errors" should be []
   herdr-app check ~/.config/herdr-app/mods/workspace-status-quiet
   ```
5. Optional: copy `contrib/spectra/*` into `~/.config/herdr-app/mods/` and add the spectra blocks to a layout. Read the dependencies first.

## Dependencies

| Item | Needs | Notes |
|---|---|---|
| `layouts/example.json` | Built-in mods: `workspace-chrome`, `spaces-agents`, `tabs-live`, `workspace-status`, `usage-status`, `resume-banner`, `files`, `changes`, `pane` | Check each folder exists in `~/.config/herdr-app/mods`. |
| `mods/workspace-status-quiet` | Built-in `workspace-status` | A plain clone with the hint removed. Reinstall it after Herdr updates `workspace-status`. |
| `keys.json` | None | Bindings for shipped commands. |
| `contrib/spectra/spectra-status` | Claude Code with a status line that prints `v<version> <8-hex session id>`; `hc`; an OpenSpec project (`openspec/changes/`) | Reads Claude's transcripts under `~/.claude/projects`. Shows nothing without a Claude session. |
| `contrib/spectra/spectra-panel` | The `spectra` CLI on `PATH`; `sh`; VS Code's `code` command (falls back to `open -a "Visual Studio Code"`) | Shows only inside an OpenSpec project. Clicks open `tasks.md` in VS Code. |

## Licence

MIT. See [LICENSE](LICENSE).
