# 1846 two-player regular play and ending

Complete the two-player variant after public distribution. Requirements come from
[GMT's two-player variant](https://gmtwebsiteassets.s3-us-west-2.amazonaws.com/1846/1846_2P_VARIANT-FINAL.pdf)
and the pinned `g_1846/game.rb` and `step/buy_train.rb`: start SR1 with Priority
Deal, restart regular OR numbering at one, limit ownership to 70% and certificates
to 19 (16 after an active corporation closes), place removed-company second tokens
on green upgrades, supply four final certificates, relax compulsory purchasing
when the final depot including bank resales is empty, prohibit purchasing another
corporation's last train then, and end after the next full OR pair when the last
new final certificate is bought. A bank break can end the game sooner. Erie is the
reference's immediate-placement exception, already implemented during setup.

## Family survey

Revisited every recorded value/profile for ownership-limits, certificate-counting,
station-placement/blocking, train-acquisition/limits, mandatory-train-purchase,
train-retirement and end-triggers/timing in the full research trait catalog.
Ownership ceilings range from 50% through 200%; certificate systems include no
limit, market exemptions, weighted assets and map-dependent limits. Stations include
home, connected, remote and inherited placement; reservations usually preserve
capacity without blocking, but some titles block single-slot cities or whole tiles.
Trains include purchases, leases, operating power, finite supply, unlimited final
types, exchanges and deferred retirement. End timing includes immediate, current
round/operation/set and additional sets; no map/train mechanism is also recorded.
Unverified profiles remain evidence gaps, not absent behavior.

1830/1889 home reservations and TOP's ownership/ending differences rule out universal
1846 policies. 1817's additional ending rounds depend on the triggering OR and
include acquisition activity. 1860 nationalization is a separate process. This
slice does not model those procedures through 1846's green-upgrade or last-train
rules. It composes existing rule policies and shared mechanisms instead.

## State and procedure

Finishing public purchases enters StockRound directly, activates Priority Deal and
clears the completed preliminary operating set. The existing stock-round identity
is already SR1. Ordinary StartOperatingSet then starts regular OR1.1 and preserves
the existing ascending-price first-OR order. No prototype terminal state remains.
Ownership/certificate differences stay in StockRules1846.

Removed corporations carry a second Station with a stable `:blocking` identity.
An available station represents its pending placement; its printed destination is
title catalog data. No extra optional state fields or duplicated pending list is
introduced. Ordinary/private construction share the existing afterLay hook: a green
upgrade places the pending station into a free slot. Yellow lays leave it pending;
later upgrades preserve its existing position through ordinary migration. Available
blockers are not reservations and consume no capacity before green. NYC's home
placement uses the first unoccupied slot, preserving its guaranteed reservation
beside Erie's initial blocker.

TrainDepot gains named supply variants: optional static count overrides selected
by the existing inventory depotId. Variants share train definitions and paired
certificate faces. Creating a variant inventory materializes its finite certificates;
remaining/offers/purchase/validation consistently use that identity. Three-to-five
players retain the default unlimited final supply. No per-state supply override or
second duplicated 1846 depot/rules object is needed. The same facility supports
other titles' fixed setup variants without assuming any player-count rule.

TrainRules1846 owns the empty-depot purchase obligation; TransferRules1846 owns the
last-train sale restriction. Returned bank trains reopen the obligation/restriction
window; they do not replenish new certificate supply. EndingRules1846 detects
exhaustion of the four new final certificates, independently of resales. Existing
ScheduleGameEnd/EndGame Actions record and resolve it. Shared pendingEnding now
accepts a strictly earlier final operating set, allowing bank exhaustion to shorten
an already scheduled last-train ending while never postponing an earlier ending.

## UI and compatibility

The playground continues from public purchases into existing stock/operating views.
Pending blockers appear as labelled city markers and become station tokens on green;
the depot displays the actual final certificate count. History/Undo use canonical
state and existing session action gates. No new transient interaction, automatic
client action or animation is introduced. Map drawing's marker input is narrowed
to the location/kind fields it reads, allowing non-private markers without inventing
private ownership. Existing marker values remain structurally compatible.

No host bridge/API contract changes. 1846 logic and UI must be published together
when released; other titles can adopt shared library changes on their next ordinary
publication. No coordinated Site Frontend release is needed. Nothing is published
by this slice. Unreleased development saves from the opening-only prototype are
not migrated.

## Verification

Canonical tests cover initial and post-preliminary stock handoffs, first/second OR
ordering, actual seventh-share purchases/eighth-share rejection, both certificate
limit reductions, NYC's blocked home, green placement and later station migration,
paired final faces, empty-depot exemptions and returned-bank trains, protected last
seller trains, last-certificate purchases in either OR, bank-break precedence, final
results, full replay and Undo. Shared depot tests compare variant and default
inventories, deterministic identities, returned trains and inventory validation.

Validation: all 968 shared-engine/five-title/map-drawing tests pass. Logic and UI
builds, touched lint, strict new-suite typing, shared UI and playground checks pass.
Native browser verification covers a fresh two-player game, mandatory first buy,
preliminary OR1.1/1.2 and resumption, final purchase into SR1, Undo across that
handoff, read-only History, a corporation launch and regular OR1.1. The board
shows four final certificates and both pending blocker labels. No browser errors
were recorded during this flow; restarting the stopped playground restored
automation. The playground remains running on port 4188.
