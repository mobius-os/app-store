# App Store

The in-Möbius browser for discovering, installing, and updating
Möbius mini-apps. Lives at `github.com/mobius-os/app-store`.

## What it is

A Möbius mini-app whose job is to install other Möbius mini-apps.
It pulls a curated catalog from the `mobius-os` organization and
can also install any public manifest URL — paste the URL, preview
the manifest, confirm permissions, install.

The store is meta: it's an app whose `Install` button hits the
atomic `POST /api/apps/install` endpoint with a manifest URL or
manifest preview. The backend fetches the entry file, compiles it,
seeds storage, uploads the icon, writes the editable source tree,
and registers any cron schedule as one transaction.

## How it's installed

The first time a Möbius container boots, the entrypoint script
clones `github.com/mobius-os/app-store` and installs it via the
standard manifest install path — same code path users will trigger
from inside the store later. After that bootstrap, the store can
update itself + install any number of community apps.

See Möbius ticket 061 for the bootstrap details.

## The curated catalog

The default catalog is a hardcoded list of `mobius-os/app-*` repos
in `constants.js`. Browse renders immediately from generated manifest
snapshots, then refreshes installed-app status in the background. Install and
update actions always send the live `manifest_url` to the backend, so a
snapshot is never treated as install authority.

### Naming convention

Manifest `id` == repo name minus the `app-` prefix == lowercased display name; renames set `previous_id` so installs migrate in place rather than duplicating.

### Adding a new curated app

1. Publish your app as `mobius-os/app-<id>` (public, MIT or
   compatible). Repo must contain a valid `mobius.json` per
   [the manifest spec](https://github.com/mobius-os/mobius-os.github.io/blob/main/spec/manifest.md).
2. Add the entry to `CATALOG` in `constants.js` and `catalog.json`.
3. Run `npm run refresh-catalog` to validate every live manifest and refresh
   the baked first-paint snapshots.

If you don't want PR-curation, that's fine too — anyone can install
your app from a `mobius.json` URL using the **From URL** tab,
no PR required.

### Publishing an app update

Shipping a new version of an app that's already in the catalog is
just a repo push — you never touch this repo:

1. Push your changes to the app repo (`mobius-os/app-<id>`).
2. Bump the `version` in that repo's own `mobius.json`. That version
   is human-facing: it's what the store shows on the card and in the
   `Update to vX` button.

Update detection is git-native: the backend compares each installed repo's
actual content with upstream, so an update can surface even when the version
string did not move. The snapshots keep first paint fast and resilient; refresh
them when publishing Store changes, but app installation and updating still
resolve the live manifest URL at click time.

## Permissions

The store requests only `manage_apps: true` so it can install
apps. It does **not** request `cross_app_access` — seeding storage
into a newly-installed app's own scope is done server-side by the
installer, so the store never needs cross-app write. It also does
not request `share_with_apps` (other apps cannot read the store's
storage).

## License

MIT — see [LICENSE](LICENSE).
