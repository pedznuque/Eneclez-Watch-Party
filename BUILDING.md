# Building Eneclez Watch Party

The server is deployed on Render:

```text
https://eneclez-watch-party.onrender.com
```

The desktop app is built from the `client` folder.

## Run Locally

```powershell
cd client
npm.cmd install
npm.cmd start
```

## Torrent Playback (Local Development)

The Torrent button beside Drive accepts BitTorrent magnet links and local
`.torrent` metadata files. Load metadata, select a video, then Play or Queue.
Startup prefetches a small opening window plus end-of-file MP4 metadata as soon
as torrent metadata arrives. Selecting a different file updates that priority.
Videos are not selected wholesale: each HTTP response serves the full requested
byte range using internal torrent readers of at most 4 MiB, with immediate
playback pieces marked critical. This reduces
startup competition from unrelated pieces but cannot create unavailable peers.
Once streaming starts, a rolling window follows the latest byte request,
replacing the startup selections. Read-ahead targets roughly 60 seconds based
on source bitrate (when known) and current download speed, bounded to 16–64 MiB
ahead of the current 4 MiB reader. The default before probing is 30 MiB.
Seeking moves this priority window instead of waiting for old opening pieces.
The HTTP response stays open across those windows so FFmpeg does not mistake a
chunk boundary for the end of the movie. TCP peer connections have no configured
download speed limit and allow up to 100 peer connections. Buffering status shows
seconds buffered and the source's average byte rate when peers cannot keep up.
Transfer rates show KB/s or MB/s together with Mbps (megabits per second).
Each viewer downloads independently from peers; the room shares the magnet and
file index, never a localhost stream address. MP4/WebM with supported codecs are
recommended. Unsupported native decoding (including HEVC 10-bit with AC3/E-AC3)
automatically falls back to bundled FFmpeg H.264/AAC streaming, up to 720p. The
converted stream is piped directly to the player, not saved as another movie.
Compatibility mode uses CPU and may buffer longer. The Subtitles menu inside
the video discovers embedded tracks and chooses English when available; each
viewer can choose another track or Off independently. Embedded text tracks
(SRT/ASS/WebVTT and supported text codecs) stream as timed captions in bounded
two-minute windows, preserving timestamps through seeking. PGS/DVD/DVB bitmap
tracks are burned into the H.264 compatibility stream, including on a native
video that otherwise would not need conversion. Files without embedded subtitle
tracks show that explicitly; external subtitle files are not loaded automatically.
Seeking restarts conversion near the requested position when
the requested timestamp is outside the existing playback buffer.
Play/pause intent and the requested timestamp are preserved during conversion;
room heartbeats wait for buffering/seeking to finish before broadcasting.
The host can grant a guest playback control through People > Allow.
The player displays the current title, including the selected torrent filename.
Fullscreen has a persistent Hide controls / Show controls button and a personal
Keep visible setting. Otherwise controls auto-hide and reappear on activity,
including pointer movement inside native webviews. Explicit Hide stays hidden
until Show is chosen. Hidden controls leave the keyboard tab order; leaving
fullscreen restores the normal controls. Subtitle and fullscreen visibility
preferences do not grant guests permission to change room playback.
The torrent browser has video search, separate peer/download/upload statistics,
and a progress bar for the selected file rather than the whole collection.
Loading, switching files, stopping a pending transfer, and permission updates
keep their controls in sync. The active torrent browser remains available when
the app switches to a compact layout, and it scrolls with the page.
Host/controller buttons refresh after asynchronous torrent preparation assigns
the player URL, so a first torrent load enables play/pause and seeking. Pause
requests also take effect while the player is still buffering metadata.
The torrent player accepts pointer input for its subtitle menu; other embedded
sites keep their existing interaction policy. Subtitle Off remains available
while metadata loads, and failed subtitle discovery provides a retry button.
Use Stop transfer to stop peer downloading/uploading. Closing the room also stops
its transfer. Downloaded pieces remain under the app user-data `torrent-cache`
directory for reuse. Playback quality comes from the selected file, not a quality
conversion service. Seek buffering and metadata availability depend on peers.

The room server must include the torrent-link validation changes to share or
queue torrents. To test without publishing, start `npm.cmd start` in `server`.
In a separate PowerShell terminal, run from `client`:

```powershell
$env:WATCH_PARTY_SERVER_URL='http://localhost:3000'
$env:ELECTRON_RUN_AS_NODE=$null
npm.cmd start
```

Use the same reachable updated server for all viewers. Each client needs this
desktop version. The hosted server and installed app will not gain torrent
support until a new release/deployment is explicitly requested.

Run `npm.cmd test` from `client` to check full HTTP ranges, reader cancellation,
conversion past chunk boundaries, and a real local peer transfer. These checks
use generated data/videos and do not connect to public torrent swarms.
The suite also checks room membership boundaries, duplicate display names,
same-room rejoining, host promotion, stale torrent requests, and temporary
status failures. Room actions require membership in the target room; display
names are unique within a room to keep host/controller identity unambiguous.
`npm.cmd run test:ui` runs the real lobby and room HTML/CSS/preload in hidden
Electron windows. It covers settings error recovery, room creation, chat,
provider-tab navigation, video search/queueing, a real pointer hit on the
embedded subtitle selector, caption language/Off, play/pause/seek/stop, and
desktop/compact layout bounds. Public provider requests are deliberately
blocked to exercise offline recovery; this does not verify logged-in provider
playback. Screenshots are saved under `client/test-artifacts` (gitignored).
`npm.cmd run test:room` opens two hidden local Electron viewers with separate
torrent clients and checks late joining, synchronized pause/seek/resume, guest
control permission, and visible captions on both players. The test uses a local
room server and generated video. The test's temporary Electron cache remains in
the OS temp folder until the process releases it.
Torrent loading now asks the room server for confirmation. If the server does
not acknowledge the shared magnet, chat warns that local playback alone does
not confirm other viewers can watch. No hosted server or installed app is
updated by these local changes.
Sharing also accepts a matching `mediaLoaded` broadcast as confirmation for
servers that accept torrents but omit acknowledgements. It cancels stale
confirmation timers and distinguishes disconnection from a server rejection.
The updated backend advertises support at `/api/capabilities` and through the
`serverCapabilities` socket event. A server that rejects magnets still requires
a backend deployment; restarting or rebuilding the desktop app cannot add that
capability to the hosted backend.

## Build A Windows Installer

WebTorrent's native dependencies use supplied Node-API binaries. `npmRebuild` is
disabled to avoid unnecessary Electron ABI rebuilds requiring Windows C++ tools.
Install dependencies normally so these binaries are present before packaging.

```powershell
cd client
npm.cmd install
npm.cmd run dist
```

The installer will be created in:

```text
client/dist/
```

The expected installer filename is similar to:

```text
Eneclez Watch Party Setup 1.0.0.exe
```

Upload that `.exe` to a GitHub Release so other Windows users can download and install it.

## Downloadable Package From GitHub

GitHub Actions builds the Windows installer automatically.

1. Push changes to `main`, or open the repository on GitHub.
2. Go to `Actions`.
3. Open `Build Windows Installer`.
4. Open the latest successful run.
5. Download the artifact named:

```text
Eneclez-Watch-Party-Windows-Installer
```

That artifact contains the Windows installer `.exe`.

For an official release download page:

1. Go to `Releases` on GitHub.
2. Create a new release tag, for example `v1.0.0`.
3. Publish the release.
4. The workflow attaches the installer `.exe` to that release.

## Windows SmartScreen

Until the app is code-signed, Windows may show an "Unknown publisher" warning. That is expected for unsigned Electron apps. A code-signing certificate is required to remove that warning for a public release.
