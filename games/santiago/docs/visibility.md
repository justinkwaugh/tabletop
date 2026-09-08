# Santiago visibility

New protected Games conceal the future tile bag, protected random cursor, and reproduction master seed. The raw bag keeps its canonical array shape; delivery replaces it with an empty array. `remainingTiles` publishes its actual count, which rules and the UI use independently of the concealed contents. Revealed tiles, board fields, canal proposals, sequential bids, payments, income, drought, and final scores stay public.

With `publicMoney: false`, only a balance's owner receives it during play. EndOfGame reveals every balance. Without the option, including missing legacy configuration, money remains public. Visibility uses persisted Game configuration and each historical state's phase. Starting money and public transactions still allow balances to be calculated; this protects direct delivery, not inference. Running scores contain no money until final scoring.

The canonical schema retains required balances. Hydration accepts the derived projected schema and preserves omitted balances. Rule methods require known money; guarded execution falls back to the host for another player's balance, transfers, income, and tile draws. Existing automatic zero-money canal passes remain public consequences of public financial activity. They do not prevent action discovery for the acting player.

## Randomness and reveals

New v3 setup uses protected randomness for tile shuffling and the initial unobserved discard. Public randomness controls the spring, palms, colors, turn order, and initial overseer. The runtime adopts cryptographic master-seed initialization. Drawing from the shuffled array consumes no randomness.

Manual spring placement reveals the first tile offer. Each non-final EndRoundEvent reveals the next offer through entry into Bidding. Both processed Actions carry `revealsInfo` in v3, preserving the information barrier for Undo. The final EndRoundEvent draws no tiles. Action payloads are public; shared history projection rebuilds both patch directions from permitted states.

## Exploration

Public-money Exploration reconstructs the starting tile multiset, removes board tiles (including neutral and dried fields, which preserve original capacity) and the current offer, then samples the unknown setup discard and remaining order using branch randomness. Every drawn tile remains on the board or in the offer during supported play. Missing removals or impossible populations fail explicitly. The population never reads canonical bag contents or source entropy. Three- and four-player games have one unknown setup discard; five-player games have none.

Private-money Exploration is disabled, including Host View, finished Games, and legacy Games configured with private money. The Game Session checks configuration and state; population rejects private-money input. The canonical hook checks the state flag where present. No hypothetical balance reconstruction is provided.

## Compatibility and publication

Unmarked v1/v2 and existing unmarked numeric v3 Games retain canonical delivery. The public count and money configuration mirror are optional in stored state so legacy saves remain valid. For these saves, the hydrated count reads the complete canonical array. Forward play preserves their bag, random cursors, and system version; no migration or reseeding is performed. Legacy v1/v2 setup retains its original single-stream random sequence.

The v2 fixture was captured from the implementation at `7b16babc` before these changes. Tests compare exact initialization and a serialized saved bid continuation, and exercise unmarked numeric v3 continuation. New protected Games require both updated Santiago Logic and UI Artifacts. Use a major Logic version when publishing so already-loaded older Santiago clients reload before consuming projected state. The existing visibility-capable backend and Site Frontend are prerequisites; this change adds no host bridge interface and requires no other game's UI publication. Do not roll a protected Game back to a runtime without visibility registration.

## Verification

Logic conformance covers perspective projection, strict canonical validation, secret randomness, master-seed reproduction, owner action discovery and execution, public bid records, reveal barriers, legal Exploration populations for all player counts, legacy continuation, and complete protected games with reverse/forward projected history. Browser tests cover private/public money, public tile counts, perspective switching, bids, responsive money display, and entering/leaving projected Exploration. These checks use the local harness; they are not a hosted deployment rehearsal.
