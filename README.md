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
| `mods/resume-banner/` | A bottom banner that offers to resume Claude sessions after a reboot. Needs `bin/herdr-tab-recorder`. |
| `bin/herdr-tab-recorder` | Remembers recently closed Herdr tabs and runs `resume-all` after a reboot. Runs as a LaunchAgent. |
| `launchd/` | LaunchAgent template for `herdr-tab-recorder`. |
| `hooks/` | Two Claude Code hooks that connect Claude sessions to Herdr terminals. Optional, but `spaces-agents` shows no sub agents without the subagent hook. |

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

## Resume after reboot (optional)

`bin/herdr-tab-recorder` keeps a snapshot of every live Herdr tab. When a tab disappears, it appends the snapshot to a history file. After a reboot, `resume-all` types `claude --resume <id>` into each tab whose Claude session was recorded. The `resume-banner` mod offers that action in the Herdr bar. It renders nothing when there is nothing to resume.

The recorder reads Claude session ids from the `herdr-session-label` hook, so install the hooks below first.

```sh
mkdir -p ~/.local/bin ~/.cache/herdr-tab-recorder ~/Library/LaunchAgents
cp bin/herdr-tab-recorder ~/.local/bin/
sed "s#__HOME__#$HOME#g" launchd/herdr-tab-recorder.plist.template \
  > ~/Library/LaunchAgents/dev.herdr-config.herdr-tab-recorder.plist
launchctl load ~/Library/LaunchAgents/dev.herdr-config.herdr-tab-recorder.plist
```

To remove it: `launchctl unload` the same file, then delete the plist and `~/.local/bin/herdr-tab-recorder`.

## Claude Code hooks

`hooks/` has two scripts. Both read the hook JSON on stdin, print nothing, and always exit 0, so they can't block a session.

- `herdr-session-label` labels the Herdr terminal with the Claude session id on `SessionStart`. On `SessionEnd` it removes the label if the session ended on purpose. It logs each session end to `~/.cache/herdr-tab-recorder/session-end.log`, and that log is optional.
- `herdr-subagent-hook` records which built-in sub agents are running in which Herdr terminal, so the sidebar can list them. It reads `$HC_TERMINAL_ID`, which Herdr sets, and stores state in `~/.config/herdr-app/data/subagents.json`. It stores only the agent type, never the prompt.

Install them:

```sh
mkdir -p ~/.local/bin
cp hooks/herdr-session-label hooks/herdr-subagent-hook ~/.local/bin/
```

Then add these entries to `~/.claude/settings.json`. If you already have a `hooks` key, merge the events into it rather than replacing it:

```json
{
  "hooks": {
    "SessionStart": [
      { "hooks": [ { "type": "command", "command": "~/.local/bin/herdr-session-label" } ] }
    ],
    "SessionEnd": [
      { "hooks": [ { "type": "command", "command": "~/.local/bin/herdr-session-label end" } ] }
    ],
    "SubagentStart": [
      { "hooks": [ { "type": "command", "command": "~/.local/bin/herdr-subagent-hook" } ] }
    ],
    "SubagentStop": [
      { "hooks": [ { "type": "command", "command": "~/.local/bin/herdr-subagent-hook" } ] }
    ]
  }
}
```

Both scripts need `python3` on `PATH`. They only work inside a Herdr terminal. Outside Herdr they do nothing.

## Dependencies

| Item | Needs | Notes |
|---|---|---|
| `layouts/example.json` | Built-in mods: `workspace-chrome`, `spaces-agents`, `tabs-live`, `workspace-status`, `usage-status`, `files`, `changes`, `pane`. Plus `resume-banner` from this repo. | Check each folder exists in `~/.config/herdr-app/mods`. |
| `mods/resume-banner` | `~/.local/bin/herdr-tab-recorder` (from `bin/`) and its LaunchAgent; `top` (macOS), `python3` | Renders nothing until the recorder has something to resume. |
| `bin/herdr-tab-recorder` | `python3`; macOS `top -l`; `claude` on `PATH` for resumed Claude tabs; LaunchAgent from `launchd/` | Writes its history and logs under `~/.cache/herdr-tab-recorder`. |
| `mods/workspace-status-quiet` | Built-in `workspace-status` | A plain clone with the hint removed. Reinstall it after Herdr updates `workspace-status`. |
| `keys.json` | None | Bindings for shipped commands. |
| `contrib/spectra/spectra-status` | Claude Code with a status line that prints `v<version> <8-hex session id>`; `hc`; an OpenSpec project (`openspec/changes/`) | Reads Claude's transcripts under `~/.claude/projects`. Shows nothing without a Claude session. |
| `hooks/herdr-session-label` | `python3`; Claude Code hooks (entries above); runs inside a Herdr terminal |
| `hooks/herdr-subagent-hook` | `python3`; Claude Code hooks (entries above); runs inside a Herdr terminal; `$HC_TERMINAL_ID` set by Herdr |
| `contrib/spectra/spectra-panel` | The `spectra` CLI on `PATH`; `sh`; VS Code's `code` command (falls back to `open -a "Visual Studio Code"`) | Shows only inside an OpenSpec project. Clicks open `tasks.md` in VS Code. |

## Licence

MIT. See [LICENSE](LICENSE).
