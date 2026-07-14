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
