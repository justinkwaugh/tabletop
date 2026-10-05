# 1846 train trading and cash-funded emergency purchases

Scope: phase-I/II train trades among majors; emergency depot purchases that can
complete with corporate issuance and the president's existing cash. Personal stock
sales, bankruptcy/receivership, returned trains and later phases remain later work.
A shortfall requiring those procedures still blocks finishing the operating turn.

## Evidence and family variation

Surveyed all assignments for `train-acquisition` (294), `emergency-funding-order`
(130), `failure-consequences` (178), `train-limits` (148) and
`mandatory-train-purchase` (128) in the September 8 research package's
`data/title-traits.json`. These are scoped assignments, not counts of distinct
titles. Gaps remain evidence gaps. Negotiated purchases, depot-only purchases,
lease/borrow and power capacity differ. Emergency procedures include owner sales,
issuance before owner money, loans, nationalization, liquidation, and no purchase
obligation. Failure is not invariably a game ending.

Checked local primary implementation evidence: g_1840/game.rb forbids intercompany
trading and emergency share sales, allowing player loans; g_1889/game.rb forbids
emergency buying from other companies; g_1817/game.rb has no mandatory purchase.
Existing TOP funding can involve multiple contributors. The shared emergency
handler's cheapest-train selection and bankruptcy transition do not express
1846's variant choice and continuing corporations after player elimination.

1846 evidence: GMT second-printing rules §§6.31, 6.81–6.89, 7; pinned
`g_1846/game.rb` emergency issuance and `step/buy_train.rb` eligibility/variants.
Trains from other majors cost any agreed positive integer, paid by the buyer's
corporation; independents cannot sell their train separately. Phased-out trains
cannot trade. Treasury issuance first shifts the marker once per share and pays
one further price below that resulting marker for every share. Issuance cannot
move the marker below $20. The normal player-held-minus-market issuance ceiling
still applies. Issue no more than needed for the chosen train, or all permissible
shares when issuance cannot cover the purchase. If any available train is
corporately affordable, owner cash cannot buy the dearer variant. Otherwise either
variant can be bought with the president's contribution.

## Design and boundaries

Train trades reuse PurchaseOfferRequest, purchaseChoices, offer/response Actions,
authority checks, price/treasury validation, seller consent, transfer settlement
and train tradeability/limit checks. 1846 owns the BuyingTrains window, major-only
seller policy and unrestricted price ceiling. Existing acquisition drafts and
Back/Undo lifetime also serve train offers. No additional shared or title state
is needed.

EmergencyBuyTrain is a title Action composing shared TrainPurchase validation,
market movement, cash settlement, applyTrainPurchase and operating-order helpers.
The title's ordinary and emergency issuance use the same corporate certificate
selection and issuance ceiling. Funding choices are calculated per depot variant
and include shares, proceeds and contribution. The Action validates the whole
quote again and commits issuance, contribution and purchase together. Atomicity
prevents issuance proceeds being diverted to another corporation's train or a
private purchase. Metadata records certificates, money and stock movement; the
purchase itself is in the Action payload. Phase changes remain shared system
Actions. No title-optional funding fields are added to family state.

This is deliberately not the full share-liquidation workflow. No irreversible
partial issuance occurs when the president cannot yet cover the shortfall; no
bankruptcy is inferred. Extending to stock sales will require explicit funding
progress and president-sale restrictions, including changed presidencies and
operating order. Returned trains need availability/variant handling when later
phases add discards. Do not treat the present depot-only quote as that future model.

## Verification

Engine tests cover negotiated prices above face, same/different controllers,
refusal/resumption, unauthorized answers, train limits, independent/phased-out
train rejection, treasury-only payment, and replay/Undo. Emergency tests cover
issuance pricing/quantity, market deductions, $20 floor, minimum contributions,
both variants, cheaper-train restrictions before and after issuance, insufficient
cash, forged quotes, phase progression and replay/Undo. Playground buttons expose
the whole quote; trade drafts and accepted purchases retain History/Undo behavior.
