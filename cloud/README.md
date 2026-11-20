# Shared cloud cache

Status: implemented and tested locally. No cloud server has been purchased or
deployed, and these changes have not been published as an app update.

The desktop Torrent panel now offers **On this device** and **Shared cloud
cache**. Cloud mode shares a magnet/file selection marked `wpCloud=1`; each
viewer asks the room server for a stream from the same worker. One torrent
engine caches source pieces on the worker's disk. Each viewer keeps independent
playback, audio conversion, subtitle selection, and seek state. The first uncached
download still depends on available peers. Cached bytes can stream without peers.
No third-party subscription or cloud-provider credentials are included.

## Getting a server

1. Create an account with a VPS provider, add billing, and create an Ubuntu server
   near your viewers. A Singapore location is a reasonable starting point for
   viewers in the Philippines; test latency from the actual viewers.
2. Start with at least 2 GB RAM and enough disk for the cache plus the operating
   system and Docker images. Allow CPU headroom for H.264/AAC conversion per
   viewer. Multiple conversions may require several CPU cores. A small server
   is a test starting point, not a guarantee of smooth multi-viewer transcoding.
3. Install Docker Engine and its Compose plugin using
   [Docker's Ubuntu instructions](https://docs.docker.com/engine/install/ubuntu/).
4. Copy this repository to the server and point a domain such as
   `cache.example.com` at it. Put an HTTPS reverse proxy in front of local port
   3100. Proxy buffering should be disabled for streaming; allow long responses
   and preserve HTTP Range requests. The Docker service binds only to localhost.

For example, install Caddy using its [official instructions](https://caddyserver.com/docs/install),
copy `cloud/Caddyfile.example` to `/etc/caddy/Caddyfile`, and replace the example
domain with yours. Allow inbound TCP ports 80/443 for HTTPS and certificate
issuance while retaining your SSH access. Allow outbound TCP/UDP for peer and DHT
discovery. Validate and reload Caddy:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

The sample uses a short positive flush interval for streamed responses; see
[Caddy's reverse-proxy documentation](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy).

For a price reference, DigitalOcean lists a 2 GB RAM / 1 vCPU / 50 GB disk Basic
Droplet at $12/month on its [pricing page](https://www.digitalocean.com/pricing/droplets).
Review current pricing, bandwidth allowances, and service terms before purchase.
No purchase is required to test the integration on your computer. Render's
[free services](https://render.com/docs/free) use ephemeral storage; they are not
a durable torrent cache.

## Start the worker with Docker

From the repository root, copy `cloud/cache.env.example` to `cloud/cache.env`.
Replace its key with a random secret, e.g. generate one using:

```bash
openssl rand -hex 32
```

Set `CLOUD_CACHE_PUBLIC_URL` to the HTTPS origin your friends can reach. Start:

```bash
docker compose --env-file cloud/cache.env -f cloud/compose.yml up -d --build
```

This creates a persistent Docker volume at `/cache`. Do not use `down -v` if
you want to keep downloaded pieces. The sample limits the worker to three
torrents and 30 GiB of declared source sizes, including all files in a torrent.
Use a lower limit on a smaller disk. Idle caches expire after 60 minutes;
requests and active streams keep them alive. Random stream links expire with
their cache entry. Restarting retains cached files and quota reservations, but
viewers must prepare a new stream link. Interrupted unregistered caches are
removed on startup. Stop/restart does not guarantee that a partially downloaded
file can play without peers.

The worker strips supplied web-seed, metadata, and tracker URLs from magnets;
it discovers public peers through DHT.
Cloud mode currently accepts magnet links, not uploaded `.torrent` files.
Text subtitles and compatibility video are streamed, not saved as extra movies.

## Connect the room server

Set these environment variables on the room server (Render environment settings
or your own Node server), using the same key as the worker:

```text
CLOUD_CACHE_URL=https://cache.example.com
CLOUD_CACHE_PUBLIC_URL=https://cache.example.com
CLOUD_CACHE_KEY=<the-worker-secret>
```

Restart/deploy the updated room server. Do not put the key in desktop settings,
chat, a magnet link, or a public file. The desktop receives only expiring stream
URLs; provisioning is authenticated between the room server and worker. Hosts
and granted controllers can prepare new cloud torrents. Guests can prepare only
the cloud torrent/file currently shared in their room. Disconnect cloud closes
the panel connection; it does not stop friends' streams or delete the cache.

Install a desktop build containing this integration on every viewer's computer.
Choose Torrent > Stream from > Shared cloud cache, paste a magnet, find videos,
then Play in room. An unconfigured room server shows an actionable error; it
never silently starts local downloads instead.

## Local development without Docker or a hosting account

Install both sets of dependencies (`npm ci` in `client` and `server`). From the
repository root, start the worker in a PowerShell terminal:

```powershell
$env:CLOUD_CACHE_KEY='<a-random-secret-at-least-32-characters>'
$env:CLOUD_CACHE_PUBLIC_URL='http://localhost:3100'
node server/cloud-worker.cjs
```

In a second terminal, start the room server with the same key:

```powershell
$env:CLOUD_CACHE_KEY='<the-same-secret>'
$env:CLOUD_CACHE_URL='http://localhost:3100'
$env:CLOUD_CACHE_PUBLIC_URL='http://localhost:3100'
node server/server.js
```

In a third terminal, run the desktop against that room server:

```powershell
cd client
$env:WATCH_PARTY_SERVER_URL='http://localhost:3000'
$env:ELECTRON_RUN_AS_NODE=$null
npm.cmd start
```

`localhost` works only on this computer. Testing with friends requires reachable
worker and room-server addresses. Hosting the worker on your own PC is possible,
but your upload speed then limits the combined video streams.

## Verification

From `client`, `npm test` covers cache reuse by two HTTP readers after the only
local seeder disconnects, cloud authorization, storage limits, idle eviction,
asset routing, and room permissions. `npm run test:cloud` runs two hidden Electron
viewers against one shared worker after disconnecting the seeder, checking
decoded video and E-AC3-to-AAC audio, captions, pause, seek, and resume.
`npm run test:ui` checks cloud selection and recovery when no worker is configured.
Tests use generated videos and local peers; public swarm performance and the
Docker image require validation on the chosen server.
