# App Store

The in-Möbius browser for discovering, installing, and updating
Möbius mini-apps. Lives at `github.com/mobius-os/app-store`.

## What it is

A Möbius mini-app whose job is to install other Möbius mini-apps.
It pulls a curated catalog from the `mobius-os` organization and
can also install any public manifest URL — paste the URL, preview
the manifest, confirm permissions, install.

The store is meta: it's an app whose `Install` button hits
`POST /api/apps/` with another app's `jsx_source`, seeds storage
from the target's `storage_seeds`, uploads its icon, and (where
supported) records the requested cron schedule.

## How it's installed

The first time a Möbius container boots, the entrypoint script
clones `github.com/mobius-os/app-store` and installs it via the
standard manifest install path — same code path users will trigger
from inside the store later. After that bootstrap, the store can
update itself + install any number of community apps.

See Möbius ticket 061 for the bootstrap details.

## The curated catalog

The default catalog is a hardcoded list of `mobius-os/app-*` repos
in `index.jsx`'s `CATALOG` constant. On Browse-view mount, the
store fetches each entry's `mobius.json` from `raw.githubusercontent.com`
and displays live name/description/version straight from the repo.

### Adding a new curated app

1. Publish your app as `mobius-os/app-<id>` (public, MIT or
   compatible). Repo must contain a valid `mobius.json` per
   [the manifest spec](https://github.com/mobius-os/mobius-os.github.io/blob/main/spec/manifest.md).
2. Submit a PR to this repo adding an entry to `CATALOG` in
   `index.jsx`.

If you don't want PR-curation, that's fine too — anyone can install
your app from a `mobius.json` URL using the **From URL** tab,
no PR required.

## Permissions

The store requests `cross_app_access: "write"` so it can seed
storage data into newly-installed apps' scopes during install.
It does not request `share_with_apps` (other apps cannot read
the store's storage).

## License

MIT — see [LICENSE](LICENSE).
