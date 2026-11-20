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
