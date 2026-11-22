// Usage + Claude status, shown once in the bottom bar instead of in every session's status line.
//
// 5h / weekly usage: ~/.cache/claude-rate-limits.json, which this mod only READS. Something has to write it from
//   the `rate_limits` Claude Code puts in the status line JSON (account-wide, live). Each window is read on its own,
//   an unreadable file keeps the last known values, and with no data yet it shows `5h --  wk --`. One way: a ccstatusline `custom-command` item with an empty output (so nothing shows) and
//       f="$HOME/.cache/claude-rate-limits.json"; jq -ec 'select(.rate_limits != null) | {rate_limits, ts: (now|floor)}' > "$f.$$" 2>/dev/null && mv "$f.$$" "$f" || rm -f "$f.$$"
//   The file is only rewritten while some Claude Code session is drawing its status line, so the age of the data
//   is always shown and goes yellow when it is old.
// Claude status: status.claude.com summary, component "Claude Code". Shown only when NOT operational.
//   A notification is posted only when that status changes (the last one is kept in localStorage, so a
//   hot reload or restart does not repeat it).

import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { theme, notify, home, readTextFile, openOverlay } from "herdr";

const USAGE_FILE = `${home()}/.cache/claude-rate-limits.json`;
const USAGE_EVERY_MS = 30_000;
const STATUS_EVERY_MS = 60_000;
const STALE_MS = 30 * 60_000;
const STATUS_URL = "https://status.claude.com/api/v2/summary.json";
const COMPONENT = "Claude Code";
const LEVEL = { degraded_performance: "warning", under_maintenance: "info", partial_outage: "error", major_outage: "error" };

const minutes = (ms) => Math.max(0, Math.floor(ms / 60_000));
function span(ms) {
  const m = minutes(ms);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}
const pretty = (s) => String(s).replace(/_/g, " ");

// --- pure logic (tested outside Herdr by extracting this block; keep it free of imports) ---
// One window out of the cache file: { pct, reset } or null if that window is missing or malformed.
function parseWindow(w) {
  if (!w || typeof w.used_percentage !== "number" || typeof w.resets_at !== "number") return null;
  if (!Number.isFinite(w.used_percentage) || !Number.isFinite(w.resets_at)) return null;
  return { pct: Math.round(w.used_percentage), reset: w.resets_at * 1000 };
}
// Merge a fresh file read into what we last knew. Each window stands alone; a window or the whole
// file that cannot be read leaves the previous value in place (never blank a reading).
// `text` is null when the file could not be read at all.
function mergeUsage(prev, text) {
  const base = prev || { session: null, weekly: null, mtime: null };
  let j;
  try { j = JSON.parse(text); } catch { return base; }
  if (!j || typeof j !== "object") return base;
  const five = parseWindow(j.rate_limits?.five_hour), week = parseWindow(j.rate_limits?.seven_day);
  if (!five && !week) return base;
  return {
    session: five || base.session,
    weekly: week || base.weekly,
    mtime: typeof j.ts === "number" && Number.isFinite(j.ts) ? j.ts * 1000 : base.mtime,
  };
}
const SESSION_MS = 5 * 3600_000, WEEK_MS = 7 * 24 * 3600_000;
const MIN_ELAPSED = 0.10;   // before this much of the window has passed, a projection is mostly noise
// Linear pace: at the average speed of the whole window so far, how much will be used at reset?
// Evaluated at `asOf` (when the reading was written), not at "now": with an old reading, time keeps moving
// but the percentage does not, so projecting from "now" would drift towards a false "plenty in reserve".
// Returns the projected percent, or null when there is nothing honest to say.
function projectLinear(w, windowMs, asOf) {
  if (!w || asOf >= w.reset) return null;                  // reading belongs to a window that already ended
  const elapsed = (asOf - (w.reset - windowMs)) / windowMs;
  if (!(elapsed >= MIN_ELAPSED)) return null;             // too early (or clock skew: elapsed < 0)
  return Math.round(w.pct / elapsed);
}
const paceTone = (proj, pct) =>
  proj != null ? (proj > 100 ? "bad" : proj > 85 ? "warn" : "norm") : (pct >= 90 ? "bad" : pct >= 75 ? "warn" : "norm");
// Where a perfectly even user would be right now: the share of the window that has passed, 0-100. It follows the
// clock (the white tick on a progress bar), not the reading. Null when the window already ended or `reset` makes no
// sense for this window length. A little slack is allowed because real windows are not always exactly 5h/7d.
const POS_SLACK = 1.25;
function linearPosition(w, windowMs, now) {
  const left = w.reset - now;
  if (!(left > 0) || left > windowMs * POS_SLACK) return null;
  return Math.min(100, Math.max(0, Math.round((1 - left / windowMs) * 100)));
}
// Display parts for one window; a window we have never seen shows "--". `asOf` = when the reading was written.
// `posTag` (e.g. "L"): show the linear position after the percentage, `5h 19% L78%`; without it only `5h 19%`.
// Colour comes from the pace projection evaluated at `asOf` (used above the line = red); the projection itself is not shown.
function windowParts(label, w, now, windowMs, asOf, posTag) {
  if (!w) return [{ text: `${label} --`, tone: "dim" }];
  const left = w.reset - now;
  const proj = left > 0 ? projectLinear(w, windowMs, asOf ?? now) : null;   // past reset: it was the previous window
  const pos = posTag ? linearPosition(w, windowMs, now) : null;
  const out = [{ text: pos != null ? `${label} ${w.pct}% ${posTag}${pos}%` : `${label} ${w.pct}%`, tone: paceTone(proj, w.pct) }];
  // reset time already passed: the percentage belongs to the previous window
  out.push({ text: left > 0 ? `↻${span(left)}` : "↻?", tone: left > 0 ? "dim" : "warn" });
  return out;
}

// --- end pure logic ---

export default class UsageStatus extends View {
  init(_props, cx) {
    this.usage = null;          // { session: {pct,reset}|null, weekly: {pct,reset}|null, mtime }
    this.status = localStorage.getItem("lastStatus");   // last status we told the person about
    this.now = Date.now();
    this.lastKey = "";
    this.loadUsage(cx);
    this.loadStatus(cx);
    cx.timer.every(USAGE_EVERY_MS, (cx) => this.loadUsage(cx));
    cx.timer.every(STATUS_EVERY_MS, (cx) => this.loadStatus(cx));
  }

  loadUsage(cx) {
    cx.spawn(async (cx) => {
      let text = null;
      try { text = await readTextFile(USAGE_FILE); } catch { /* missing file: keep what we have */ }
      this.usage = mergeUsage(this.usage, text);
      this.touch(cx);
    });
  }

  loadStatus(cx) {
    cx.spawn(async (cx) => {
      let s = null;
      try {
        const res = await fetch(STATUS_URL);
        const j = await res.json();
        s = j.components?.find((c) => c.name === COMPONENT)?.status ?? null;
      } catch { return; }          // offline or bad reply: say nothing, keep the last known state
      if (!s) return;
      const prev = this.status;
      this.liveStatus = s;
      if (prev !== s) {
        this.status = s;
        localStorage.setItem("lastStatus", s);
        if (!(prev == null && s === "operational")) {     // first ever run, healthy: just a baseline
          if (s === "operational") notify({ title: "Claude Code is operational again", level: "success", timeout: 8000 });
          else notify({ title: `Claude Code: ${pretty(s)}`, body: "status.claude.com", level: LEVEL[s] ?? "warning", timeout: 15000 });
        }
      }
      this.touch(cx);
    });
  }

  // What is on screen, as plain data, so a redraw happens only when it would look different.
  parts() {
    const now = Date.now();
    const u = this.usage;
    const out = [];
    out.push(...windowParts("5h", u?.session, now, SESSION_MS, u?.mtime, "L"), ...windowParts("wk", u?.weekly, now, WEEK_MS, u?.mtime, "L"));
    if (u?.mtime) {
      const age = now - u.mtime;
      out.push({ text: age > STALE_MS ? `stale ${span(age)}` : `${minutes(age)}m ago`, tone: age > STALE_MS ? "warn" : "dim" });
    }
    const s = this.liveStatus;
    if (s && s !== "operational") out.push({ text: `⚠ ${COMPONENT}: ${pretty(s)}`, tone: s === "degraded_performance" ? "warn" : "bad" });
    return out;
  }

  touch(cx) {
    const key = JSON.stringify(this.parts());
    if (key !== this.lastKey) { this.lastKey = key; cx.notify(); }
  }

  render(cx) {
    const t = theme();
    const color = { norm: t.foreground, dim: t.dim, warn: t.ansi3, bad: t.ansi1 };
    // Click the bar for the usage history window (the usage-history mod); it is a window, so it stays until closed.
    return h_flex().id("usage-bar").size_full().px(14).gap(10).items_center().justify_end().bg(t.chrome).border_t(1).border_color(t.border)
      .text_size(11.8).text_color(t.muted).cursor_pointer().hover((s) => s.bg(t.hover))
      .on_click(() => openOverlay({ mod: "usage-history", kind: "window", key: "usage-history", width: 1400, height: 960 }))
      .children(this.parts().map((p) => div().flex_none().text_color(color[p.tone]).child(p.text)));
  }
}
