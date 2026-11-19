# BillBharat — Update Plan (for later)

Status: **planned, not built.** Nothing in this file is active yet.

## Goal

Let each user update BillBharat from inside the app, without losing their books.

## Recommended approach

**GitHub Releases**, published from a **public** repository that holds only the installers.

- Each release is one upload: the installer and its update file.
- The app checks the public release page, shows **Update available**, and installs when the user clicks it.
- No server to run, and the hosting is free.

## Decisions still open

1. **Where the releases live:**
   - Option A (preferred): a separate public repo that holds only installers, e.g. `Jay-patel15/BillBharat-releases`. The source code repo can stay private.
   - Option B: make the current repo `Jay-patel15/Bill-Bharat` public.
2. **Access token:** create a GitHub token on the build PC only, for publishing. Never store it in the code.
3. **Code signing:** not decided. Unsigned builds show a Windows SmartScreen warning on first install. A certificate removes that warning and costs money.

## What to build (when approved)

- `electron-updater` added to the app, so it can check for and install updates.
- **Check for updates** button in Settings, plus a quiet check when the app starts.
- A prompt: **Download and restart** or **Later**.
- A `npm run release` command that builds the installer and uploads it to GitHub.
- A clear message when offline: the app still works; only the update check is skipped.

## Important facts

- **Data is safe:** updates do not touch `%APPDATA%\BillBharat`. Before each update the app saves a backup, and database changes run in order and roll back if they fail.
- **Each PC has its own books.** Nothing is shared between PCs. Several people editing the same books would need a different design, which is not built.
- **Repository visibility:** a private repo cannot serve updates to users. Only the public release location is used by the app.
- **One manual step:** users on a version from before the update feature install the first update by hand. Every later version updates from inside the app.

## How a release is done (after building)

1. Raise the version number in `package.json`.
2. Run `npm run release`.
3. Check that the new release appears on GitHub.
4. Users see **Update available** the next time they open the app.

## Before releasing any update

- Ask users to back up first (File → Open Backups Folder).
- Run `npm run check` and the build.
- Test the installer on one PC with existing data.
