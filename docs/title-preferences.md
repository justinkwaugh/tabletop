# User preferences for titles and families

A title exports `GameInfo.preferences` with its TypeBox object schema, complete
resolved defaults, schema version, and optional explicit-value migrations. An
optional family descriptor identifies shared preference storage and its schema.
The backend loads this from the title's published Logic Artifact through the
existing Library Service. There is no backend registry of title schemas.

Preferences belong to the authenticated account, independent of Game Instances,
players, actions, undo, and replay. Only explicit choices are persisted. Resolution
is title defaults, then explicit family values, then explicit title overrides.
Unset removes an override and restores inheritance. Migrations run on explicit
values, not resolved defaults. Writes reject unknown keys and incompatible schema
versions while preserving unrelated saved fields.

## API and storage

`GET /api/v1/game/:titleId/preferences` returns explicit title/family records and a
strong ETag. The authenticated account determines access; the client adds an
account query parameter to separate browser cache entries across sign-ins.
`Cache-Control: private, no-cache` permits browser body caching with revalidation.
ETags include the account, scopes, record revisions, and loaded schema versions.

`POST /api/v1/game/:titleId/updateTitlePreferences` requires `If-Match` and a scope, schema version, `set`
object, and `unset` array. Firestore checks both revisions and changes the selected
record in one transaction. Missing preconditions return 428; stale ones return
412. The successful response includes both records and the new ETag, so no extra
GET is needed to reflect a successful write.

Documents live under `users/:userId/preferences/:encodedScope`, using `title:ID`
and `family:ID` scopes. Redis caches only revision numbers. A warm matching
conditional GET reads no Firestore documents. A cold request reads the title and
family together once; their revision tags are filled through the existing guarded
cache path. Conditional checks use `readConsistently`; writes protect and invalidate
both relevant keys with `lockWhileWriting`. A first request after invalidation may
read Firestore to refill the tags. Cache failures or concurrent writers fall back
to a coherent database snapshot, never an unverified 304.

## Session and publication compatibility

A Game Session creates a typed `TitlePreferences` model using its injected API and
actual signed-in account. Controls call `set`/`unset`; no settings page is required.
Changes are optimistic and serialized. A 412 triggers one reload/retry of that
partial change; other failures revert it and surface a toast. Account changes invalidate late responses. Disposal removes observers; queued
saves finish only while the same account remains signed in. Other windows refresh on a broadcast or focus.

The injected API gains optional `getTitlePreferences` and `updateTitlePreferences`
methods. An older host without them keeps the display choice session-local. Older
UI Artifacts simply ignore the additions. No named bridge is added, but these
methods are still covered by ADR 0004's cross-artifact compatibility contract.

Deploy backend support before the new Site Frontend API capability. TOP and 1889
need new Logic and matching UI Publications to expose their preference descriptors
and adopt the persisted control. Other titles need no republication until they
choose to use preferences. This work does not deploy or publish artifacts.

The ordinary dev harness uses the same schemas and mutations with localStorage
and a browser lock for conditional updates. It stores preferences separately from
saved example games. Its fixed developer account is a harness identity, not the
currently acting player. Protected harness APIs without these optional methods
retain the compatible session-local behavior.

## 18xx scope review

The first control is `operatingOrderDisplay: details | tokens`, saved at family
scope `18xx` by default. A title override is supported by the preference model;
there is no new override UI in this slice.

The family review uses the full catalog and trait survey in
`research/18xx-2026-09-08/notes/catalog-a.md`, `catalog-b.md`, `trait-catalog.md`,
`mechanisms-lifecycle.md`, and `shared-domain.md`. Company formation, minor/major
rosters, conversions, subsidiaries, and operating rights vary substantially:
1867's minors convert/merge; 1840 has parent-owned tram operations; 1873 separates
train ownership and operation. Therefore this preference selects presentation of
whatever operating roster the title supplies. It does not prescribe company kind,
round sequence, ordering rules, token art, train capacity, or whether a roster is
shown at all. TOP and 1889 exercise the common presentation preference; absent or
unverified mechanisms in other profiles are not treated as family invariants.

Future board-art or tile-style choices can use this same storage model. They are
not added now, and no physical-art availability assumption is encoded. Families
remain title-declared dependencies; shared libraries do not import games.

## Verification

Common tests cover precedence, unset, validation, migrations, and preservation of
unrelated keys. Service tests cover one cold snapshot read, zero-read warm 304s,
revision-only caching, account/family scopes, conditional conflicts, and guarded
read fallback. Client tests cover HTTP headers, concurrent partial writes, account
changes, rollback, and older hosts. The dev-site browser test verifies the actual
toggle across reload and TOP/1889 transitions.

The experimental `tableTopPercent`, `spreadsheetSplitPercent`, and
`spreadsheetHeightPercent` fields remain accepted for stored-value compatibility,
but no longer control the current layout. Players/History/Chat use the sidebar at
all widths. The tab workspace now saves `paneLayout` at family scope.

`paneLayout` is an opaque versioned JSON value (default null), validated and
normalized by the UI layout decoder rather than tying the Logic schema to one
UI tree format. v1 stores sidebar tab IDs and a recursive rows/cols split tree
with integer percentages and ordered leaf tabs. Unknown future versions remain
untouched on load. Layout writes debounce for five seconds and await persistence
before showing Saved. Existing clients ignore this additional key; updated UIs
need updated Logic schemas to write it. No Site Frontend API change is required.
Local recovery copies are scoped to account/family and include the server baseline
so stale drafts do not replace preferences changed elsewhere.

### Firestore encoding

The Firestore store writes a record's `values` as JSON text and decodes it before
validation or preference resolution. This supports valid JSON values such as the
pane layout's arrays within arrays, which Firestore cannot store directly.
Existing records with a map-valued `values` field remain readable and are converted
on their next write. API payloads and UI preference formats do not change. This
correction needs a backend deployment, not new UI or Logic artifacts. Backend
rollback to a version without this decoder cannot read newly encoded records.
The Firestore integration test requires `FIRESTORE_EMULATOR_HOST` and covers an
actual nested-layout write, readback, and a subsequent unrelated preference edit.
