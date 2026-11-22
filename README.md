# herdr-config

Example configuration for the [Herdr](https://herdr.dev) desktop app: a layout, a
keymap, and a few mods. Copy what you want into `~/.config/herdr-app`.

The Herdr app runs on macOS, Linux, and Windows. The helper scripts in this repo (`bin/`, `hooks/`, `launchd/`, and the `resume-banner` setup) are macOS-only: they use `open`, `pbcopy`, `top -l`, and launchd.

## Requirements

`settings.json` has no sounds. Herdr's default sounds are used. To add your own, set `sounds` to `enabled`, `done`, and `blocked` paths. The win98 sounds are part of Herdr, not this repo.

To use `layouts/shawn-style.json`, also copy `contrib/spectra/*` into `~/.config/herdr-app/mods/`, and set `layouts/shawn-style.json` as the active layout. `settings.json` overwrites your settings, so merge it instead if you have your own.


- **Herdr app 0.1.16 or later** (tested on 0.1.16). Herdr runs on macOS, Linux, and Windows, but the helper scripts below are macOS-only.
- **Claude Code**, for the hooks, usage cache, and Spectra mods.
- **`python3`**, for the hooks and `herdr-tab-recorder`.
- **`jq`**, for the usage cache writer command.
- **`ccstatusline` 2.2.34** (tested), for the status line and the usage cache writer. See [Status line](#status-line-ccstatusline). Without the usage cache writer, the usage bar stays hidden.
- **`showdir`**, the path helper in `ccstatusline/`.
- **`hc`** (herdr-core's CLI), used by `spectra-status`.
- Optional: the **`spectra` CLI** and VS Code's **`code`** command, for `spectra-panel`.

## What's included

| Path | What it is |
|---|---|
| `layouts/shawn-style.json` | The author's full layout. It needs the `contrib/spectra` mods, `needs-you`, `usage-status-tolerant`, and the usage cache. Copy it only if you want that exact setup. |
| `layouts/example.json` | An example layout. It uses the mods in this repo plus a few built-in ones. |
| `keys.json` | Example keymap. Global and terminal bindings, plus the `layout:example` section for the spaces-agents sidebar. |
| `mods/spaces-agents/` | Left sidebar: spaces and their agents, with state age and memory per space. Shows sub agents when `hooks/herdr-subagent-hook` is installed. |
| `mods/tabs-live/` | Top tab strip with window controls. |
| `mods/usage-status/` | Bottom-bar Claude usage (5-hour and weekly) and service status. Needs the usage cache writer in [Usage cache](#usage-cache). |
| `mods/closed-tabs/` | `cmd-shift-t` list of recently closed tabs. Reads the history written by `bin/herdr-tab-recorder`. |
| `mods/workspace-status-quiet/` | A copy of the built-in `workspace-status` mod with the "⌘⇧P commands" hint removed. |
| `contrib/spectra/` | Optional mods for projects that use Spectra (OpenSpec) changes. See its dependencies below. |
| `mods/resume-banner/` | A bottom banner that offers to resume Claude sessions after a reboot. Needs `bin/herdr-tab-recorder`. |
| `bin/herdr-tab-recorder` | Remembers recently closed Herdr tabs and runs `resume-all` after a reboot. Runs as a LaunchAgent. |
| `launchd/` | LaunchAgent template for `herdr-tab-recorder`. |
| `ccstatusline/` | Status bar settings, the `showdir` helper, and the Claude Code entries for `ccstatusline`. |
| `settings.json` | Appearance: theme `dracula`, dark mode, MesloLGS NF 16, zoom 0.9. Sounds are left out (see the README). |
| `themes/dracula.json` | The Dracula theme, with state colors for `working`, `done`, and `blocked`. |
| `mods/needs-you/` | Right-edge drawer for agents that need you. Used by `shawn-style.json`. |
| `mods/usage-status-tolerant/` | Bottom-bar usage with a tolerant cache reader. Used by `shawn-style.json`. Needs the usage cache. |
| `hooks/` | Two Claude Code hooks that connect Claude sessions to Herdr terminals. Optional, but `spaces-agents` shows no sub agents without the subagent hook. |

## Setup

1. Copy the layout and mods:
   ```sh
   cp layouts/example.json ~/.config/herdr-app/layouts/
   cp -r mods/* ~/.config/herdr-app/mods/
   ```
2. Merge the keymap. If you have no `~/.config/herdr-app/keys.json` yet, copy it. If you do, add the `layout:example` section and any global bindings you want to your existing file.
3. Switch to the layout in Herdr with `cmd-shift-l`, or open the layout menu.
4. Check the install:
   ```sh
   herdr-app status          # "errors" should be []
   for m in ~/.config/herdr-app/mods/*/; do herdr-app check "$m"; done
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

## Usage cache

`mods/usage-status` only reads `~/.cache/claude-rate-limits.json`. Something has to write it. Claude Code sends `rate_limits` in each status line update, so a ccstatusline `custom-command` item can save it. Add this item to your ccstatusline config, with its output empty so nothing shows:

```sh
f="$HOME/.cache/claude-rate-limits.json"; jq -ec 'select(.rate_limits != null) | {rate_limits, ts: (now|floor)}' > "$f.$$" 2>/dev/null && mv "$f.$$" "$f" || rm -f "$f.$$"
```

The file is only rewritten while a Claude Code session is drawing its status line. The mod shows the age of the data and turns yellow when it is old. Without the file, the usage part stays hidden.

## Status line (ccstatusline)

`ccstatusline/` has a one-line status bar for Claude Code, with the project path, git state, model and effort, context, cache hit rate, version, session id, and the usage cache writer. Tested with `ccstatusline` 2.2.34.

1. Install `ccstatusline` (tested version 2.2.34):
   ```sh
   npm install -g ccstatusline@2.2.34
   ```
2. Install the `showdir` helper, which prints the project path:
   ```sh
   cp ccstatusline/showdir ~/.local/bin/showdir && chmod 755 ~/.local/bin/showdir
   ```
3. Copy the settings. The `cache-keepalive` item uses a path that you need to set. Either clone [agent-plugins](https://github.com/shdennlin/agent-plugins) and replace `<agent-plugins>` with its path, or delete that item from the file.
   ```sh
   mkdir -p ~/.config/ccstatusline && cp ccstatusline/settings.json ~/.config/ccstatusline/settings.json
   ```
4. Add these entries to `~/.claude/settings.json`. Merge them into any existing `hooks` key:

```json
{
  "statusLine": {
    "type": "command",
    "command": "ccstatusline",
    "padding": 0,
    "refreshInterval": 30
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Skill",
        "hooks": [
          {
            "type": "command",
            "command": "ccstatusline --hook"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "ccstatusline --hook"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "ccstatusline --hook"
          }
        ]
      }
    ]
  }
}
```

5. Start a Claude Code session. The status bar should show within a few seconds.

The usage writer item in `settings.json` is the one described in [Usage cache](#usage-cache).

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
| `layouts/example.json` | Built-in mods: `workspace-chrome`, `files`, `changes`. From this repo: `spaces-agents`, `tabs-live`, `usage-status`, `resume-banner`, `workspace-status-quiet`. The sidebar is a fixed 189 px (`resizable` is off in the layout). | Check each folder exists in `~/.config/herdr-app/mods`. |
| `mods/spaces-agents` | `hooks/herdr-subagent-hook` (for sub agents); `ps` | Not confirmed as a stock Herdr mod. Check it after install. |
| `mods/tabs-live` | Built-in `files`, `changes`, `pane` (icons it loads) | Not confirmed as a stock Herdr mod. Check it after install. |
| `ccstatusline/` | `ccstatusline` 2.2.34, `showdir` in `~/.local/bin`, `jq`; optional `agent-plugins` clone for the `cache-keepalive` item | Your status line; copy to `~/.config/ccstatusline`. |
| `mods/usage-status` | A ccstatusline `custom-command` writing `~/.cache/claude-rate-limits.json` (see [Usage cache](#usage-cache)); `ccstatusline` on `PATH` | Hides the usage part when the cache is missing. |
| `mods/closed-tabs` | `bin/herdr-tab-recorder` running; `~/.cache/herdr-tab-recorder` history | Shows nothing when there is no history. |
| `mods/resume-banner` | `~/.local/bin/herdr-tab-recorder` (from `bin/`) and its LaunchAgent; `top` (macOS), `python3` | Renders nothing until the recorder has something to resume. |
| `bin/herdr-tab-recorder` | `python3`; macOS `top -l`; `claude` on `PATH` for resumed Claude tabs; LaunchAgent from `launchd/` | Writes its history and logs under `~/.cache/herdr-tab-recorder`. |
| `mods/workspace-status-quiet` | None beyond itself | Derived copy of the built-in `workspace-status` under Apache-2.0 (see its `LICENSE`), with the hint removed. It doesn't update when Herdr updates `workspace-status`. |
| `keys.json` | None | Bindings for shipped commands. |
| `contrib/spectra/spectra-status` | Claude Code with a status line that prints `v<version> <8-hex session id>`; `hc`; an OpenSpec project (`openspec/changes/`) | Reads Claude's transcripts under `~/.claude/projects`. Shows nothing without a Claude session. |
| `hooks/herdr-session-label` | `python3`; Claude Code hooks (entries above); runs inside a Herdr terminal |
| `hooks/herdr-subagent-hook` | `python3`; Claude Code hooks (entries above); runs inside a Herdr terminal; `$HC_TERMINAL_ID` set by Herdr |
| `contrib/spectra/spectra-panel` | The `spectra` CLI on `PATH`; `sh`; VS Code's `code` command (falls back to `open -a "Visual Studio Code"`) | Shows only inside an OpenSpec project. Clicks open `tasks.md` in VS Code. |

## Licence

Code in this repo is MIT (see [LICENSE](LICENSE)), except `mods/workspace-status-quiet`. That mod is derived from the built-in `workspace-status` mod in [herdrdev/herdr-app](https://github.com/herdrdev/herdr-app), which is Apache-2.0. Its copy of the license and its attribution header are in the mod's folder.
