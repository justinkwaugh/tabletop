# Track construction

## Evidence and scope

This slice surveys all recorded profiles in the 131-title family corpus. The eight
relevant traits have assignments for 128 profiles; three remain evidence gaps.
The survey covers construction usefulness (128 assignments), allowances (320),
upgrade preservation (135), tile supply (179), destructive map changes (135),
construction connectivity (147), station blocking (277), and network types (151).
The domain study's construction/access sections and title-trait assignments were
read together. Profiles without construction are retained as not applicable.

Variations include permissive, restrictive, city-specific and ordinary
new-track-or-city-value tests; multiple lays, extra fees and construction points;
finite/unlimited/paired stock; city mergers and future reservations; track removal;
gauge, lanes, feeders and water networks; and remote or concession construction.
1858's future station rights, 18Cuba's paired faces, 1849's gauge and earthquake,
and 1822/1846's unlimited track challenge universal assumptions. These distinctions
are considered without implementing every option in the first two consumers.

Primary title evidence is the supplied TOP prototype §§7.2 and 12 and Shikoku
1889 §§8.3–8.3.2, 9 and 16. The local research implementation clarifies TOP's
phase-color sequence, normal stop preservation and straight-tile private right.
It supplies rule facts only; the implementation here is original and uses this
repository's TypeBox, runtime, settlement, tiles, maps and staged-selection modules.

Both titles ordinarily preserve track and stop structure. TOP permits two yellow
lays, the second costing $20, or one upgrade. Its X/T/CX labels and straight-tile
right remain title policy. 1889 permits one lay or upgrade, with a home-hex
exception to station connectivity. Both reject exits off-map or into incompatible
fixed geography. 1889 may point into an incompatible upgradeable tile.

TOP's supplied prototype expressly states that all tiles are piece limited; the
recorded title manifest is also finite. This slice retains that edition's stock.
The user's earlier possible unlimited #7/#8 distinction remains unresolved and
must be settled against the intended edition before changing supply policy.

## Shared modules and title policy

TrackConstruction evaluates a requested hex, definition, rotation and node mapping.
Its result includes cost, physical piece exchange and migrated stations/reservations.
Choices and authoritative Actions call the same evaluator. Serialized requests
carry semantic identities and expected cost; no rendering coordinates or previews
are authoritative. RailwayMapState and Common hex neighbors remain the geography
source. TileSet owns finite and paired physical identities and return behavior.

The topology utility enumerates mappings and preserves each path through junctions
without turning a crossing into a junction or silently routing through another
revenue stop. It can represent city mergers; the two title policies require equal
stop counts. Station slots are retained where possible, otherwise assigned the
first free slot deterministically; insufficient capacity rejects the replacement.
Reservations survive independently of current empty capacity.

TrackNetwork is explicitly for ordinary construction on the current
single-gauge, single-lane model. It starts at company stations, traverses individual
paths, requires matching boundary endpoints, and stops at filled rival cities.
Untokenable cities do not act as filled station barriers. It evaluates the candidate
track and migrated slots for usefulness. This does not declare train-route or
station-placement legality. Gauge/lane networks need their corresponding model
and purpose policy before those titles become consumers.

Title policies supply phase colors, color order, stop constraints, allowance and
extra fees, private restrictions, home locations and the usefulness predicate.
Terrain/face costs and first border crossings are calculated separately from the
lay fee. Printed terrain is charged when first covered; a face's upgrade cost is
charged when that face is replaced. Shared settlement transfers company cash to
Bank. Future unlimited supply, special transformations, construction points and
destructive events need explicit policies rather than bypassing these checks.

Private powers that add decisions remain later slices. Ordinary construction
respects their restrictions now: 1889's blocked private hexes and port tile; TOP's
straight yellow tile and bridge consent. A bridge owner's own explicit build
provides their consent; another owner's consent flow is still deferred.

## Runtime and prototype

LayTile and FinishTrack are player Actions in LayingTrack. StartOperatingTurn is a
system consequence after operating-set initialization and assigns the first
company's controlling player. FinishTrack completes construction and now enters the
station step added in slice 8; it does not skip missing operating steps or claim complete
operating rounds. Empty operating orders remain at the operating-set boundary.

The Track construction fixture starts directly in that step, with green available
and prepared stations/track so lays, terrain costs and upgrades can be exercised.
It is not an initial setup. The normal stock examples also advance into construction.
Fixture version 9 preserves earlier saved examples.

Map preview, target emphasis and selection remain local to the Game Session.
The shared renderer accepts semantic target IDs and a preview location; the host
supplies the hypothetical drawing and migrated overlays. No mutation occurs before
confirmation. The prototype uses staged location, tile and placement selection;
only a single remaining placement is auto-selected. Back unwinds manual choices.
Undo clears a manual draft first, then reverses the committed Action. History and
visible-state publication hide drafts; beforeNewState clears them. Persistent map
inspection, player style and viewport behavior remain separate.

## Verification

Tests cover preservation and crossings, rotations, slot/reservation migration,
station blocking, private restrictions, labels, phase colors, home construction,
finite/paired supply, costs, allowances, actor checks, deterministic replay and Undo.
Desktop browser checks cover preview/confirm, Back, Undo, history and reload for
both titles. No mobile refinement is required for the disposable prototype.

Verification completed: 120 family logic tests, 10 shared UI tests, 90 harness
tests (including 43 title integration tests), and six desktop browser checks passed. Logic/UI package builds
and shared/title UI plus harness Svelte checks passed. Visual inspection covered
TOP's yellow-track preview and 1889's enlarged city-upgrade preview. Paired-face
replacement also verifies one-piece conservation and migration to renamed city
nodes. No research-source references were introduced into implementation or tests.

## Hex-edge traversal correction

Reviewing the slice 20 TOP end map exposed an illegal O17 upgrade from #7 to #30:
PEIR could reach the existing curve, but using the added branch required reversing
at their shared hex edge. TrackNetwork treated every reached endpoint as a place
from which to explore all incident paths, incorrectly making that edge a junction.
Traversal now distinguishes entering a tile from leaving it. An exit crosses to
the neighboring tile; it cannot turn onto another path in the same tile. Entering
through a shared edge still permits either branch, and cities and explicit
junctions still connect their incident paths. Incoming and outgoing visits are
tracked separately so an independently reachable approach is not lost.

The construction-usefulness, construction-connectivity, network-types and
station-blocking assignments were surveyed again across all 128 covered profiles
of the 131-title corpus. Permissive, semi-restrictive, restrictive, city-specific,
and station-specific usefulness policies remain separate from this topology fix.
1858's purpose-specific connectivity, 1849's gauges, the lane variants and 18Cuba's
station policy retain the boundaries described above; this correction adds no
new gauge, lane, concession or routing policy. Both initial consumers share the
single-rail traversal correction. Profiles without construction do not acquire
this requirement.

Regression checks cover a branch that can only be reached by reversing at an
edge, a valid approach through the shared edge, existing crossing isolation and
city blocking, and rejection of the O17 upgrade by TOP's construction choices
and authoritative LayTile Action. The captured pre-upgrade state from processed
action 311 also rejects the original request after the correction. The earlier
end-map screenshot represents the run before this fix.

After the correction, all 146 shared family tests, 280 harness tests (including
both normal full-game runs with replay and Undo), and six construction/station/route
browser tests passed. Family TypeScript and harness Svelte/TypeScript checks passed.
