# Standalone Windows torrent-engine comparison

Tested locally on 19 November 2026. Watch Party still uses its existing engine;
no engine was replaced, bundled, pushed, or released by this experiment.

## What is installed

Official Windows x64 binaries are kept outside the app under the gitignored
`.tools/torrent-engines` directory:

- TorrServer **MatriX.150**, SHA-256 checked against its GitHub release asset.
- Cloud Torrent **0.10.0-rc.5**, a prerelease. Its compressed release asset is
  SHA-256 checked, and the extracted executable is checked against that archive.

Sources: [TorrServer MatriX.150 release](https://github.com/YouROK/TorrServer/releases/tag/MatriX.150),
[Cloud Torrent prerelease](https://github.com/jpillora/cloud-torrent/releases/tag/v0.10.0-rc.5).
The newer TorrServer Silo rewrite was excluded: its
[version-specific README](https://github.com/YouROK/TorrServer/blob/Silo.2/README.md)
describes it as unfinished and directs users to the working project.

## Results

The comparison generated a 30-second H.264/AAC video of approximately 15.2 MB,
seeded it through one local TCP peer, and used a private local HTTP tracker.
The seeder was capped at 2 MiB/s with its token bucket warmed equally. All cache
directories were fresh per run. Returned bytes were verified by SHA-256, and
a later HTTP Range request checked seeking into the downloaded file.

| Engine | Repeated runs | Whole-transfer rate | First streamed bytes | Cached seek |
| --- | --- | --- | --- | --- |
| Current Watch Party engine | 3/3 passed | 2.32, 2.39, 2.39 MB/s | 285, 96, 92 ms | 103, 36, 21 ms |
| TorrServer MatriX.150 | 2/3 passed; one 45-second startup timeout | 2.25, 2.39 MB/s in successful runs | 290, 97 ms | 15, 14 ms |
| Cloud Torrent 0.10.0-rc.5 partial-file endpoint | Failed read-ahead integrity check | Not comparable | Not used as a replacement | Not accepted |

Initial startup/configuration experiments are also retained in the local logs.
TorrServer subsequently streamed and served Range requests correctly, but the
repeated test still had a run that found no active peer and stalled. The cause
has not been isolated. This is not proof that TorrServer stalls on public torrents.

The Cloud Torrent download route exposed the `.part` file while it was still
being downloaded. Reading that file ahead of available pieces returned bytes
that did not match the source video. The completed file in an earlier run did
match. This finding concerns the tested prerelease's direct partial-file path;
it does not establish that every Cloud Torrent version or playback method fails.

MB/s values above can slightly exceed 2 MiB/s over a short transfer because of
the seeder's initial token-bucket burst. These are local rate-limited integrity
checks, not maximum-throughput or public-swarm benchmarks. The generated files
vary slightly between separate script invocations. They do not establish that
either engine will improve a slow internet torrent with different peers.

Conclusion: keep the current app engine while testing TorrServer separately on
the actual user's connection. No clear download-speed advantage was demonstrated.
The tested standard TorrServer binary also needs compatible playback codecs or
an external conversion layer; it is not wired into our app's FFmpeg/subtitle
and room-control flows. A backend replacement would require that integration
and its own regression checks.

## Try TorrServer separately

From the repository root in PowerShell:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/setup-torrent-engines.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/start-torrent-engine.ps1
```

The execution-policy option applies only to this PowerShell process; it does
not change Windows' saved execution policy. It allows these local setup scripts
to run on machines that disable unsigned script files by default.

Open **http://127.0.0.1:8095**. The launcher prints the specific process ID and
a command to stop that instance. It starts hidden and binds the web interface
only to localhost. It does not enable remote access, firewall rules, scheduled
startup, or app integration. Its private settings are under
`.tools/torrent-engines/interactive/TorrServer` and do not alter Watch Party.
The launcher was smoke-tested for HTTP readiness and then stopped.

For the separate Cloud Torrent prerelease, use `-Engine CloudTorrent` on both
scripts, and optionally `-Port 8096` when launching. Treat its partial-file
playback path as experimental given the integrity failure above.

## Repeat the controlled comparison

Install the existing `client` dependencies, then run from the repository root:

```powershell
node scripts/test-torrent-engines.cjs --engine=current --rounds=3
node scripts/test-torrent-engines.cjs --engine=torrserver --rounds=3
node scripts/test-torrent-engines.cjs --engine=cloud-torrent
```

Run one comparison at a time for cleaner measurements. The optional `all` mode
runs all three engines. A candidate's integrity failure or timeout gives a
nonzero exit code and an error in its result rather than a misleading speed.
Test processes are stopped in `finally` blocks. Generated video, isolated
configurations, logs, and `results.json` remain in the gitignored
`.tools/torrent-engines/runs/<timestamp>` directory for inspection. No public
movie torrent is downloaded by the comparison.
