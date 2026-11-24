# Webtor native playback handoff

Included in desktop v1.0.20.

Select Webtor, choose a file in the lower browser and start it with Webtor's
Stream button. Browsing a file alone does not load the upper player. Once the
browser has decoded playback, it reports the canonical selected-file page
through `__WATCH_PARTY_VIDEO_SELECTED__`. The existing
`handleBrowserVideoSelection` flow, also used by YouTube and Bilibili, loads it
in the upper media player. Existing host/controller and queue behavior applies.
Hidden codec-probe videos are excluded from detection and from movie selection.

The lower preview is muted, paused and hidden after handoff. The upper view
loads its own provider page and submits its own native first-party Stream form.
Forms stay in their existing webview; POST bodies, session tokens and temporary
media URLs are not copied between players or broadcast to the room. The runtime
remembers only the canonical file URL across the native POST navigation.

The app owns the visible playback controls. Webtor's duplicate bar, title/share
buttons and play overlay are hidden while its video and caption renderer remain
native. A page-local `watchPartyPlayer` adapter uses `data-duration` for full
movie length and `data-run-offset` for movie position. App seeks dispatch the
provider progress slider's pointer sequence, so Webtor performs its normal
transcoder restart and subtitle offset changes instead of seeking beyond the
current segment directly. Pause, resume, volume and room sync use that adapter.

The on-screen **Subtitles** button belongs to the app, outside the provider view.
Its language choices activate Webtor's native subtitle handlers, including lazy
sidecar loading and embedded subtitle changes. **More subtitle settings** opens
the native dialog. Off and locked choices are respected; each viewer chooses
their own subtitles. Quality remains provider-managed.

Each viewer uses Webtor separately. Sharing requires an updated room server;
the hosted server needs deployment before friends receive Webtor links. Login,
bandwidth, codec and provider availability limits still apply.

Validation:

- `npm test` checks remaining provider/torrent/room behavior and URL validation.
- `npm run test:ui` exercises real native Stream POSTs and decoded video in both
  webviews. It confirms no handoff on metadata browsing, exact-file handoff on
  playback, and a paused/muted lower preview, using a local protocol fixture.
  It also checks a 600-second movie with a 30-second segment, native seeking
  beyond that segment, pause/resume, volume, actual subtitle-button clicks,
  loaded WebVTT cues and Off.
- `npm run test:ui -- --live-webtor` additionally checks the full handoff against
  Webtor's public Sintel demo. It requires network access.

## v1.0.21 guest playback recovery

Room heartbeats leave an already playing session alone. Buffered corrections
seek locally; small unbuffered drift uses gentle playback-rate correction.
Large jumps use native session seeking with a cooldown for periodic drift.
Empty `data-transfer-seeking` attributes still represent an active seek.

Native provider dialogs, including the grace prompt, remain visible and
interactive. Synchronization waits for the viewer to answer provider prompts.
A robot-check page is reported as awaiting verification and never automatically
resubmitted while the check is showing. Each viewer may need to complete
Webtor's own verification; the app does not bypass it.

Validated with 46 tests, including nine simulated minutes of guest heartbeats,
and full Electron UI checks covering native prompts and verification recovery.

## v1.0.22 unexpected pause recovery

A native pause with Play still requested is reported as recovering, so the
periodic room broadcaster does not convert it into a room pause command.
After 1.5 seconds, decoded and playable video gets a resume attempt, at most
three attempts ten seconds apart. A deliberate pause, native seek, provider
recovery card, verification dialog, exhausted segment or media error prevents
automatic resume. Native media errors and recovery status remain visible.
An exhausted partial stream is buffering rather than the end of the movie.

Validated with 50 tests, including an accelerated 25-minute session, and
Electron UI checks for unexpected pause recovery. This does not establish the
cause of a particular live provider interruption around twenty minutes.

## v1.0.23 native speed popup clicks

The generic ready-player CSS disabled pointer events with greater specificity
than the Webtor exception. The exception now outranks that rule. Native speed
popup X and Continue buttons receive real mouse input after playback is ready.

The regression reproduces the unclickable X before the CSS fix, then clicks X
and Continue using Chromium mouse input in the full Electron app, both normally
and in fullscreen. This replaces the earlier programmatic-only dialog click.
