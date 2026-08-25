# Game Distribution

Game Distribution owns Game Title discovery and the site’s selection of versioned Logic and UI Artifacts. Hosted Games follow the current Publication for their Game Title rather than pinning artifact versions.

## Catalog

**Game Title**:
The stable catalog identity of a supported game. Hosted Game Instances reference a Game Title independently of its currently published artifacts.
_Avoid_: Game package, Game type, Title release

**Catalog Entry**:
A lightweight, non-executable discovery description of a Game Title, including its presentation metadata and availability. It can be consumed without loading title-specific executable code.
_Avoid_: Game definition, UI definition

**Beta**:
An expectation-setting maturity label for a Game Title. It is not an access-control or resource-authorization boundary.
_Avoid_: Restricted, prerelease entitlement

**Beta Catalog Visibility Grant**:
The grant that exposes Beta Game Titles to an Active Account in catalog discovery. It does not authorize access to a Game or confer administrative authority.
_Avoid_: Beta entitlement, Beta access role

## Artifacts and Publication

**Logic Artifact**:
An immutable, versioned server deployment of a Game Title’s Game Runtime.
_Avoid_: Rules release, backend game

**UI Artifact**:
An immutable, versioned client module containing a Game Title’s UI and an embedded Game Runtime.
_Avoid_: Frontend release, presentation artifact

**Publication**:
The site’s current selection of one Logic Artifact and one compatible UI Artifact for a Game Title. A Hosted Game uses its Game Title’s current Publication.
_Avoid_: Game Title Release, deployment

**Logic-changing Publication**:
A Publication change that selects both a new Logic Artifact and a new UI Artifact embedding that logic. Logic cannot be published without a matching UI Artifact.
_Avoid_: Logic-only Publication

**UI-only Publication**:
A Publication change that selects a new UI Artifact while retaining the current Logic Artifact. The new UI Artifact embeds the unchanged logic.

**Unavailable Publication**:
A Publication whose selected artifacts cannot currently be served. Its failure does not make unrelated Game Titles unavailable.

**Publication Validation**:
Proof that the artifacts required by a proposed Publication exist, load, identify the expected Game Title and versions, and form a valid selection. A failed validation leaves the previous Publication current.

## Configuration

**Configuration Definition**:
The Game Title-owned meanings, value domains, defaults, dependencies, and compatibility rules for Game Configuration. It is loaded with the selected title capability rather than being part of catalog discovery.
_Avoid_: Catalog configuration, form schema

## Compatibility

**Operational Compatibility**:
The requirement that the current Logic Artifact can load a surviving Hosted Game’s latest canonical State and continue play. It does not promise forward History Navigation, replay, or Fork compatibility with earlier logic.
_Avoid_: Deterministic replay compatibility

**Loaded Client Compatibility**:
The guarantee that an already-loaded client containing an older minor or patch Logic version can continue against a newer server in the same major line. A major mismatch requires the client to reload.

**Logic Rollback**:
Selection of an earlier Logic Artifact after a newer one was published. Once newer logic has processed canonical State, rollback requires explicit reverse State compatibility; otherwise recovery proceeds through a forward-fix Publication.
