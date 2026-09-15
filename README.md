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

The default catalog is a hardcoded list of `mobius-os/app-*` repos in
`constants.js`. Browse renders immediately from generated manifest snapshots,
then refreshes the live discovery index and each app manifest in the
background. The remote `catalog.json` never embeds version-coupled manifests,
so publishing an app release does not require an App Store catalog change.
Install and update actions always send the live `manifest_url` to the backend,
so a snapshot is never treated as install authority.

Browse cards use the catalog's concise discovery summary when available and
fall back to the manifest description. Summaries are capped at 52 characters
on a word boundary; the complete manifest description remains in app details.
Catalog entries can declare a curated `collection`: **Everyday**, **Create**,
**Explore & learn**, **Play**, or **Build & run Möbius**. Entries without one
fall back to their audience and categories, so new apps still land somewhere
sensible.

### Package identity and moves

Generate one random UUID when an app is first published and keep it in the
manifest as `package_id` for the app's lifetime. Display names, manifest `id`,
source paths, and repository names may then change without becoming identity.

A GitHub rename or owner transfer keeps the same provider repository identity,
so keeping `package_id` is sufficient. Moving the app into a different
repository is an explicit trust handoff: release the old trusted manifest once
with the same `package_id` and `moved_to.manifest_url` naming the new manifest.
Existing installs update from the old source first, then the backend verifies
that declaration before adopting the new repository. A fork that is meant to
be a separate app gets a new package id.

`previous_id`, `previous_manifest_url`, and catalog `previous_repositories`
remain bounded migration aids for installs that predate package identities;
they are not the steady-state identity model.

### Adding a new curated app

1. Publish your app as `mobius-os/app-<id>` (public, MIT or
   compatible). Repo must contain a valid `mobius.json` per
   [the manifest spec](https://github.com/mobius-os/mobius-os.github.io/blob/main/spec/manifest.md).
2. Add the entry to `CATALOG` in `constants.js` and `catalog.json`.
3. Run `npm run refresh-catalog` to validate every live manifest and refresh
   the baked first-paint snapshots. This never writes manifests into the remote
   discovery index.

If you don't want PR-curation, that's fine too — anyone can install
your app from a `mobius.json` URL using the **From URL** tab,
no PR required.

### Publishing an app update

Shipping a new version of an app that's already in the catalog is
just a repo push — you never touch this repo:

1. Push your changes to the app repo (`mobius-os/app-<id>`).
2. Optionally update the `version` in that repo's own `mobius.json`. It is a
   human-facing release label, not an update authority.

Update detection is source-native: the backend compares each installed repo's
actual source with its recorded upstream revision, preserving a clean merge
base when local changes exist. A content change surfaces even when the version
string does not move, while a local version bump cannot hide or manufacture an
update. The detail view shows the short source revision and the last successful
verification time. The snapshots keep first paint fast and resilient; refresh
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

### Fresh community discovery

Browse quietly revalidates community listings every minute while visible and
online, and on focus/reconnection. Refresh preserves the loaded page window;
failed refreshes retain the last successful listings. Query changes cancel
old requests. Catalogue refresh never navigates or replaces an open detail.

Spotlight stays first, followed by Our picks, New arrivals, and the existing
categories. All previews use the same compact two-row horizontal shelf (up to
eight entries). See all opens a separate collection view using the host's
reversible navigation; Back restores home and shelf scroll positions. App
details return to their owning collection. Further community pages can be
loaded inside the collection view. Empty searches retain the collection Back.
Publication dates, not revision updates, determine New arrivals order. Entries
without a known publication date remain in the ordinary catalogue.

Library uses compact rows grouped into Needs attention, Updates available, and
Installed apps. Existing setup, permission review, conflict resolution, and
update controls remain authoritative; grouping does not bypass any action.

Publisher labels come from each app's repository identity, not a community
feedback submitter. Kanban's curated entry points to mobius-os/app-kanban
and retains its verified original publication date. Its explicit
previous_repositories marker prevents the stale remote catalogue from reverting
to the retired personal source; unrelated future remote source changes still
win normally. The older community listing is not relabeled or merged across
repository identities. This changes catalogue source metadata, not the community registry. Remove the retired-source marker once stale catalogues no longer
advertise that source.

Verification: contract/design/evidence reviewed at the owning catalogue seam;
no new shell mechanism. Regression tests cover date
ordering, author normalization, refresh cadence, pagination, atomic failure,
visibility, offline and cleanup.

Store typography uses the theme foreground (white in dark mode), not purple accent
text. Discovery links use underlines on hover, and shelf arrows use outlines;
accent button fills and keyboard focus remain intact. Styling stays in theme.js.
