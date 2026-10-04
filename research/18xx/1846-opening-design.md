# 1846: setup and private distribution

This first slice implements GMT second-printing rules §§2–3 for 3–5 players,
ending at an explicit first-stock-round handoff. It is not a complete game.
The two-player draft/operating alternation, map/tile construction, stock trading,
private powers, and operating rounds are later slices.

## Evidence and boundaries

Surveyed every assignment of allocation-method (160), allocation-information
(160), actor-order (388), and setup-variation (207) in the full researched catalog,
plus the domain study's allocation section and the existing opening-contract and
opening-auction design notes. Of allocation assignments, 46 are waterfalls, 20
open drafts, seven snake drafts, and only one hidden sampled draft. Ten have no
initial allocation. 1846's two-player option is an open procedure; 18India's
private-hand selection and 18Mag's rotating draft are further counterexamples to
any universal draft order, offer size, payment timing, or information boundary.
1846's draft_distribution and setup in the pinned research snapshot establish
reference behavior; the primary baseline is the [GMT 2021 rulebook](https://gmtwebsiteassets.s3.us-west-2.amazonaws.com/1846/1846-RULES-2021.pdf).

A title-local distribution procedure composes Common's engine, strict schemas,
protected randomness, Owner/Actor visibility, turns, and recorded transitions.
It reuses family financial owners, certificates, cash settlement, stations and
train inventory. No new optional properties enter another title's state. The
full railway runtime is deliberately not used yet: it requires operating and
stock policies outside this slice. This is a bounded opening runtime, extendable
with the remaining feature state and handlers when those features exist.

Blank player cards are draft cards, never companies or financial certificates.
Cards selected during the draft are commitments, not transferred certificates;
public finances stay unchanged until a separate reveal/settlement System Action.
Independent railroads are companies with a single wholly owning certificate,
company cash, a train, and a station, rather than duplicate private/minor entities.
Removed corporations remain closed companies with their blocking home station;
none of their shares or spare stations enter play.

Public setup uses public entropy; hidden initial ordering and recycled packets
use protected entropy. An active offer is stored only in that player's protected
packet, separate from the host-only undealt deck. Selections are owner-private;
Action card IDs are actor-private. The lone final company and its discounted
price are public; their controls coexist with owner-only viewing of earlier
commitments. Public offer visibility must not suppress that private inspection.
Its price cannot fall below the independent's debt; at that
floor the next player takes it automatically. Revealing the next packet or all
purchases is an information barrier. Projected Exploration is intentionally
unavailable until a history-constrained population algorithm exists; it must not
invent a deck inconsistent with previously observed packets.

The handoff records ordinary cash/ownership, independent capital and assets,
public removals and initial clockwise stock priority. Remaining railway features
will compose their own state; this slice does not populate fake operating rules.
A standalone development harness exercises real Game Session actions. It does
not require the existing full-railway scenario harness to accept partial rules.

## Verification

Exercise setup at every supported count; reverse draft order; packet recycling;
blank choices; last-card discounts and mandatory debt payment; full reveal,
independent funding despite discount, money conservation and stock priority.
Reject wrong actors, forged system actions and unavailable cards. Verify strict
canonical and projected hydration, owner/opponent/spectator state and Action
history, protected entropy, deterministic replay and mechanical reversal. UI
must conceal hotseat packets until requested and close them after every action
or history position change. Public completion must not report a finished game.

Verification results: 20 title tests (including 36 complete seeded drafts), plus
20 Common visibility and family cash-settlement tests pass. Logic and UI type
checks, lint, playground checks, and both artifact bundles pass. Browser checks
confirmed creation, private reveal, turn handoff, and read-only History with
packet invalidation. The collaborative preview disconnected during the final
full-draft browser run; protected-view switching and narrow-screen checks remain
unverified in the browser. Their state projection and replay rules have automated
coverage. No publication was performed.
