// resume-banner: after a reboot / core restart, shows "N claude sessions to resume" and a click
// runs `herdr-tab-recorder resume-all`. Renders nothing when there is nothing to resume, so the
// floating block costs no screen space (same idea as needs-you).
//
// "Is there anything to resume?" = `resume-all --dry-run` printed at least one "would send" line.
// That is a handful of cheap `hc get` calls, so it is only asked once a minute, right after
// start, and right after a resume.

import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { exec, theme, home } from "herdr";

const CHECK_EVERY_MS = 60_000;

export default class ResumeBanner extends View {
  init(_props, cx) {
    this.recorder = `${home()}/.local/bin/herdr-tab-recorder`;
    this.pending = 0;
    this.busy = false;
    cx.timer.every(CHECK_EVERY_MS, (cx) => this.check(cx));
    this.check(cx);
  }

  check(cx) {
    if (this.busy) return;
    cx.spawn(async (cx) => {
      let n = 0;
      try {
        const r = await exec(this.recorder, ["resume-all", "--dry-run"], { timeout: 20_000 });
        n = (r.stdout.match(/^would send/gm) || []).length;
      } catch (_e) {
        n = 0; // recorder missing or Herdr not readable: show nothing rather than a false alarm
      }
      if (n !== this.pending) { this.pending = n; cx.notify(); }
    });
  }

  resume(cx) {
    if (this.busy) return;
    this.busy = true;
    cx.notify();
    cx.spawn(async (cx) => {
      try {
        await exec(this.recorder, ["resume-all"], { timeout: 600_000 });
      } catch (_e) { /* the dry-run check below shows what is still left */ }
      this.busy = false;
      this.pending = 0;
      cx.notify();
      this.check(cx);
    });
  }

  render(_cx) {
    if (!this.busy && !this.pending) return div(); // nothing to resume: no size, nothing drawn
    const t = theme();
    const text = this.busy ? "Resuming claude sessions…" : `↻ Resume ${this.pending} claude session${this.pending > 1 ? "s" : ""}`;
    return h_flex().id("resume-banner").px(12).py(6).m(6).rounded(8).items_center()
      .bg(this.busy ? t.raised : t.blocked).text_color(this.busy ? t.muted : t.chrome)
      .text_size(12).font_semibold()
      .hover((s) => s.bg(t.raised))
      .on_click((_e, cx) => this.resume(cx))
      .child(text);
  }
}
