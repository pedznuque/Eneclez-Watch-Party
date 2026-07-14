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

## Build A Windows Installer

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

## Windows SmartScreen

Until the app is code-signed, Windows may show an "Unknown publisher" warning. That is expected for unsigned Electron apps. A code-signing certificate is required to remove that warning for a public release.
