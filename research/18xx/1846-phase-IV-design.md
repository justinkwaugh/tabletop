# 1846 Phase IV trains and construction

Add unlimited 6 ($800) / 7/8 ($900) certificates and the complete gray supply.
Either train face starts Phase IV. Remaining 2s disappear immediately; owned
3/5s and 4s phase out after their next route step, do not count toward the two-train
limit, and cannot be traded. Unowned Phase II trains disappear immediately.
Revenue markers and special corporation reservations expire; corporate Mail,
unfloated home reservations, and special station prices/remote placement survive.
Game-ending triggers and two-player play remain later slices.

## Evidence and family boundaries

Primary sources: GMT 2021 §§6.42–6.48, 6.53, 6.64, 6.82–6.86, 9 and train chart;
pinned `g_1846/game.rb` phases, train definitions and events, `g_1846/entities.rb`
reservation abilities (removed in IV, unlike home coordinates), and `g_1846/map.rb`
gray 290/300 plus `config/tile.rb` gray 51. Gray cities upgrade revenue without
adding exits: 51 pays $50 with two slots, Z 290 $70 with three, Chicago 300 has
four distinct $90 cities. Supply is 2/1/1 respectively.

Surveyed all scoped assignments for train-retirement (193), train-limits (148),
train-acquisition (294), fleet-route-constraints (165), station-placement (331),
station-blocking (277), construction-allowance (320), upgrade-preservation (135),
and tile-supply (179). Counts are assignments, not titles. Profiles cover immediate
rust, obsolescence, final operation, maintenance/wounded/persistent equipment,
phase/company-form limits and exclusions, ordinary and remote stations, home and
special reservations, absent mechanisms, finite/unlimited/paired tile supplies,
and different construction allowances. Unverified profiles remain evidence gaps.
The existing Phase III and brown construction notes supply the detailed survey
and primary counterexamples: 1889's immediate rust and fixed certificate face,
1848's 2E limit exclusions, 1822's company forms, 1830's metropolis upgrades.
These differences preclude universalizing 1846's lifecycle or reservation rules.

## Design

Reuse shared PhaseTable for ordered progression, colors and train limits, replacing
separate 1846 conditionals. TrainDepot already supports unlimited supply and
alternate faces; shared purchase, retirement, discards and continuation own the
procedure. 1846 owns express paying-stop counts and lifecycle effects. Special
reservations are released independently of rights defined in station policy.
The existing title reservation removal helper shares removal bookkeeping for
private closures and the Phase IV special locations.

Add standard gray tile 51 to the shared catalog using the existing city-face
builder. No new state fields or shared engine mechanisms are needed. Phase action metadata
records removed revenue markers alongside removed reservations/trains. The existing
history summary renders this metadata and Undo restores the complete state.
Gray choices use the ordinary construction session path and shared tile renderer;
Chicago reuses its four-city layout. Existing inventory identities remain stable.

## Verification

Exercise both train faces, unlimited IDs, pre-purchase limits, interrupt/resume
and receiver/emergency purchases; immediate and deferred retirement including an
empty final run; reservation release without loss of station rights or home
protection; marker removal with Mail surviving; 7/8 scoring including station,
East–West and Mail bonuses; gray supply, phase gates, preserved track/stations,
ordinary allowance and canonical replay/Undo. Inspect title depot and gray tiles
in the playground; distinguish browser rendering checks from engine scenarios.
