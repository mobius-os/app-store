# App Store product direction

## Promise

Help one Möbius owner discover, trust, install, update, review, and publish apps
without turning the Store into a developer dashboard.

## Experience

- Calm editorial marketplace: strong app imagery, concise promises, and dense
  lists that are easy to scan.
- Native to the Möbius workspace: keep Browse, Library, and Publish; do not add
  a second navigation rail inside the app.
- One clear action per app and honest installed/update/setup state.
- Spotlight is a discovery lens, never a separate catalog. Highlighted apps
  remain present in their ordinary categories.
- Loading and refresh states must preserve layout. Background work may update
  accessibility status without inserting fleeting visible rows.

## Responsive behavior

- Desktop uses one cinematic spotlight and two-column editorial app rows.
- Phone keeps the same hierarchy in one column with full-width controls and
  no clipped or horizontal document layout.
- Motion is user-driven; Spotlight never auto-advances.

## Editorial content

Spotlight order and artwork come from the hosted Möbius editorial feed and can
be published independently from app code by an explicitly authorized Store
editor. Artwork is immutable and content-addressed; every feed change creates a
new edition. The checked-in selection remains the offline fallback.

Ratings belong to one linked identity and app while retaining the exact
installed revision used. Written reviews are public under the connected GitHub
identity and stay attached to that exact revision.
