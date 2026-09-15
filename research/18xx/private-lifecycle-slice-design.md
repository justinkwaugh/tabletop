# Private exchanges and lifecycle

Surveyed all recorded title profiles for power families (464 assignments, 130
titles), power lifecycle (680/130), stock action order (131/130), and event
application (362/130). Read the domain study's ownership, stock transactions,
powers, and interruptions sections. Relevant counterexamples include 1830's
Mohawk & Hudson exchange between turns, 1858's network and presidential approval
requirements, repeated construction abilities, persistent assets in 1822CA and
18Ardennes, and titles without exchange powers. The associated primary procedures
were inspected for timing, eligibility, and ownership consequences. These are
requirements evidence, not implementation templates.

Primary paired evidence: TOP rulebook §§6.2, 6.5, 11.3, 14 and production 1889
rulebook §§8.7–8.8, 15. The 1889 production rules implementation clarifies Dôgo's
any-turn window and exemption from a purchase's certificate-limit precheck.
TOP's implementation clarifies Ice Boats' own-stock-turn timing and additional
stock action. The older TOP book explicitly grants the enduring ownership-limit
exception to the three reserved Shortline exchanges. This slice keeps Ice Boats
subject to the ordinary ownership limit; the broader exception in the contextual
implementation is not silently adopted. Its four-player restriction is enforced.
King's Mail closes at 4+ with the other privates, or earlier if PEIR closes;
Union Bank stays open. This corrects the earlier King's Mail exception per the
confirmed title rule. Concessions close when their railway first operates or at 4+.

Use the existing private Company and ownership Certificate, closure flag, mutable
private income, Certificate Pools, exchangeCertificate, presidency settlement,
flotation, and ownership-limit exemptions. Closure expresses consumption for the
single-use exchanges here; no parallel power inventory or unused generic counters.
PrivateRules supplies eligible target certificate identities, timing, stock-turn
consequences, ownership-limit treatment, phase effects, and operation effects.
Only close, income change, and exchange effects exist. Consent, connected-network
exchanges, recurring powers, and formation-by-exchange need explicit later
procedures instead of increasingly general effect records.

ExchangePrivate is a player Action. Evaluation projects the exchange and presidency
on copied finances. The application closes the private, transfers the share,
settles presidency, and records any allowed ownership exemption. It never spends
cash or consumes the ordinary purchase. TOP records an additional stock action,
invalidating that owner's retained pass; Dôgo leaves pass history and the ordinary
turn untouched. An exchange may trigger the existing FloatCompany System Action.
An ordinary share is eligible for Dôgo before Iyo starts; this does not itself
start the railway or establish a presidency.

PrivateExchangeHandler composes ordinary decision handlers. The first active
player retains the ordinary decision; additional active owners can only exchange.
Automatic flotation takes precedence. No optional exchange interrupts compulsory
train discards, phase application, or other automatic work. The original company
and turn remain intact, including across an out-of-turn Dôgo exchange. If that
exchange changes the operating railway's president, the new controlling owner
receives subsequent decisions for the same operating company.

AdvancePhase records and applies private effects before resuming compulsory
discards or train purchases. TOP 4+ exchanges still-open reserved rights in MC, VR, SB order and
closes other expiring privates; unused Ice Boats closes without a share. In 1889,
phase 5 closes privates except player-owned Uno-Takamatsu, whose income becomes 50. Its phase-based prohibition on sale requires no separate transfer flag;
negotiated private transfers integrate this in slice 14. Concession closures are
recorded in DistributeEarnings when their company operates. Existing private income
payment and map restrictions read these authoritative company facts.

Four-player Private exchanges and Private phase effects fixtures show Ice Boats
and Uno-Takamatsu with their correct player-count eligibility. They are prepared
states, not complete game setup. Mainline/Shortline remain the fixture's existing
company roles. Prototype cards show owner, income, available exchanges and closure;
phase history lists the applied effects. Ordinary turn controls retain their
operator while an out-of-turn exchange is offered. In local hotseat only, selecting
an explicitly named owner's exchange authorizes its confirmation; network clients
can submit only their own player's exchange. Components call session methods.
Back clears manual selection; Undo clears manual selection before history undo.
Visible-state transitions and history hide drafts; beforeNewState clears them.

There is no host-bridge contract change. Base GameSession extracts its existing
active-player lookup into a protected method; default ordering is unchanged. The
example session overrides that method to order activePlayers by the game's decision order so optional actors cannot
silently replace the ordinary hotseat actor. The protected method is bundled with its callers, so older/newer host and UI
combinations require no host capability change. TOP and 1889 Logic/UI Artifacts would
need matching publication to adopt the new rules. Prototype saves use version 20;
old prepared histories are not migrated.

Slice 14 still owns construction/ferry power execution, consent, Hunslet purchases,
and removal of an unused construction tile when its right expires. Slice 13 closes
the associated company, so the existing permission check already forbids further
use. Full auction/setup, final valuation, and game endings remain their planned
slices. No title imports are introduced into shared libraries.

Verification: 139 shared logic tests, six title tests, and 157 harness tests pass.
Focused exchange, stock-round and share-purchase suites also pass after the final
rule adjustments. Thirteen game browser checks cover private exchanges, phase
changes and earnings; 47 shared-client unit tests and 15 shared-session browser
checks cover the active-player customization. All affected package builds and four
18xx Svelte checks pass. Visual inspection verifies the four-player cards and
preserved ordinary operator. Lifecycle tests also verify Takamatsu's map restriction
is removed on private closure and that privates receive no railway stations.
