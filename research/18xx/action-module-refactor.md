# Auction and funding Action modules

This refactor retains the rule boundaries surveyed across all 130 researched titles
in the [waterfall auction](opening-auction-slice-design.md),
[offer-pile auction](top-opening-auction-slice-design.md), and
[compulsory funding](train-funding-slice-design.md) design notes. Those surveys
cover the Actions, authorization, settlement, and state sequencing affected here.
No auction or funding rule, serialized payload, or title policy changes.

Each Action now owns its schema, raw type, validator, type guard, and hydrated
class in an individual file within its domain directory. Auction handlers and the
terminal bankruptcy handler have separate files. Runtime registration hydrates
individual Action types instead of routing an entire union through one class.

Passing and automatic auction resolution remain shared Actions for the two
implemented opening procedures. A small procedure selector checks the appropriate
machine state and creates the existing auction model using injected rules. It
preserves their different pass meanings and first-stock-round orders. It does not
claim to support sealed auctions, bid boxes, drafts, or composed opening stages;
those distinctions and extension limits remain in the earlier design notes.

Funding Actions share authorization and sale settlement through
`EmergencyTrainFunding`. Treasury issuance and owner sales both record the same
funding sale restrictions after applying the existing financial settlement.
Contribution, funding initiation, and bankruptcy retain separate payloads and
application paths. Loans, refinancing, and corporate assistance remain distinct
future procedures rather than additional branches in a combined Action class.

Existing engine tests verify both opening auctions, funding choices, automatic
resolution, exact replay, and Undo. Browser regression checks verify their Game
Session flows and reload behavior. Action names and schemas remain compatible with
saved positions; rule dependencies remain private hydrated-class fields.
