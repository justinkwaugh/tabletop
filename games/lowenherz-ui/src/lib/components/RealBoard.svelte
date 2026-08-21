<script lang="ts">
    import { onMount } from 'svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import type { Color, GameAction } from '@tabletop/common'
    import {
        ALLIANCE_CANCELLATION_COST,
        BOARD_COLS,
        BOARD_ROWS,
        HydratedPlaceCastle,
        isAdvanceResolution,
        isCancelAlliance,
        isDrawActionCard,
        isExpandRegion,
        isNegotiationMove,
        isOnBoard,
        isPlaceWall,
        isPlayRenegadeCard,
        isSubmitDuelBid,
        MachineState,
        type Negotiation,
        NegotiationMoveKind,
        neighbors,
        type SubmitDuelBid,
        squareKey,
        SquareType,
        wallBetween,
        type BoardTileId,
        type Wall
    } from '@tabletop/lowenherz'
    import boardTileA from '$lib/images/board/board-a.jpg'
    import boardTileB from '$lib/images/board/board-b.jpg'
    import boardTileC from '$lib/images/board/board-c.jpg'
    import boardTileD from '$lib/images/board/board-d.jpg'
    import boardTileE from '$lib/images/board/board-e.jpg'
    import boardTileF from '$lib/images/board/board-f.jpg'
    import RampartBorder from './RampartBorder.svelte'
    import RampartCorner from './RampartCorner.svelte'
    import WallSegment from './WallSegment.svelte'
    import PlayerPill from './PlayerPill.svelte'
    import ActionDescription from './ActionDescription.svelte'
    import knightFill from '$lib/images/pieces/knight-fill.png'
    import knightLines from '$lib/images/pieces/knight-lines.png'
    import castleFill from '$lib/images/pieces/castle-fill.png'
    import castleLines from '$lib/images/pieces/castle-lines.png'
    import iconMoneybagFill from '$lib/images/action-cards/icons/icon-moneybag-transparent.png'
    import iconMoneybagLines from '$lib/images/action-cards/icons/icon-moneybag-lines.png'
    import { playerName } from '$lib/model/actionCardHelpers.js'
    import type { KnightPlan } from '$lib/model/session.svelte.js'

    const gameSession = getGameSession()
    // The band kind (border/knight/politics) at a given slot, translated to the noun
    // used in status messages - money-bag slots never reach negotiation or dueling
    // (they always split among every chooser), so 'income' never shows up here.
    function actionNounForSlot(slot: 1 | 2 | 3): string {
        const card = gameSession.gameState.currentActionCard
        if (!card || card.type !== 'standard') return ''
        const band = slot === 1 ? card.top : slot === 2 ? card.middle : card.bottom
        if (band.kind === 'border') return 'walls'
        if (band.kind === 'knight') return 'knights'
        if (band.kind === 'politics') return 'politics'
        return ''
    }
    const negotiationActionNoun = $derived.by(() => {
        const negotiation = gameSession.gameState.negotiation
        return negotiation ? actionNounForSlot(negotiation.slot) : ''
    })
    const duelActionNoun = $derived.by(() => {
        const duel = gameSession.gameState.duel
        return duel ? actionNounForSlot(duel.slot) : ''
    })

    function playerIdForColor(color: Color): string | undefined {
        return gameSession.gameState.players.find((p) => p.color === color)?.playerId
    }

    // roundAdvanced marks the END of a round, so scanning backward from "now" always
    // hits it BEFORE anything else that happened earlier in the very round we're
    // trying to inspect (money bag payouts, a completed negotiation, duel bids, etc.)
    // - stopping on the first one would mean never finding anything, even when it's
    // squarely within the round the message is meant to describe. The first
    // roundAdvanced just closes out that round; only a SECOND one confirms we've
    // scanned past it entirely into the round before it.
    function isPastCurrentRound(roundBoundariesSeen: number): boolean {
        return roundBoundariesSeen >= 2
    }

    // A slot's resolution is "stale" (superseded, no longer the single most recent
    // notable thing) once a later slot has resolved since it - resolvedSlots grows
    // by exactly one, in order, every time ANY slot fully resolves (money bag, solo
    // win, negotiation, or duel - see resolutionHelpers/negotiationMove/dueling),
    // so a slot's own number matching its current length means nothing has
    // resolved more recently than it.
    function isFreshestResolvedSlot(slot: number | undefined): boolean {
        return slot !== undefined && slot === gameSession.gameState.resolvedSlots.length
    }

    // The most recent solo Money Bag win this round (a single chooser gets the whole
    // amount rather than splitting it) - scans back through history rather than
    // gameState, since the distribution happens instantly as part of the
    // AdvanceResolution cascade with no dedicated "just resolved" machine state to
    // hook into.
    const lastBankWin = $derived.by(() => {
        const actions = gameSession.actions
        let roundBoundariesSeen = 0
        for (let i = actions.length - 1; i >= 0; i--) {
            const action = actions[i]
            // A round can draw several action cards before it advances - bounding by
            // round alone let a money bag win from an EARLIER card in the same round
            // keep showing once a later card in that round became current. The
            // current card's own draw is where its own story starts, so stop there.
            if (isDrawActionCard(action)) return undefined
            if (!isAdvanceResolution(action)) continue
            if (action.metadata?.roundAdvanced) {
                roundBoundariesSeen++
                if (isPastCurrentRound(roundBoundariesSeen)) return undefined
                continue
            }
            if (action.metadata?.moneyBagRecipientIds?.length === 1) {
                if (!isFreshestResolvedSlot(action.metadata.slot)) return undefined
                return {
                    playerId: action.metadata.moneyBagRecipientIds[0],
                    amount: action.metadata.moneyBagAmountEach ?? 0
                }
            }
        }
        return undefined
    })

    // The just-revealed Silver Mine's per-player hill payout, if one is sitting on the
    // discard pile - derived in the session since the action bar needs it too (it shows
    // each player's "+N" under their points box).
    const lastMineReveal = $derived(gameSession.lastMineHillScoring)

    // True at the start of a round (before its card is drawn) when the round that just
    // ended concluded with a duel that tied a second time - i.e. nobody performed the
    // final slot's action. Lets the draw-pile prompt explain why the round fizzled.
    // Scans back from now: a give-up duel bid sitting right before the round rollover
    // (only system AdvanceResolution actions between it and now) is the signal; hitting
    // any real action or a prior draw/round-boundary first means it wasn't that.
    const lastRoundEndedInDuelGiveUp = $derived.by(() => {
        if (gameSession.gameState.machineState !== MachineState.StartOfTurn) return false
        const actions = gameSession.actions
        let sawRoundBoundary = false
        for (let i = actions.length - 1; i >= 0; i--) {
            const action = actions[i]
            if (isDrawActionCard(action)) return false
            if (isAdvanceResolution(action)) {
                if (action.metadata?.roundAdvanced) {
                    if (sawRoundBoundary) return false
                    sawRoundBoundary = true
                }
                continue
            }
            if (isSubmitDuelBid(action)) return action.metadata?.duelResult === 'giveUp'
            // Any other real action means the round didn't end on a duel give-up.
            return false
        }
        return false
    })

    // The most recent completed negotiation this round - substitutes "X won a Y
    // action" with "X paid Y N ducats for the Z action" for whoever's now placing
    // walls/knights/taking a politics card as a result. Guarded by fromPlayerId
    // matching the current placer so an earlier slot's (already-resolved) negotiation
    // this same round can't leak into a later, unrelated solo-win placement phase.
    // Also bounded by the current action card's own draw (see lastBankWin) so an
    // earlier card's negotiation in the same round can't leak into a later one.
    const lastNegotiationPayment = $derived.by(() => {
        const actions = gameSession.actions
        let roundBoundariesSeen = 0
        for (let i = actions.length - 1; i >= 0; i--) {
            const action = actions[i]
            if (isDrawActionCard(action)) return undefined
            if (isAdvanceResolution(action) && action.metadata?.roundAdvanced) {
                roundBoundariesSeen++
                if (isPastCurrentRound(roundBoundariesSeen)) return undefined
                continue
            }
            if (
                isNegotiationMove(action) &&
                action.kind === NegotiationMoveKind.Sign &&
                action.metadata?.executedOffer
            ) {
                return action.metadata.executedOffer
            }
        }
        return undefined
    })

    // The most recent alliance cancellation this action card (see lastBankWin) -
    // worth a status note since it's easy to miss (it happens instantly as part of
    // laying a decision card, with no dedicated machine state of its own). Can only
    // ever happen before any slot has resolved (it requires still being able to lay
    // a decision card), so it's only ever "freshest" while resolvedSlots is still
    // empty for this card - once the first slot resolves, something newer exists.
    const lastAllianceCancellation = $derived.by(() => {
        const actions = gameSession.actions
        let roundBoundariesSeen = 0
        for (let i = actions.length - 1; i >= 0; i--) {
            const action = actions[i]
            if (isDrawActionCard(action)) return undefined
            if (isAdvanceResolution(action)) {
                if (action.metadata?.roundAdvanced) {
                    roundBoundariesSeen++
                    if (isPastCurrentRound(roundBoundariesSeen)) return undefined
                    continue
                }
                return undefined
            }
            if (isCancelAlliance(action) && action.metadata?.otherColor) {
                if (gameSession.gameState.resolvedSlots.length > 0) return undefined
                return { playerId: action.playerId, otherColor: action.metadata.otherColor }
            }
        }
        return undefined
    })

    // A bid's actual strength, including any Treasure card added on top - metadata
    // keeps a snapshot of the card used (see SubmitDuelBidMetadata's comment) since
    // the real card gets removed from the winner's hand once it's spent, so it can't
    // be looked up fresh from current player state after the fact.
    function effectiveBidAmount(bid: SubmitDuelBid): number {
        return bid.amount + (bid.metadata?.treasureCardUsed?.value ?? 0)
    }

    // Splits a flat run of consecutive SubmitDuelBid actions into per-round groups.
    // Each round starts fresh (duel.bids resets to [] on both a re-duel and a brand
    // new duel), so a player bidding again before every OTHER round-mate has bid
    // again can only mean a new round just started - that repeat is the only signal
    // needed to find round boundaries, no other bookkeeping required.
    function splitDuelBidsIntoRounds(bids: SubmitDuelBid[]): SubmitDuelBid[][] {
        const rounds: SubmitDuelBid[][] = []
        let current: SubmitDuelBid[] = []
        let seen = new Set<string>()
        for (const bid of bids) {
            if (seen.has(bid.playerId)) {
                rounds.push(current)
                current = []
                seen = new Set()
            }
            current.push(bid)
            seen.add(bid.playerId)
        }
        if (current.length > 0) rounds.push(current)
        return rounds
    }

    // This round's SubmitDuelBid actions (if any), plus the slot they were fought
    // over - read off the tieWentToDuel AdvanceResolution (re-duels never insert
    // another one, only the original tie-to-duel routing does). Scans the whole
    // round-bounded window rather than stopping at the first non-bid action, since
    // other slots can resolve (money bag, solo wins, a negotiation) before or after
    // this one within the same cascaded batch of actions. Also bounded by the
    // current action card's own draw (see lastBankWin) so an earlier card's duel in
    // the same round can't leak into a later, unrelated one.
    const recentDuelContext = $derived.by(() => {
        const actions = gameSession.actions
        const bids: SubmitDuelBid[] = []
        let slot: 1 | 2 | 3 | undefined
        let roundBoundariesSeen = 0
        for (let i = actions.length - 1; i >= 0; i--) {
            const action = actions[i]
            if (isDrawActionCard(action)) break
            if (isSubmitDuelBid(action)) {
                bids.unshift(action)
                continue
            }
            if (isAdvanceResolution(action)) {
                if (action.metadata?.tieWentToDuel && slot === undefined) {
                    slot = action.metadata.slot
                }
                if (action.metadata?.roundAdvanced) {
                    roundBoundariesSeen++
                    if (isPastCurrentRound(roundBoundariesSeen)) break
                }
            }
        }
        return { bids, slot }
    })

    // While still dueling, whatever the immediately preceding (tied) round's bids
    // were - lets the status area explain what just happened when a tie sends the
    // duel into a re-duel among the tied subset.
    const previousTiedRoundBids = $derived.by(() => {
        const duel = gameSession.gameState.duel
        if (!duel || duel.tieCount === 0) return undefined
        const rounds = splitDuelBidsIntoRounds(recentDuelContext.bids)
        const completedRounds = duel.bids.length > 0 ? rounds.length - 1 : rounds.length
        if (completedRounds <= 0) return undefined
        return rounds[completedRounds - 1]
    })

    // Once a duel has fully resolved (gameState.duel cleared), whether the final
    // round produced a winner (who outspent the rest) or gave up (a second
    // consecutive tie - no one performs the action).
    const lastDuelOutcome = $derived.by(() => {
        if (gameSession.gameState.duel) return undefined
        const rounds = splitDuelBidsIntoRounds(recentDuelContext.bids)
        const lastRound = rounds.at(-1)
        if (!lastRound || lastRound.length === 0) return undefined

        const maxAmount = Math.max(...lastRound.map(effectiveBidAmount))
        const topBidders = lastRound.filter((b) => effectiveBidAmount(b) === maxAmount)

        if (topBidders.length === 1) {
            return {
                type: 'win' as const,
                winnerId: topBidders[0].playerId,
                otherIds: lastRound.filter((b) => b.playerId !== topBidders[0].playerId).map((b) => b.playerId),
                bids: lastRound
            }
        }
        // Shown unconditionally as a top-of-status banner (unlike the win case
        // above, which is only ever read contextually, already gated on matching
        // whoever's currently placing/taking as a result) - so this one needs its
        // own freshness check (see lastBankWin) to avoid lingering once a later
        // slot has resolved.
        if (!isFreshestResolvedSlot(recentDuelContext.slot)) return undefined
        return {
            type: 'giveUp' as const,
            bids: lastRound,
            actionNoun: recentDuelContext.slot ? actionNounForSlot(recentDuelContext.slot) : ''
        }
    })

    // Mirrors the shared standing offer once one exists, so both negotiators see the
    // same live draft; before any offer exists, defaults to "I offer" for whichever
    // negotiator this session is, at a 1-ducat opening amount. Purely a local draft
    // until the player actually does something (touches the stepper, or clicks
    // Signed - see the Signed button below, which proposes this draft for real
    // first if nothing's been proposed yet). Deliberately NOT auto-submitted the
    // moment negotiation starts - that used to happen so the Signed button was
    // immediately usable, but it meant a real action always existed the instant a
    // negotiation began, and that action (being the nearest one) was always what
    // Undo targeted - hiding whatever the player actually wanted to undo back to.
    let negotiationProposerId = $state<string | undefined>(undefined)
    let negotiationAmount = $state(0)

    // Once both sides have signed, gameState.negotiation disappears immediately (the
    // machine moves straight on to whatever the settled action needs next) - which
    // read as an abrupt cut, control handed to the next player before anyone could
    // actually see both signatures land. This holds the fully-signed view on screen
    // a beat longer instead of snapping away the instant it clears. Only applies to
    // an actual completed deal, not a decline (which routes straight to a duel and
    // should switch over immediately).
    const NEGOTIATION_HOLD_MS = 1000
    let frozenNegotiation: Negotiation | undefined = $state(undefined)
    let lastLiveNegotiation: Negotiation | undefined
    let negotiationFreezeTimer: ReturnType<typeof setTimeout> | undefined

    $effect(() => {
        const negotiation = gameSession.gameState.negotiation

        if (negotiation) {
            lastLiveNegotiation = negotiation
            if (negotiationFreezeTimer) {
                clearTimeout(negotiationFreezeTimer)
                negotiationFreezeTimer = undefined
            }
            frozenNegotiation = undefined

            if (negotiation.offer) {
                negotiationProposerId = negotiation.offer.fromPlayerId
                negotiationAmount = negotiation.offer.amount
                return
            }

            // No offer yet - always recompute the default proposer, regardless of
            // whatever negotiationProposerId held before. Relying on that leftover
            // value to detect "is this a fresh negotiation" broke when one
            // negotiation resolved straight into a new one sharing a participant
            // with the old one (no intervening tick with negotiation undefined to
            // reset it) - this branch only runs at all while offer is undefined, so
            // re-entering it every tick is harmless.
            const myId = gameSession.myPlayer?.id
            negotiationProposerId = myId && negotiation.playerIds.includes(myId) ? myId : negotiation.playerIds[0]
            negotiationAmount = 1
            return
        }

        // Negotiation just cleared - if it resolved with everyone having signed
        // (rather than a decline), hold that view a little longer.
        if (
            lastLiveNegotiation &&
            lastLiveNegotiation.signedPlayerIds.length === lastLiveNegotiation.playerIds.length &&
            !frozenNegotiation
        ) {
            frozenNegotiation = lastLiveNegotiation
            negotiationFreezeTimer = setTimeout(() => {
                frozenNegotiation = undefined
                negotiationFreezeTimer = undefined
                negotiationProposerId = undefined
            }, NEGOTIATION_HOLD_MS)
        } else if (!frozenNegotiation) {
            negotiationProposerId = undefined
        }
        lastLiveNegotiation = undefined
    })

    // What the negotiation panel actually renders - the live negotiation normally,
    // or the frozen snapshot during the brief hold after it just finished (see
    // above). Everything below reads this instead of gameState.negotiation directly.
    const displayNegotiation = $derived(gameSession.gameState.negotiation ?? frozenNegotiation)

    const negotiationOtherPlayerId = $derived.by(() => {
        const negotiation = displayNegotiation
        if (!negotiation || !negotiationProposerId) return undefined
        return negotiation.playerIds.find((id) => id !== negotiationProposerId)
    })

    const negotiationProposerMoney = $derived(
        negotiationProposerId ? gameSession.gameState.getPlayerState(negotiationProposerId).money : 0
    )

    // The payer dropdown and the amount stepper edit a local draft only - nothing is
    // dispatched until the player commits by signing. Every stepper click used to submit a
    // real NegotiationMove.Propose, so nudging an offer from 1 to 8 wrote seven actions into
    // the game log, each of them the nearest undoable action: undoing the decision card that
    // started the negotiation meant pressing Undo eight times, back through your own
    // fiddling. (A comment further up records that an auto-proposal was removed for exactly
    // this reason; the stepper had reintroduced it one click at a time.) The trade-off is
    // that the other player doesn't watch the number move - they see the offer when it's
    // made.
    async function commitNegotiationOffer() {
        const negotiation = displayNegotiation
        if (!negotiation || !negotiationProposerId) return

        // Signing means "I commit to what's on screen", so submit the draft first whenever
        // it isn't already the standing offer. Proposing clears existing signatures
        // engine-side, which is correct: it's a different deal.
        const offer = negotiation.offer
        const draftIsStandingOffer =
            offer !== undefined &&
            offer.fromPlayerId === negotiationProposerId &&
            offer.amount === negotiationAmount
        if (!draftIsStandingOffer) {
            const proposed = await gameSession.proposeNegotiationOffer(
                negotiationProposerId,
                negotiationAmount
            )
            // Refused (e.g. a payer who can't afford it) - don't follow up with a Sign that
            // has nothing valid to sign.
            if (!proposed) return
        }

        await gameSession.signNegotiationOffer()
    }

    // The payer's signature line always comes first, the payee's second - so the
    // signature buttons "activate" (enable for whichever player you are) in payer-
    // then-payee order too, since they're driven by whichever playerId lands in each
    // position here. Before a real offer is submitted, falls back to the live
    // dropdown draft so the order still previews correctly.
    const orderedNegotiatorIds = $derived.by(() => {
        const negotiation = displayNegotiation
        if (!negotiation) return []
        const payerId = negotiation.offer?.fromPlayerId ?? negotiationProposerId
        if (!payerId || !negotiation.playerIds.includes(payerId)) return negotiation.playerIds
        const payeeId = negotiation.playerIds.find((id) => id !== payerId)
        return payeeId ? [payerId, payeeId] : negotiation.playerIds
    })

    // A local, per-player draft bid amount - each duelist's own private stepper,
    // unlike negotiation's single shared offer (a duel bid is a one-shot commitment
    // per player, not a joint draft either side can revise).
    // The negotiation counterpart of SHOW_DUEL_TEST_CONTROLS, and off for the same
    // reason. This one had no switch at all until now: it rendered whenever a solo
    // tester faced an unsigned opponent, which is exactly why it was the testing
    // affordance still visible when the others had long been gated off.
    const SHOW_NEGOTIATION_TEST_CONTROLS = false

    let duelBidAmounts = $state<Record<string, number>>({})
    let lastSeenDuelSignature: string | undefined = undefined

    // Master switch for the bid-on-another-player's-behalf affordance, same pattern as
    // TestingControls' own constant - it only exists because hotseat resolves myPlayer
    // to a single duelist, so a solo tester otherwise can't finish a duel at all.
    //
    // Off for beta: a tester who can bid for their opponent can settle a duel from one
    // seat, which is not a shortcut through the flow but a way to decide someone else's
    // ducats for them. Everything behind it is intact - flip this back to true for
    // another solo pass.
    const SHOW_DUEL_TEST_CONTROLS = false
    let testBiddingForPlayerId: string | undefined = $state(undefined)

    $effect(() => {
        const duel = gameSession.gameState.duel
        if (!duel) {
            lastSeenDuelSignature = undefined
            duelBidAmounts = {}
            testBiddingForPlayerId = undefined
            return
        }
        // A re-duel replaces gameState.duel directly (never passing through
        // undefined in between - same reason negotiation needed this treatment), so
        // this signature - not "was there an empty tick" - is what detects a fresh
        // round and resets every bid back to 0 rather than carrying over stale
        // amounts (which could exceed a player's CURRENT money if it changed since).
        const signature = `${duel.slot}:${duel.playerIds.join(',')}:${duel.tieCount}`
        if (signature !== lastSeenDuelSignature) {
            lastSeenDuelSignature = signature
            duelBidAmounts = {}
            testBiddingForPlayerId = undefined
            // A card armed for the previous round shouldn't silently ride along into
            // the re-duel - the player re-applies it if they still want to spend it.
            gameSession.selectTreasureCard(undefined)
        }
    })

    const board = $derived(gameSession.gameState.board)
    const regions = $derived(gameSession.gameState.regions)
    const alliances = $derived(gameSession.gameState.alliances)
    const tileLayout = $derived(board.tileLayout ?? [])

    // A wall's two endpoints, in grid-corner coordinates - west edges run from
    // (col,row) down to (col,row+1); north edges run from (col,row) right to
    // (col+1,row). Only interior walls are ever stored (the board's outer edge is an
    // always-there implicit wall - see isWalledBetween), but an interior wall can
    // still have ONE endpoint land exactly on the outer boundary if it's in the
    // first/last row or column.
    function wallEndpoints(wall: Wall): [[number, number], [number, number]] {
        return wall.edge === 'west'
            ? [
                  [wall.col, wall.row],
                  [wall.col, wall.row + 1]
              ]
            : [
                  [wall.col, wall.row],
                  [wall.col + 1, wall.row]
              ]
    }
    function isCornerOnBoardBoundary(cx: number, cy: number): boolean {
        return cx === 0 || cx === BOARD_COLS || cy === 0 || cy === BOARD_ROWS
    }
    // Suppresses the yellow junction octagon wherever a placed wall meets the
    // rampart frame around the edge of the board - there's no other wall there to
    // blend with (that's what the octagon marker is for), just the board's edge.
    function wallJunctionVisibility(wall: Wall): { hideStart: boolean; hideEnd: boolean } {
        const [start, end] = wallEndpoints(wall)
        return {
            hideStart: isCornerOnBoardBoundary(start[0], start[1]),
            hideEnd: isCornerOnBoardBoundary(end[0], end[1])
        }
    }

    // One entry per alliance, with every boundary wall that sits directly between its
    // two allied regions - each of those walls carries a heart, the alliance's only
    // on-board indication. "wall north of (c,r)" separates (c,r) from (c,r-1); "wall west
    // of (c,r)" separates (c,r) from (c-1,r) - see model/board.ts's wallBetween().
    // Grouped by alliance (rather than a flat wall list) because the hearts are also the
    // control for cancelling one, which is an alliance-wide interaction: hovering any of
    // its hearts previews the whole alliance ending.
    const myCancellableAllianceIds = $derived(
        new Map(gameSession.myCancellableAlliances.map((a) => [a.id, a.otherColor]))
    )

    const allianceMarkers = $derived.by(() => {
        if (alliances.length === 0) return []
        return alliances
            .map((alliance) => {
                const regionA = regions.find((r) => r.id === alliance.regionAId)
                const regionB = regions.find((r) => r.id === alliance.regionBId)
                const walls =
                    !regionA || !regionB
                        ? []
                        : board.walls.filter((wall) => {
                              const keyHere = squareKey(wall.col, wall.row)
                              const keyThere =
                                  wall.edge === 'north'
                                      ? squareKey(wall.col, wall.row - 1)
                                      : squareKey(wall.col - 1, wall.row)
                              return (
                                  (regionA.squareKeys.includes(keyHere) &&
                                      regionB.squareKeys.includes(keyThere)) ||
                                  (regionB.squareKeys.includes(keyHere) &&
                                      regionA.squareKeys.includes(keyThere))
                              )
                          })
                return {
                    id: alliance.id,
                    walls,
                    // Cancellable means the rulebook's "one of the two players
                    // participating in it pays ten ducats" is genuinely open to ME right
                    // now - myCancellableAlliances already checks both the participation
                    // and the 10 ducats.
                    cancellable: myCancellableAllianceIds.has(alliance.id),
                    otherColor: myCancellableAllianceIds.get(alliance.id)
                }
            })
            .filter((marker) => marker.walls.length > 0)
    })

    // Where a heart sits for a given boundary wall - the same maths the markers and the
    // burst below both need, so neither can drift from the other.
    function heartPosition(wall: { col: number; row: number; edge: string }) {
        return {
            left: (wall.edge === 'west' ? wall.col * CELL_SIZE : wall.col * CELL_SIZE + CELL_SIZE / 2) - 12,
            top: (wall.edge === 'west' ? wall.row * CELL_SIZE + CELL_SIZE / 2 : wall.row * CELL_SIZE) - 12
        }
    }

    // Cancelling an alliance deletes it from state, so by the time we hear about the
    // action its hearts are already gone from allianceMarkers and there is nothing left to
    // animate. This keeps the last known wall positions per alliance so the burst still
    // knows where to play. A plain Map, not $state: nothing renders from it directly.
    const lastKnownAllianceWalls = new Map<string, { col: number; row: number; edge: string }[]>()
    $effect(() => {
        for (const marker of allianceMarkers) {
            lastKnownAllianceWalls.set(marker.id, marker.walls)
        }
    })

    type AllianceBurst = { id: string; left: number; top: number }
    let allianceBursts: AllianceBurst[] = $state([])
    const ALLIANCE_BURST_MS = 700
    // Directions the shards fly. Not evenly spaced round the circle - a slightly irregular
    // spray reads as something breaking rather than as a diagram.
    const BURST_SHARD_ANGLES = [-72, -28, 14, 58, 104, 152, 196, 250]

    // The renegade knight changing sides: it lifts off its old square, arcs across, and
    // settles on the new one having taken the new owner's colour on the way. Renegade is
    // "remove theirs, place yours" in the rules, but as a single gesture it reads as one
    // knight defecting - which is what the card is called.
    type RenegadeFlight = {
        id: string
        left: number
        top: number
        dx: number
        dy: number
        toCol: number
        toRow: number
        fromColor: Color
        toColor: Color
    }
    let renegadeFlight: RenegadeFlight | undefined = $state(undefined)
    const RENEGADE_FLIGHT_MS = 900

    // The landing square already holds the new knight the moment the action applies, so it
    // is hidden for the duration - otherwise the piece would be sitting there waiting while
    // its own arrival is still in the air.
    function isRenegadeArrivalSquare(col: number, row: number): boolean {
        return renegadeFlight !== undefined && renegadeFlight.toCol === col && renegadeFlight.toRow === row
    }

    function flyRenegadeKnight(action: { id: string; playerId: string; metadata?: unknown }) {
        const metadata = action.metadata as
            | { victimColor: Color; removedSquareKey: string; placedSquareKey: string }
            | undefined
        if (!metadata) return

        const [fromCol, fromRow] = metadata.removedSquareKey.split(',').map(Number)
        const [toCol, toRow] = metadata.placedSquareKey.split(',').map(Number)
        const mover = gameSession.gameState.getPlayerState(action.playerId)

        renegadeFlight = {
            id: action.id,
            left: fromCol * CELL_SIZE,
            top: fromRow * CELL_SIZE,
            dx: (toCol - fromCol) * CELL_SIZE,
            dy: (toRow - fromRow) * CELL_SIZE,
            toCol,
            toRow,
            fromColor: metadata.victimColor,
            toColor: mover.color
        }

        setTimeout(() => {
            if (renegadeFlight?.id === action.id) renegadeFlight = undefined
        }, RENEGADE_FLIGHT_MS)
    }

    function burstAlliance(allianceId: string) {
        const walls = lastKnownAllianceWalls.get(allianceId)
        if (!walls || walls.length === 0) return

        const added = walls.map((wall, i) => ({
            id: `${allianceId}-${wall.col},${wall.row},${wall.edge}-${i}`,
            ...heartPosition(wall)
        }))
        allianceBursts = [...allianceBursts, ...added]

        setTimeout(() => {
            const spent = new Set(added.map((burst) => burst.id))
            allianceBursts = allianceBursts.filter((burst) => !spent.has(burst.id))
            lastKnownAllianceWalls.delete(allianceId)
        }, ALLIANCE_BURST_MS)
    }

    // Cancelling costs 10 ducats and is legal at any time, so the affordance lives on the
    // board rather than in the turn-scoped status text. One click does it: the hover state
    // (broken heart, the wall sweeping back, the -10 medallion) is the confirmation step,
    // so a second click would only ask a question already answered - and Undo covers a
    // genuine misclick.
    let hoveredAllianceId: string | undefined = $state(undefined)

    function allianceCancelLabel(marker: { otherColor?: Color }): string {
        const otherPlayerId = marker.otherColor ? playerIdForColor(marker.otherColor) : undefined
        const other = otherPlayerId ? playerName(gameSession, otherPlayerId) : 'a neutral prince'
        return `Cancel your alliance with ${other} for ${ALLIANCE_CANCELLATION_COST} ducats`
    }

    const tileImages: Record<BoardTileId, string> = {
        A: boardTileA,
        B: boardTileB,
        C: boardTileC,
        D: boardTileD,
        E: boardTileE,
        F: boardTileF
    }

    // Expensive (re-scans the whole board with a validity check per candidate edge).
    // Must be computed ONCE per render via $derived, not re-invoked from inside a
    // per-square/per-edge check function - otherwise a 150-square grid would call it
    // 150 times each render (O(n^2), which got dramatically worse as more regions
    // accumulated from wall placement, since region-membership checks scale with
    // region count - that's what froze the page after "placing a bunch of walls").
    const legalCastleSquareSet = $derived(
        new Set(gameSession.legalCastleSquares.map((s) => `${s.col},${s.row}`))
    )
    const legalWallEdges = $derived(gameSession.legalWallEdges)
    const legalKnightSquareSet = $derived(
        new Set(gameSession.legalKnightSquares.map((s) => `${s.col},${s.row}`))
    )
    // For the fading "ghost knight" preview on legal placement squares - the piece
    // it would actually place, so it's shown in the player's own color.
    const myColor = $derived(
        gameSession.myPlayer ? gameSession.gameState.getPlayerState(gameSession.myPlayer.id).color : undefined
    )
    // What the next setup placement will really be: your own color at first, the neutral
    // prince's for the closing laps (see GameSession.placementColor). Distinct from
    // myColor, which is right for every mid-game preview but wrong during those laps.
    const placementColor = $derived(gameSession.placementColor)

    // The action currently being looked at while rewound through the history controls -
    // the one whose result is what's drawn on the board. Already undefined during live play
    // and when rewound past the very first action, so it doubles as "are we in history".
    const historyAction = $derived(gameSession.history.currentAction)
    const legalExpansionSquareSet = $derived(
        new Set(gameSession.legalNextExpansionSquares.map((s) => `${s.col},${s.row}`))
    )
    const legalRenegadeEnemyRegionIds = $derived(new Set(gameSession.legalRenegadeEnemyRegions.map((r) => r.id)))
    const legalRenegadeRemovableSquareSet = $derived(
        new Set(gameSession.legalRenegadeRemovableSquares.map((s) => `${s.col},${s.row}`))
    )
    const legalRenegadePlacementSquareSet = $derived(
        new Set(gameSession.legalRenegadePlacementSquares.map((s) => `${s.col},${s.row}`))
    )
    const legalAllianceEnemyRegionIds = $derived(new Set(gameSession.legalAllianceEnemyRegions.map((r) => r.id)))
    // These two are hoisted for the same reason as the sets above, and it matters more
    // here: both are plain class getters (unmemoized), and legalRenegadeOwnRegionIds walks
    // every square of every region of yours and runs a knight-connectivity BFS per
    // candidate. They're consulted from per-square helpers inside the 150-cell grid loop,
    // so reading them straight off the session recomputed the whole thing once per square -
    // the same O(n^2) shape that froze the board once before (see the note above).
    // Which region owns each square, built once per render. regionAt/regionTint are called
    // for all ~150 squares of the grid, and both used to run regions.find(r =>
    // r.squareKeys.includes(key)) - a scan of every region, and within each a scan of its
    // square keys comparing strings. A dozen regions of ten squares each is ~120 string
    // compares per square, ~18k per render, re-run on every reactive change including the
    // hoverPoint updates that fire on mouse move. Same hoisting the sets below already got.
    const regionBySquareKey = $derived.by(() => {
        const map = new Map<string, (typeof regions)[number]>()
        for (const region of regions) {
            for (const key of region.squareKeys) map.set(key, region)
        }
        return map
    })
    // Region ids by ownership, for the same reason: myRegions/expandableRegions are plain
    // getters that filter the whole regions array on every read, and the helpers below are
    // called once per square.
    const myRegionIdSet = $derived(new Set(gameSession.myRegions.map((r) => r.id)))
    const expandableRegionIdSet = $derived(new Set(gameSession.expandableRegions.map((r) => r.id)))
    const legalRenegadeOwnRegionIdSet = $derived(gameSession.legalRenegadeOwnRegionIds)
    const legalAllianceOwnRegionIdSet = $derived(gameSession.legalAllianceOwnRegionIds)

    // The knight action is driven by a plan declared up front (see
    // GameSession.knightPlan) rather than a mode the player toggles: everything below
    // derives which half of the action a board click means from that plan plus what the
    // engine says has been spent, so no confirm/cancel chrome is needed - Undo backs out
    // of the plan (or the last real placement) instead.
    const knightSwordsLeft = $derived(gameSession.gameState.knightsRemaining ?? 0)
    const expansionStarted = $derived(gameSession.gameState.expansionUsed === true)

    // The plans actually on the table right now. A two-sword action is the interesting
    // case: two knights, or one knight plus one expansion in either order. Either half
    // can also be unavailable on its own (an empty knight stock or nowhere legal to
    // place; no region of your own to expand), which just prunes the list.
    const availableKnightPlans = $derived.by((): KnightPlan[] => {
        if (!gameSession.canPlaceKnight) return []
        const canKnight = gameSession.canPlaceAnotherKnight
        // canStartExpansion, not canExpandRegion: the latter is true whenever you own a
        // region, even if every one of them is boxed in, which is how "expand a region"
        // used to be offered and then dead-end once a region was picked.
        const canExpand = gameSession.canStartExpansion
        if (knightSwordsLeft > 1) {
            const plans: KnightPlan[] = []
            if (canKnight) plans.push('twoKnights')
            if (canKnight && canExpand) plans.push('knightThenExpand', 'expandThenKnight')
            // Both swords, but only the expanding half is open - one expansion is all
            // this action can become ("expand twice is not allowed").
            if (!canKnight && canExpand) plans.push('expand')
            return plans
        }
        const plans: KnightPlan[] = []
        if (canKnight) plans.push('knight')
        if (canExpand) plans.push('expand')
        return plans
    })

    const KNIGHT_PLAN_LABELS: Record<KnightPlan, string> = {
        knight: 'place a knight',
        expand: 'expand a region',
        twoKnights: 'place two knights',
        knightThenExpand: 'place a knight and then expand',
        expandThenKnight: 'expand and then place a knight'
    }

    // Whether a board click right now means "expand into this space" / "place a knight
    // here". Both can be live at once: mid-expansion under an expand-then-knight plan,
    // clicking a knight square is what stops the expansion after a single space (there's
    // no Done button anymore). Each stage also falls through to the other if its own
    // half turns out to be impossible after all.
    const expandStageActive = $derived.by(() => {
        const plan = gameSession.knightPlan
        if (!plan || !gameSession.canExpandRegion) return false
        switch (plan) {
            case 'knight':
            case 'twoKnights':
                return false
            case 'knightThenExpand':
                // Its knight is done once a sword has gone somewhere (compared against
                // the count when the plan was picked, so this still reads correctly after
                // an Undo mid-action).
                return (
                    expansionStarted ||
                    knightSwordsLeft < gameSession.knightPlanStartSwords ||
                    !gameSession.canPlaceAnotherKnight
                )
            case 'expand':
            case 'expandThenKnight':
                return true
        }
    })

    // The region being expanded turned out to have nowhere legal to grow into. Its sword
    // is better spent on a knight than forfeited, so this hands the knight half the
    // board even under an expansion-first plan (and there's no overlap to disambiguate,
    // since there are no legal expansion squares left to compete with).
    const expansionDeadEnd = $derived(
        expandStageActive &&
            gameSession.selectedExpandRegionId !== undefined &&
            gameSession.expansionSquares.length === 0 &&
            gameSession.legalNextExpansionSquares.length === 0
    )

    // Only meaningful while expansionDeadEnd holds - which rule(s) are actually blocking
    // every square around the region (see GameSession.expansionBlockedReasons).
    const expansionBlockedReasons = $derived(expansionDeadEnd ? gameSession.expansionBlockedReasons : [])

    const knightStageActive = $derived.by(() => {
        const plan = gameSession.knightPlan
        if (!plan || !gameSession.canPlaceAnotherKnight) return false
        switch (plan) {
            case 'expand':
                return expansionDeadEnd
            case 'knight':
            case 'twoKnights':
                return true
            case 'knightThenExpand':
                // Its knight comes first; once that's down, the leftover sword is
                // earmarked for the expansion (Undo to change your mind).
                return (
                    (knightSwordsLeft >= gameSession.knightPlanStartSwords && !expansionStarted) ||
                    !gameSession.canExpandRegion ||
                    expansionDeadEnd
                )
            case 'expandThenKnight':
                return expansionStarted || !gameSession.canExpandRegion || expansionDeadEnd
        }
    })

    // Drop a plan belonging to an earlier knight action, so a previous player's plan (or
    // this player's own from a previous action) can't carry over - otherwise
    // canExpandRegion would correctly show the choice, but legalNextExpansionSquares
    // silently computed legality against the wrong (stale) region id and came back empty,
    // making it look like there was nothing to click. Keyed to the action itself rather
    // than "the placing player changed", so an Undo that steps back into an action that
    // had already ended keeps its plan (see syncKnightPlanWithState).
    $effect(() => {
        gameSession.syncKnightPlanWithState()
    })

    // With only one shape left there's nothing to choose - skip the prompt and go
    // straight to clicking the board. Also re-offers the choice if a plan runs out of
    // live stages while the action is still open (e.g. a "two knights" plan whose stock
    // ran dry, leaving only an expansion).
    $effect(() => {
        if (!gameSession.knightPlan) {
            if (availableKnightPlans.length === 1) choosePlan(availableKnightPlans[0])
        } else if (gameSession.canPlaceKnight && !expandStageActive && !knightStageActive) {
            gameSession.clearKnightPlan()
        }
    })

    // Whether expanding was actually on the table when the current plan was picked. A plan
    // chosen while expansion WAS possible is a real decision and must stand; one chosen
    // while it was impossible was made without that option ever being shown.
    let expansionWasAvailableAtPlanTime = $state(false)

    function choosePlan(plan: KnightPlan) {
        expansionWasAvailableAtPlanTime = gameSession.canStartExpansion
        gameSession.selectKnightPlan(plan)
    }

    const planIncludesExpansion = $derived(
        gameSession.knightPlan === 'expand' ||
            gameSession.knightPlan === 'knightThenExpand' ||
            gameSession.knightPlan === 'expandThenKnight'
    )

    // A player's own move can unlock an option they were never offered: placing the first
    // knight can tip a neighbour's count so it can finally be outnumbered, and breaking an
    // alliance mid-action drops the protection that was shutting expansion out. Both leave
    // a plan on file - auto-selected, since "two knights" was the only shape available -
    // that no longer reflects what's possible.
    //
    // So when expansion becomes possible mid-action and the plan has none in it, drop the
    // plan and let the choice be made again for the swords that are left. Only local intent
    // is cleared; anything already placed stays put. Guarded so it can't overturn a genuine
    // decision (expansionWasAvailableAtPlanTime) or interrupt an expansion under way.
    $effect(() => {
        if (!gameSession.canPlaceKnight) return
        if (!gameSession.knightPlan || planIncludesExpansion) return
        if (expansionWasAvailableAtPlanTime) return
        if (gameSession.gameState.expandingRegionId !== undefined) return
        if (!gameSession.canStartExpansion) return
        gameSession.clearKnightPlan()
    })

    // A region picked to expand outlives its usefulness the moment the expanding stage
    // closes (the expansion finished, a knight was placed instead, or the action ended).
    $effect(() => {
        if (!expandStageActive && gameSession.selectedExpandRegionId) gameSession.cancelExpansion()
    })

    // One region means there's nothing to pick - jump straight to choosing spaces. Also
    // covers re-entering an expansion the engine still has open (expandableRegions is
    // just that region then), so its 2nd space can't be misdirected at another region.
    $effect(() => {
        if (
            expandStageActive &&
            !gameSession.selectedExpandRegionId &&
            gameSession.expandableRegions.length === 1
        ) {
            gameSession.selectRegionToExpand(gameSession.expandableRegions[0].id)
        }
    })

    // Starting to play a Renegade/Alliance card is local-only UI state (see
    // startPlayingRenegadeCard/startPlayingAllianceCard) - nothing else clears it if
    // the window to actually play one closes out from under the player, whether
    // because the round simply moved on (into negotiation/dueling) or an Undo
    // reverted past the point where it was legal. Without this, the status message
    // could keep saying "Playing Renegade..."/"Playing Alliance..." long after that
    // stopped being true, with whatever comes next (a negotiation offer, a duel)
    // rendering right alongside the stale text.
    $effect(() => {
        if (gameSession.isPlayingRenegadeCard && !gameSession.canPlayRenegadeCard) {
            gameSession.cancelPlayingRenegadeCard()
        }
    })
    $effect(() => {
        if (gameSession.isPlayingAllianceCard && !gameSession.canPlayAllianceCard) {
            gameSession.cancelPlayingAllianceCard()
        }
    })

    // Floating "+N"/"-N" popups near wherever a region was just created, expanded,
    // invaded, or shrunk - one per scoring event, in the affected player's color,
    // auto-removed after a couple seconds. Fired from PlaceWall/ExpandRegion actions as they
    // are applied, reading their metadata for exact anchor squares/amounts - see the
    // anchorSquareKey fields on PlaceWallMetadata/ExpandRegionMetadata.
    type ScorePopup = { id: string; col: number; row: number; text: string; color: string }
    let popups: ScorePopup[] = $state([])
    const POPUP_LIFETIME_MS = 4000

    function addPopup(anchorKey: string, amount: number, color: string) {
        if (amount === 0) return
        const [col, row] = anchorKey.split(',').map(Number)
        const id = `${Date.now()}-${Math.random()}`
        popups = [...popups, { id, col, row, text: amount > 0 ? `+${amount}` : `${amount}`, color }]
        setTimeout(() => {
            popups = popups.filter((p) => p.id !== id)
        }, POPUP_LIFETIME_MS)
    }

    function popupsForCompletedRegions(
        regions: { ownerColor?: Color; points: number; anchorSquareKey: string }[] | undefined
    ) {
        for (const region of regions ?? []) {
            // Slate rather than the gray prince's #888888 - an unowned region's popup
            // shouldn't read as that player's (see NEUTRAL_ZONE_PAINT).
            const color = region.ownerColor ? gameSession.colors.getUiColor(region.ownerColor) : '#3f3f46'
            addPopup(region.anchorSquareKey, region.points, color)
        }
    }

    function popupsForAction(action: GameAction) {
        if (isPlaceWall(action)) {
            popupsForCompletedRegions(action.metadata?.completedRegions)
        } else if (isExpandRegion(action)) {
            if (action.metadata?.pointsGained) {
                const color = gameSession.colors.getUiColor(
                    gameSession.gameState.getPlayerState(action.playerId).color
                )
                addPopup(squareKey(action.space.col, action.space.row), action.metadata.pointsGained, color)
            }
            for (const invasion of action.metadata?.invasions ?? []) {
                const victimColor = gameSession.colors.getUiColor(invasion.victimColor)
                addPopup(invasion.directAnchorSquareKey, -invasion.directPointsLost, victimColor)
                if (invasion.disconnectedAnchorSquareKey) {
                    addPopup(invasion.disconnectedAnchorSquareKey, -invasion.disconnectedPointsLost, victimColor)
                }
            }
            popupsForCompletedRegions(action.metadata?.completedRegions)
        } else if (isPlayRenegadeCard(action)) {
            flyRenegadeKnight(action)
        } else if (isCancelAlliance(action)) {
            // Fires from the same per-action listener as the score popups, so it plays once,
            // for everyone at the table, and stays quiet while scrubbing history.
            burstAlliance(action.allianceId)
        }
    }

    // The session tells us about each action as it is applied, one at a time and in order, so
    // there is nothing here to notice or diff. That is the whole reason this is a listener and
    // not an $effect: an effect can only watch gameSession.actions and work out for itself which
    // entries are new, which needs a high-water mark, a mount baseline to avoid replaying the
    // whole game, and a guard for the history controls shrinking and regrowing the list. All
    // three were bookkeeping for information the session already had.
    //
    // Still skipped while scrubbing history: those points were scored long ago, and flashing a
    // "-8" over a player who has just lost nothing is what the old high-water mark was working
    // around.
    onMount(() => {
        const listener = async ({ action }: { action?: GameAction }) => {
            if (!action || gameSession.isViewingHistory) return
            popupsForAction(action)
        }

        gameSession.addGameStateChangeListener(listener)
        return () => gameSession.removeGameStateChangeListener(listener)
    })

    const CELL_SIZE = 44
    const TILE_SIZE = 5
    const TILE_PX = TILE_SIZE * CELL_SIZE
    // +4 accounts for the squares grid's own border-2 (2px on each side) - explicit
    // pixel sizes (not "auto") so the rampart frame's middle track always matches the
    // board's actual rendered box exactly, with no gap on any edge.
    const boardWidthPx = $derived(board.squares[0].length * CELL_SIZE + 4)
    const boardHeightPx = $derived(board.squares.length * CELL_SIZE + 4)

    // Mouse position in BOARD pixels - i.e. the same unscaled coordinate space as
    // CELL_SIZE and every left/top below, not screen pixels. The board is rendered
    // inside ScalingWrapper's CSS transform (see GameTable), so a raw
    // clientX - rect.left is screen-space and comes out multiplied by the current
    // scale: fine at 1:1, but at (say) 0.85 the ghost wall drifted further and further
    // up-left of the cursor the further from the board's top-left corner you went - two
    // whole cells off in the far corner, which made the thin wall hit-boxes feel like
    // they'd moved. Undefined whenever the cursor isn't over the board at all, which is
    // exactly when the ghost wall preview should show nothing.
    let hoverPoint: { x: number; y: number } | undefined = $state(undefined)

    // The scale ScalingWrapper is currently applying, read off the element itself
    // (getBoundingClientRect is post-transform, offsetWidth is pre-transform layout)
    // rather than plumbed down from the wrapper - no coordination needed, and it stays
    // correct through window resizes and the wrapper's own zoom controls.
    function boardPointFromEvent(el: HTMLElement, clientX: number, clientY: number) {
        const rect = el.getBoundingClientRect()
        const scale = el.offsetWidth > 0 ? rect.width / el.offsetWidth : 1
        const safeScale = scale > 0 ? scale : 1
        return { x: (clientX - rect.left) / safeScale, y: (clientY - rect.top) / safeScale }
    }

    // Whichever legal wall edge's clickable hit-box center is closest to the mouse -
    // the one spot that gets the pulsing ghost preview, rather than glowing every
    // legal spot at once.
    const nearestWallEdge = $derived.by(() => {
        if (!hoverPoint) return undefined
        let best: (typeof legalWallEdges)[number] | undefined
        let bestDistSq = Infinity
        for (const edge of legalWallEdges) {
            const sameRow = edge.row1 === edge.row2
            const cx = sameRow ? edge.col2 * CELL_SIZE : edge.col1 * CELL_SIZE + CELL_SIZE / 2
            const cy = sameRow ? edge.row1 * CELL_SIZE + CELL_SIZE / 2 : edge.row2 * CELL_SIZE
            const distSq = (cx - hoverPoint.x) ** 2 + (cy - hoverPoint.y) ** 2
            if (distSq < bestDistSq) {
                bestDistSq = distSq
                best = edge
            }
        }
        return best
    })

    // The canonical col/row/edge form (matching how real placed walls are stored and
    // rendered) for whichever edge is currently nearest the mouse.
    // Whether the cursor is currently over a village square. Villages are worth 5 power
    // points each and decide a lot of scoring, but on the printed tiles they sit in the
    // same palette as forests and hills and are easy to lose. Hovering one lights up every
    // village on the board, so a player can see the whole set at a glance without a legend
    // or a permanent highlight cluttering the board.
    //
    // Read off hoverPoint (board pixels, already tracked for the ghost wall) rather than
    // per-square mouse handlers - that would be one pair of listeners on every square of
    // the grid to answer a question the board already knows the answer to.
    const hoveringVillage = $derived.by(() => {
        if (!hoverPoint) return false
        const col = Math.floor(hoverPoint.x / CELL_SIZE)
        const row = Math.floor(hoverPoint.y / CELL_SIZE)
        if (!isOnBoard(col, row)) return false
        return board.squares[row]?.[col]?.type === SquareType.Village
    })

    // Löwenherz is Teuber's, and its princes compete to succeed a King while paying in
    // ducats - Holy Roman Empire rather than England, whose coin was the pound. These are
    // all real towns that were long established by the 1100s, so a board reads as a
    // plausible stretch of the Empire rather than as invented fantasy names.
    const VILLAGE_NAMES = [
        'Quedlinburg', 'Goslar', 'Bamberg', 'Speyer', 'Worms', 'Trier',
        'Regensburg', 'Hildesheim', 'Soest', 'Naumburg', 'Fulda', 'Eisenach',
        'Marburg', 'Nördlingen', 'Meissen', 'Erfurt', 'Passau', 'Konstanz',
        'Rothenburg', 'Dinkelsbühl', 'Landshut', 'Görlitz', 'Wetzlar', 'Hameln'
    ]

    // Every village on the board with the name it keeps for the whole game. Assigned in
    // row-major order rather than at random, so every player at the table sees the same
    // name on the same square without any of it having to live in game state.
    const villages = $derived.by(() => {
        const found: { col: number; row: number; name: string }[] = []
        for (let row = 0; row < board.squares.length; row++) {
            for (let col = 0; col < board.squares[row].length; col++) {
                if (board.squares[row][col].type === SquareType.Village) {
                    found.push({ col, row, name: VILLAGE_NAMES[found.length % VILLAGE_NAMES.length] })
                }
            }
        }
        return found
    })

    const ghostWall = $derived.by(() => {
        const edge = nearestWallEdge
        if (!edge) return undefined
        return wallBetween(edge.col1, edge.row1, edge.col2, edge.row2)
    })

    // One pulsing directional arrow per legal expansion target, centered on the wall
    // it would cross - a replacement for ringing every legal square, once a region has
    // been picked to expand. Each candidate is adjacent to exactly the region-as-grown-
    // so-far (never diagonal - see ExpandRegion's own adjacency check), so there's
    // always a real wall between it and whichever already-claimed square it borders.
    const expansionArrows = $derived.by(() => {
        if (!expandStageActive || !gameSession.selectedExpandRegionId) return []
        const region = gameSession.gameState.regions.find((r) => r.id === gameSession.selectedExpandRegionId)
        if (!region) return []

        const claimed = new Set(region.squareKeys)
        for (const s of gameSession.expansionSquares) claimed.add(squareKey(s.col, s.row))

        const result: {
            key: string
            wall: NonNullable<ReturnType<typeof wallBetween>>
            direction: 'north' | 'south' | 'east' | 'west'
        }[] = []
        for (const candidate of gameSession.legalNextExpansionSquares) {
            const neighbor = neighbors(candidate.col, candidate.row).find((n) => claimed.has(squareKey(n.col, n.row)))
            if (!neighbor) continue
            const wall = wallBetween(neighbor.col, neighbor.row, candidate.col, candidate.row)
            if (!wall) continue

            let direction: 'north' | 'south' | 'east' | 'west'
            if (candidate.row < neighbor.row) direction = 'north'
            else if (candidate.row > neighbor.row) direction = 'south'
            else if (candidate.col < neighbor.col) direction = 'west'
            else direction = 'east'

            result.push({ key: `${candidate.col},${candidate.row}`, wall, direction })
        }
        return result
    })

    const ARROW_ROTATION: Record<'north' | 'south' | 'east' | 'west', number> = {
        north: 0,
        east: 90,
        south: 180,
        west: 270
    }

    // Walls around whichever space(s) have been picked for the region-in-progress but
    // not yet confirmed/dispatched - drawn the same way ExpandRegion itself would draw
    // them once applied (every edge that doesn't border the rest of the hypothetical
    // region), so the picked space visually reads as already merged in.
    const expansionPreviewWalls = $derived.by(() => {
        if (!expandStageActive || gameSession.expansionSquares.length === 0) return []
        const region = gameSession.gameState.regions.find((r) => r.id === gameSession.selectedExpandRegionId)
        if (!region) return []

        const claimed = new Set(region.squareKeys)
        for (const s of gameSession.expansionSquares) claimed.add(squareKey(s.col, s.row))

        const seen = new Set<string>()
        const result: NonNullable<ReturnType<typeof wallBetween>>[] = []
        for (const space of gameSession.expansionSquares) {
            for (const n of neighbors(space.col, space.row)) {
                if (!isOnBoard(n.col, n.row)) continue
                if (claimed.has(squareKey(n.col, n.row))) continue
                const wall = wallBetween(space.col, space.row, n.col, n.row)
                if (!wall) continue
                const wallKey = `${wall.col},${wall.row},${wall.edge}`
                if (seen.has(wallKey)) continue
                seen.add(wallKey)
                result.push(wall)
            }
        }
        return result
    })

    // The real wall(s) that used to bound the region right where a not-yet-confirmed
    // expansion pick borders it - about to become interior once the expansion is
    // actually applied (see ExpandRegion.apply's removeInteriorWalls), but a real
    // WallSegment there right now would still visually cut the picked space off from
    // the rest of the region. Suppressed from the real-walls render below so the pick
    // reads as already merged in, matching expansionPreviewWalls' own treatment of the
    // OTHER (still-exterior) edges.
    const expansionHiddenWallKeys = $derived.by(() => {
        if (!expandStageActive || gameSession.expansionSquares.length === 0) return new Set<string>()
        const region = gameSession.gameState.regions.find((r) => r.id === gameSession.selectedExpandRegionId)
        if (!region) return new Set<string>()

        const claimed = new Set(region.squareKeys)
        for (const s of gameSession.expansionSquares) claimed.add(squareKey(s.col, s.row))

        const hidden = new Set<string>()
        for (const space of gameSession.expansionSquares) {
            for (const n of neighbors(space.col, space.row)) {
                if (!isOnBoard(n.col, n.row)) continue
                if (!claimed.has(squareKey(n.col, n.row))) continue
                const wall = wallBetween(space.col, space.row, n.col, n.row)
                if (!wall) continue
                hidden.add(`${wall.col},${wall.row},${wall.edge}`)
            }
        }
        return hidden
    })

    // Flat-color fallback, only used for squares when the board has no tileLayout
    // (older boards assembled before real tile art was wired up) - otherwise the
    // actual board-a..f.jpg tile art (rendered behind the grid) shows through instead.
    const terrainBg: Record<SquareType, string> = {
        [SquareType.Blank]: '#e7dfc9',
        [SquareType.Forest]: '#4c7a3d',
        [SquareType.Hill]: '#9a6b3a',
        [SquareType.Village]: '#a63b3b'
    }

    function isSelected(col: number, row: number): boolean {
        const sel = gameSession.selectedCastleSquare
        return sel !== undefined && sel.col === col && sel.row === row
    }

    // Only the knight squares that would actually be legal for the selected castle -
    // not just any adjacent square - so the highlight matches what's clickable.
    function isLegalKnightSquare(col: number, row: number): boolean {
        const sel = gameSession.selectedCastleSquare
        if (!sel) return false
        return HydratedPlaceCastle.isValidKnightSquare(gameSession.gameState, sel.col, sel.row, col, row)
    }

    // Opening placement says what CANNOT be used rather than animating what can: a scrim over
    // every illegal square, leaving the legal ones reading as ordinary board. Both halves of the
    // two-click flow are covered - castle squares first, then the knight squares around the one
    // just picked.
    //
    // canPlaceCastle stays true across both halves because picking a castle square is local UI
    // state, not a game action, so the selection is what tells the two apart.
    // Which square the mouse is over, for the opening castle preview. Tracked on the square
    // buttons rather than the grid container: a div with a mouse handler wants an ARIA role, and
    // giving the board a half-built grid role would be worse for a screen reader than leaving the
    // buttons to speak for themselves.
    let hoveredSquare: { col: number; row: number } | undefined = $state(undefined)

    // A castle drawn under the cursor on a square that would take it. One square at a time, and
    // only before a castle square is picked - once one is, the question has moved on to its
    // knight.
    function isCastlePreviewSquare(col: number, row: number): boolean {
        if (!gameSession.canPlaceCastle || gameSession.selectedCastleSquare) return false
        if (hoveredSquare?.col !== col || hoveredSquare?.row !== row) return false
        return isLegalCastleSquare(col, row)
    }

    // How opening placement tells the player where a piece may go. Three treatments, all kept,
    // because which one reads best is a question for the eye rather than the code:
    //
    //   'legal' - the squares that WILL work, tinted in the placing colour with a matching
    //             border. Positive marking: the only one of the three that says yes.
    //   'gray'  - a scrim over every square that will not.
    //   'x'     - a red X in each square that will not.
    //
    // The two negative treatments were tried first, in that order.
    const PLACEMENT_HINT: 'legal' | 'gray' | 'x' = 'legal'

    // Illegal for the click being asked for right now, whichever mark is in use. Non-plains is
    // excluded here because terrain is a hard precondition the engine applies to the castle square
    // AND its knight, so a forest, hill or village was never in the running and saying so is
    // noise.
    function isIllegalPlacementSpot(col: number, row: number): boolean {
        if (!gameSession.canPlaceCastle) return false

        const square = board.squares[row]?.[col]
        if (square?.type !== SquareType.Blank) return false

        return gameSession.selectedCastleSquare
            ? !isLegalKnightSquare(col, row)
            : !isLegalCastleSquare(col, row)
    }

    // A scrim can go anywhere the rule applies: it dims a square rather than adding to it, so it
    // covers both halves of the flow and dims a piece along with its square.
    function showsIllegalScrim(col: number, row: number): boolean {
        return PLACEMENT_HINT === 'gray' && isIllegalPlacementSpot(col, row)
    }

    // The positive treatment: the squares the current click would actually accept. Covers both
    // halves of the flow - the castle squares, then the knight squares around the one picked - and
    // both are small enough sets that marking them is the clearer direction.
    function showsLegalHighlight(col: number, row: number): boolean {
        if (PLACEMENT_HINT !== 'legal' || !gameSession.canPlaceCastle) return false

        return gameSession.selectedCastleSquare
            ? isLegalKnightSquare(col, row)
            : isLegalCastleSquare(col, row)
    }

    // The X cannot go everywhere the scrim can, which is a property of the mark rather than of the
    // rule:
    //   - Not during the knight stage. At most four squares are legal there, so an X would land on
    //     nearly every plains square and measle the map. Dimming that many is fine; marking them
    //     is not.
    //   - Not on an occupied square. The piece already says "taken", and a glyph would either hide
    //     under it or deface it - where a scrim simply dims both together.
    function showsIllegalX(col: number, row: number): boolean {
        if (PLACEMENT_HINT !== 'x') return false
        if (gameSession.selectedCastleSquare) return false

        const square = board.squares[row]?.[col]
        if (square?.castleColor || square?.knightColor) return false

        return isIllegalPlacementSpot(col, row)
    }

    function isLegalCastleSquare(col: number, row: number): boolean {
        return legalCastleSquareSet.has(`${col},${row}`)
    }

    // Regular-play knight placement (distinct from isLegalKnightSquare, which is for
    // the setup-phase castle+knight two-click flow).
    function isLegalKnightPlacement(col: number, row: number): boolean {
        return legalKnightSquareSet.has(`${col},${row}`)
    }

    function isLegalExpansionSquare(col: number, row: number): boolean {
        return legalExpansionSquareSet.has(`${col},${row}`)
    }

    function isOwnSelectableRegion(col: number, row: number): boolean {
        if (gameSession.selectedExpandRegionId) return false
        const region = regionAt(col, row)
        return region !== undefined && myRegionIdSet.has(region.id)
    }

    // Same, but for the expansion flow specifically, which can't offer every region of
    // yours while one expansion is already under way (see expandableRegions).
    function isSelectableExpandRegion(col: number, row: number): boolean {
        if (gameSession.selectedExpandRegionId) return false
        const region = regionAt(col, row)
        return region !== undefined && expandableRegionIdSet.has(region.id)
    }

    function regionAt(col: number, row: number) {
        return regionBySquareKey.get(squareKey(col, row))
    }

    function isOwnSelectableRenegadeRegion(col: number, row: number): boolean {
        if (!gameSession.isPlayingRenegadeCard || gameSession.renegadeOwnRegionId) return false
        if (!isOwnSelectableRegion(col, row)) return false
        const region = regionAt(col, row)
        return region !== undefined && legalRenegadeOwnRegionIdSet.has(region.id)
    }

    function isSelectableRenegadeEnemyRegion(col: number, row: number): boolean {
        if (!gameSession.renegadeOwnRegionId || gameSession.renegadeEnemyRegionId) return false
        const region = regionAt(col, row)
        return region !== undefined && legalRenegadeEnemyRegionIds.has(region.id)
    }

    function isLegalRenegadeRemovableSquare(col: number, row: number): boolean {
        return !gameSession.renegadeRemovedSquare && legalRenegadeRemovableSquareSet.has(`${col},${row}`)
    }

    function isRenegadeRemovedSquare(col: number, row: number): boolean {
        const sel = gameSession.renegadeRemovedSquare
        return sel !== undefined && sel.col === col && sel.row === row
    }

    function isLegalRenegadePlacementSquare(col: number, row: number): boolean {
        return legalRenegadePlacementSquareSet.has(`${col},${row}`)
    }

    function isOwnSelectableAllianceRegion(col: number, row: number): boolean {
        if (!gameSession.isPlayingAllianceCard || gameSession.allianceOwnRegionId) return false
        if (!isOwnSelectableRegion(col, row)) return false
        // Only regions that actually have something to ally with (see
        // legalAllianceOwnRegionIds) - a dead-end region isn't clickable at all.
        const region = regionAt(col, row)
        return region !== undefined && legalAllianceOwnRegionIdSet.has(region.id)
    }

    function isSelectableAllianceEnemyRegion(col: number, row: number): boolean {
        if (!gameSession.allianceOwnRegionId) return false
        const region = regionAt(col, row)
        return region !== undefined && legalAllianceEnemyRegionIds.has(region.id)
    }

    // A faint tint in the owning prince's color over any square claimed by a region, so
    // newly-created regions are visible at a glance. A neutral zone gets no tint at all:
    // it isn't anybody's, and the walls around it already show it's a zone. (It used to
    // be painted #888888 - which is precisely the gray prince's own color, so an
    // unclaimed zone read as that player's territory, most alarmingly right after an
    // invasion cut one loose.) So: tinted means owned, untinted means unowned.
    function regionTint(col: number, row: number): string | undefined {
        const key = squareKey(col, row)

        // A space picked for the region-in-progress (not yet confirmed/dispatched)
        // reads as already part of the region, tinted the same as the rest of it -
        // rather than a separate "pending" ring - since the walls around it are drawn
        // the same way too (see expansionPreviewWalls).
        if (expandStageActive && gameSession.expansionSquares.some((s) => s.col === col && s.row === row)) {
            const region = regions.find((r) => r.id === gameSession.selectedExpandRegionId)
            if (region?.ownerColor) return gameSession.colors.getUiColor(region.ownerColor)
        }

        const region = regionBySquareKey.get(key)
        if (!region?.ownerColor) return undefined
        return gameSession.colors.getUiColor(region.ownerColor)
    }

    async function onSquareClick(col: number, row: number) {
        if (gameSession.isPlayingAllianceCard) {
            if (!gameSession.allianceOwnRegionId) {
                if (isOwnSelectableAllianceRegion(col, row)) {
                    const region = regionAt(col, row)
                    if (region) gameSession.selectAllianceOwnRegion(region.id)
                }
                return
            }
            if (isSelectableAllianceEnemyRegion(col, row)) {
                const region = regionAt(col, row)
                if (region) await gameSession.selectAllianceEnemyRegion(region.id)
            }
            return
        }

        if (gameSession.isPlayingRenegadeCard) {
            if (!gameSession.renegadeOwnRegionId) {
                if (isOwnSelectableRenegadeRegion(col, row)) {
                    const region = regionAt(col, row)
                    if (region) gameSession.selectRenegadeOwnRegion(region.id)
                }
                return
            }
            if (!gameSession.renegadeEnemyRegionId) {
                if (isSelectableRenegadeEnemyRegion(col, row)) {
                    const region = regionAt(col, row)
                    if (region) gameSession.selectRenegadeEnemyRegion(region.id)
                }
                return
            }
            if (!gameSession.renegadeRemovedSquare) {
                if (isLegalRenegadeRemovableSquare(col, row)) {
                    gameSession.selectRenegadeRemovedSquare(col, row)
                }
                return
            }
            if (isLegalRenegadePlacementSquare(col, row)) {
                await gameSession.confirmRenegadePlacement(col, row)
            }
            return
        }

        if (gameSession.selectedCastleSquare) {
            // Ignored too, for consistency within one flow - and because reporting it used to
            // clear the selection, so a stray click took the castle back off the board. The ring
            // marks the squares that will work, and Undo releases the castle.
            if (isLegalKnightSquare(col, row)) {
                await gameSession.placeCastleWithKnight(col, row)
            }
            return
        }

        if (gameSession.canPlaceCastle) {
            // Ignored rather than explained: the X on the square has already said why, and an
            // error dialog for a click the board visibly refused is nagging.
            if (isLegalCastleSquare(col, row)) {
                gameSession.selectCastleSquare(col, row)
            }
            return
        }

        if (expandStageActive) {
            if (!gameSession.selectedExpandRegionId) {
                if (isSelectableExpandRegion(col, row)) {
                    const key = squareKey(col, row)
                    const region = gameSession.expandableRegions.find((r) => r.squareKeys.includes(key))
                    if (region) gameSession.selectRegionToExpand(region.id)
                }
                return
            }
            if (isLegalExpansionSquare(col, row)) {
                await gameSession.addExpansionSquare(col, row)
                return
            }
            // Under an expand-then-knight plan the knight is live alongside the
            // expansion's optional 2nd space, and placing it is what ends the expansion
            // early - the only way to stop at one space now that there's no Done button.
            // Expanding wins on a square that would serve either purpose (it's the stage
            // the plan says comes first); Undo covers a misclick.
            if (knightStageActive && isLegalKnightPlacement(col, row)) {
                await gameSession.placeKnight(col, row)
            }
            return
        }

        // Deliberately not gated on isLegalKnightPlacement - placeKnight reports exactly
        // why an illegal square was rejected, which is more useful than a dead click.
        if (knightStageActive) {
            await gameSession.placeKnight(col, row)
        }
    }

    let { onFrameOffset }: { onFrameOffset?: (px: number) => void } = $props()

    // Reports how far the castle-wall frame sits below this component's own top edge
    // (the status/instruction text above it grows and shrinks with game state, so
    // this isn't a fixed number) - lets Board.svelte match that same offset on the
    // deck-piles column so their tops stay level with the actual board frame instead
    // of the top of this whole component. Reported in LAYOUT px: the rects below are
    // post-transform (ScalingWrapper - see the hoverPoint note above), but Board.svelte
    // spends this as a padding-top inside that same transform, so a screen-px number
    // would drift the piles off the frame by 1/scale at any zoom but 1:1.
    let rootEl: HTMLElement | undefined = $state()
    let frameEl: HTMLElement | undefined = $state()
    $effect(() => {
        if (!rootEl || !frameEl || !onFrameOffset) return
        const report = () => {
            const rootRect = rootEl!.getBoundingClientRect()
            const frameRect = frameEl!.getBoundingClientRect()
            const scale = rootEl!.offsetHeight > 0 ? rootRect.height / rootEl!.offsetHeight : 1
            const safeScale = scale > 0 ? scale : 1
            onFrameOffset!((frameRect.top - rootRect.top) / safeScale)
        }
        report()
        const observer = new ResizeObserver(report)
        observer.observe(rootEl)
        return () => observer.disconnect()
    })
</script>

{#snippet pieceIcon(fillSrc: string, linesSrc: string, color: Color, offsetY: number = 0)}
    <!-- fillSrc is a black silhouette used as a mask so background-color (the exact
         player color, boosted a bit via filter below) shows through only inside the
         shape; linesSrc is the same artwork's outline/detail work (transparent
         everywhere else) layered on top, so it stays crisp regardless of fill color.
         offsetY nudges the knight artwork up 1px to match how it actually sits on the
         tile art - castles don't need it. A soft white glow (drop-shadow follows the
         piece's own silhouette, not a box) helps darker knight colors stay visible
         against busy forest tiles. -->
    <div
        class="absolute inset-[3px]"
        style="
            {offsetY ? `transform: translateY(${offsetY}px);` : ''}
            filter: drop-shadow(0 0 1.5px rgba(255, 255, 255, 0.9)) drop-shadow(0 0 3px rgba(255, 255, 255, 0.8));
        "
    >
        <div
            class="absolute inset-0"
            style="
                background-color:{gameSession.colors.getUiColor(color)};
                mask-image:url({fillSrc}); mask-size:contain; mask-repeat:no-repeat; mask-position:center;
                -webkit-mask-image:url({fillSrc}); -webkit-mask-size:contain; -webkit-mask-repeat:no-repeat; -webkit-mask-position:center;
                filter: saturate(1.5) brightness(1.15);
            "
        ></div>
        <img src={linesSrc} alt="" class="absolute inset-0 w-full h-full object-contain" />
    </div>
{/snippet}

{#snippet ducatMedallion()}
    <!-- The same embossed-parchment coin the player panels mint their ducat count on
         (see PlayerState's tintedIcon), reused here so a price on the board reads in the
         game's own currency iconography. Tinted in my own color - it's my money. -->
    <div
        class="absolute inset-0 rounded-full"
        style="
            background: radial-gradient(circle at 38% 30%, #fdfaf0 0%, #efe6d0 58%, #d3c3a0 100%);
            border: 1px solid rgba(94, 73, 42, 0.5);
            box-shadow: inset 0 1px 1.5px rgba(255, 255, 255, 0.75), 0 1px 2px rgba(0, 0, 0, 0.4);
        "
    ></div>
    <div class="absolute inset-[16%]" style="filter: drop-shadow(0 0.5px 1px rgba(0, 0, 0, 0.45));">
        <div
            class="absolute inset-0"
            style="
                background-color:{myColor ? gameSession.colors.getUiColor(myColor) : '#d4af37'};
                mask-image:url({iconMoneybagFill}); mask-size:contain; mask-repeat:no-repeat; mask-position:center;
                -webkit-mask-image:url({iconMoneybagFill}); -webkit-mask-size:contain; -webkit-mask-repeat:no-repeat; -webkit-mask-position:center;
                filter: saturate(1.7) brightness(1.18);
            "
        ></div>
        <img src={iconMoneybagLines} alt="" class="absolute inset-0 w-full h-full object-contain" />
    </div>
{/snippet}

{#snippet playerPill(playerId: string)}
    <PlayerPill {playerId} />
{/snippet}

{#snippet myPill()}
    {#if gameSession.myPlayer}
        {@render playerPill(gameSession.myPlayer.id)}
    {/if}
{/snippet}

{#snippet playerPillList(playerIds: string[])}
    {#each playerIds as playerId, i (playerId)}
        {i > 0 ? (i === playerIds.length - 1 ? ' and ' : ', ') : ''}{@render playerPill(playerId)}
    {/each}
{/snippet}

{#snippet duelBidStepper(playerId: string, bidAmount: number, maxAmount: number)}
    <button
        type="button"
        class="leading-none px-2 pt-[3px] pb-[2px] rounded bg-black/10 hover:bg-black/20 font-semibold disabled:opacity-40"
        disabled={bidAmount <= 0}
        onclick={() => {
            duelBidAmounts[playerId] = Math.max(0, bidAmount - 1)
        }}
    >
        −
    </button>
    <span class="w-6 text-center font-semibold">{bidAmount}</span>
    <button
        type="button"
        class="leading-none px-2 pt-[3px] pb-[2px] rounded bg-black/10 hover:bg-black/20 font-semibold disabled:opacity-40"
        disabled={bidAmount >= maxAmount}
        onclick={() => {
            duelBidAmounts[playerId] = bidAmount + 1
        }}
    >
        +
    </button>
    <span>ducat{bidAmount === 1 ? '' : 's'}</span>
{/snippet}

{#snippet bidList(bids: SubmitDuelBid[])}
    {#each bids as bid, i (bid.playerId)}
        {i > 0 ? ', ' : ''}{@render playerPill(bid.playerId)} bid {bid.amount} ducat{bid.amount === 1
            ? ''
            : 's'}{#if bid.metadata?.treasureCardUsed}
            {' '}+ Treasure ({bid.metadata.treasureCardUsed.value}){/if}
    {/each}
{/snippet}

<!-- items-center so each message box is centred over the board rather than
     starting at its left edge; text-center on the boxes themselves handles the
     wrapping lines within them. -->
<div class="flex flex-col gap-2 items-center" bind:this={rootEl}>
    <!-- Warms up the Tangerine signature font as soon as the board mounts, so it's
         already cached by the time anyone actually signs a negotiation (see
         .signature-text-warmup in app.css). -->
    <span class="signature-text-warmup" aria-hidden="true">warmup</span>
    <!-- Stepping back through history leaves every message below stale: they narrate the
         live game ("waiting for X", "click a region..."), which says nothing about the
         moment you've rewound to. So while in history, lead with what the action you're
         looking at actually did - the same sentence the history feed uses, since
         gameSession.actions already reflects the visible (rewound) context rather than the
         live one. Same idea as Sol's LastActionDescription, just scoped to history. -->
    {#if historyAction}
        <div class="text-black text-[20px] text-center border-b-2 border-black/15 pb-1">
            <span class="italic text-black/60 text-[16px]">Rewound to:</span>
            {#if historyAction.playerId}
                {@render playerPill(historyAction.playerId)}
            {/if}
            <ActionDescription action={historyAction} justify="start" history={false} />
        </div>
    {/if}
    {#if lastBankWin}
        <div class="text-black text-[20px] text-center">
            {@render playerPill(lastBankWin.playerId)} gained {lastBankWin.amount} ducat{lastBankWin.amount === 1
                ? ''
                : 's'} from the bank.
        </div>
    {/if}
    {#if lastDuelOutcome?.type === 'giveUp'}
        <div class="text-black text-[20px] text-center">
            {@render bidList(lastDuelOutcome.bids)} — tied again, so no one performs the{lastDuelOutcome.actionNoun
                ? ` ${lastDuelOutcome.actionNoun}`
                : ''} action.
        </div>
    {/if}
    {#if lastAllianceCancellation}
        {@const otherId = playerIdForColor(lastAllianceCancellation.otherColor)}
        {@const cancelerIsMe = gameSession.myPlayer?.id === lastAllianceCancellation.playerId}
        {@const otherIsMe = otherId !== undefined && otherId === gameSession.myPlayer?.id}
        <!-- Names the price, since that's the whole weight of the decision - and the
             cancellation is now a single board click (see the alliance hearts), so this is
             where the 10 ducats leaving your purse gets accounted for. -->
        <div class="text-black text-[20px] text-center">
            {#if cancelerIsMe}
                You paid
            {:else}
                {@render playerPill(lastAllianceCancellation.playerId)} paid
            {/if}
            {ALLIANCE_CANCELLATION_COST} ducats to cancel an alliance with
            {#if otherIsMe}
                you
            {:else if otherId}
                {@render playerPill(otherId)}
            {:else}
                a neutral prince
            {/if}.
        </div>
    {/if}
    <div class="text-black text-[20px] text-center leading-loose">
        {#if gameSession.isPlayingAllianceCard}
            <!-- No "that region has nothing to ally with" case to report: a region with no
                 eligible neighbor isn't offered in the first place (see
                 legalAllianceOwnRegionIds), so reaching the second step guarantees there's
                 something to click. -->
            {#if !gameSession.allianceOwnRegionId}
                Playing Alliance — click one of your regions.
            {:else}
                Click a bordering enemy region.
            {/if}
        {:else if gameSession.isPlayingRenegadeCard}
            {#if !gameSession.renegadeOwnRegionId}
                {#if legalRenegadeOwnRegionIdSet.size === 0}
                    None of your regions can play Renegade right now — they either have no
                    room for the replacement knight (no open space, or they can't afford a
                    wooded one) or nothing bordering them to take a knight from. Click Undo.
                {:else}
                    Playing Renegade — click one of your regions.
                {/if}
            {:else if !gameSession.renegadeEnemyRegionId}
                Now click a bordering enemy region.
            {:else if !gameSession.renegadeRemovedSquare}
                {#if gameSession.legalRenegadeRemovableSquares.length === 0}
                    Every knight in that region is protecting another from being cut off from
                    its castle — none can safely be removed. Click Undo to try again.
                {:else}
                    Click the enemy knight to remove.
                {/if}
            {:else}
                Now click a square in your region to place your knight in exchange.
            {/if}
        {:else if gameSession.canPlaceCastle}
            {#if gameSession.selectedCastleSquare}
                Place a knight adjacent to the castle.
            {:else}
                Place a castle on the board.
            {/if}
        {:else if gameSession.canPlaceWall}
            {#if lastNegotiationPayment && lastNegotiationPayment.fromPlayerId === gameSession.gameState.wallPlacingPlayerId}
                {@render playerPill(lastNegotiationPayment.fromPlayerId)} paid {@render playerPill(
                    lastNegotiationPayment.toPlayerId
                )}
                {lastNegotiationPayment.amount} ducat{lastNegotiationPayment.amount === 1
                    ? ''
                    : 's'} for the walls action.
            {:else if lastDuelOutcome?.type === 'win' && lastDuelOutcome.winnerId === gameSession.gameState.wallPlacingPlayerId}
                {@render playerPill(lastDuelOutcome.winnerId)} outspent {@render playerPillList(
                    lastDuelOutcome.otherIds
                )} to win a wall action.
            {:else}
                {@render myPill()} won a wall action.
            {/if}
            Place {gameSession.gameState.wallsRemaining} wall{gameSession.gameState.wallsRemaining === 1
                ? ''
                : 's'} or
            <button
                type="button"
                class="leading-none px-2 pt-[3px] pb-[2px] rounded bg-black/10 text-black hover:bg-black/20"
                onclick={() => gameSession.passWallPlacement()}
            >
                pass
            </button>.
        {:else if gameSession.canPlaceKnight && gameSession.knightPlan}
            <!-- A plan's already declared, so this just narrates the current step. No
                 confirm or cancel buttons: every step is a board click, and Undo (which
                 backs out of the plan itself while nothing's landed yet - see
                 ActionToolbar) is the way back. Pass stays, since declining the rest of
                 an action is a real rulebook option, not a cancel. -->
            {#if expandStageActive && !gameSession.selectedExpandRegionId}
                Click one of your regions to expand it.
            {:else if expansionDeadEnd}
                <!-- Names the rule that's actually in the way (see
                     expansionBlockedReasons) rather than leaving the player to guess -
                     usually the invasion knight-count rule, which is easy to be
                     surprised by, and which now comes with the real counts attached. -->
                This region has nowhere legal to expand into right now{#if expansionBlockedReasons.length > 0}
                    — {expansionBlockedReasons.join('; ')}{/if}.{#if knightStageActive}
                    Click a square to place a knight instead.{:else if gameSession.expandableRegions.length > 1}
                    Click Undo to pick a different region.{/if}
            {:else if expandStageActive}
                <!-- Counted from engine state (see expansionSpacesTaken), not the local
                     record of clicks, so an Undo mid-expansion doesn't leave this
                     claiming a space that's been taken back. -->
                Click to expand ({gameSession.expansionSpacesTaken}/2 so far){#if knightStageActive}, or
                    place your knight to stop expanding{/if}.
            {:else}
                <!-- Only a two-knights plan has more than one to place - under the mixed
                     plans the leftover sword is earmarked for the expansion, so a count
                     there would be misleading. -->
                Click a square to place your knight{gameSession.knightPlan === 'twoKnights' &&
                knightSwordsLeft > 1
                    ? ` (${knightSwordsLeft} to place)`
                    : ''}.
            {/if}
            Or
            <button
                type="button"
                class="leading-none px-2 pt-[3px] pb-[2px] rounded bg-black/10 text-black hover:bg-black/20"
                onclick={() => gameSession.passKnightPlacement()}
            >
                pass
            </button>
            to stop here.
        {:else if gameSession.canPlaceKnight}
            {#if lastNegotiationPayment && lastNegotiationPayment.fromPlayerId === gameSession.gameState.knightPlacingPlayerId}
                {@render playerPill(lastNegotiationPayment.fromPlayerId)} paid {@render playerPill(
                    lastNegotiationPayment.toPlayerId
                )}
                {lastNegotiationPayment.amount} ducat{lastNegotiationPayment.amount === 1
                    ? ''
                    : 's'} for the knights action.
            {:else if lastDuelOutcome?.type === 'win' && lastDuelOutcome.winnerId === gameSession.gameState.knightPlacingPlayerId}
                {@render playerPill(lastDuelOutcome.winnerId)} outspent {@render playerPillList(
                    lastDuelOutcome.otherIds
                )} to win a knight action.
            {:else}
                {@render myPill()} won a knight action.
            {/if}
            <!-- The whole shape of the action is chosen here, up front - for a two-sword
                 card that's exactly three possibilities (see availableKnightPlans), minus
                 any whose halves aren't actually available. Everything after this is
                 board clicks; a single available plan is auto-picked, so this prompt only
                 appears when there's a genuine choice. -->
            {#if availableKnightPlans.length === 0}
                There's nothing legal left to do with it, so
                <button
                    type="button"
                    class="leading-none px-2 pt-[3px] pb-[2px] rounded bg-black/10 text-black hover:bg-black/20"
                    onclick={() => gameSession.passKnightPlacement()}
                >
                    pass
                </button>.
            {:else}
                Either
                {#each availableKnightPlans as plan, i (plan)}{i > 0 ? ' or ' : ''}<button
                        type="button"
                        class="leading-none px-2 pt-[3px] pb-[2px] rounded bg-black/10 text-black hover:bg-black/20"
                        onclick={() => choosePlan(plan)}
                    >
                        {KNIGHT_PLAN_LABELS[plan]}
                    </button>{/each}
                or
                <button
                    type="button"
                    class="leading-none px-2 pt-[3px] pb-[2px] rounded bg-black/10 text-black hover:bg-black/20"
                    onclick={() => gameSession.passKnightPlacement()}
                >
                    pass
                </button>.
            {/if}
        {:else if lastMineReveal}
            {@const mineScorers = lastMineReveal.filter((entry) => entry.points > 0)}
            <!-- Who earned what is shown as a "+N" hanging under each player's points box
                 in the action bar above (see ActionToolbar) rather than as a row of text
                 per scorer down here - the numbers land right where that player's
                 running total already is, and this stays one line. -->
            A Silver Mine!
            {#if mineScorers.length === 0}
                No hills were enclosed, so no points were awarded.
            {/if}
            {#if gameSession.canDrawActionCard}
                Click the action card draw pile to start the next round.
            {:else}
                Waiting for {@render playerPill(gameSession.gameState.firstPlayerId)} to draw the
                next action card...
            {/if}
        {:else if lastRoundEndedInDuelGiveUp}
            The duel was tied a second time, so no one performs the action.
            {#if gameSession.canDrawActionCard}
                Click the action card draw pile to start the next round.
            {:else}
                Waiting for {@render playerPill(gameSession.gameState.firstPlayerId)} to draw the
                next action card...
            {/if}
        {:else if gameSession.canDrawActionCard}
            Click the action card draw pile to start the next round.
        {:else if gameSession.gameState.machineState === MachineState.StartOfTurn}
            Waiting for {@render playerPill(gameSession.gameState.firstPlayerId)} to draw the
            next action card...
        {:else if gameSession.canChooseAction}
            <!-- Below 4 players the first player lays 2 decision cards (see
                 buildDecisionPlan). No need to announce the count: the ordinal on the
                 follow-up prompt ("a second region") is what tells them their turn isn't
                 over, and it says it exactly when it matters. -->
            {@const decisions = gameSession.myDecisionsThisRound}
            {#if decisions.laid > 0}
                Click a {decisions.laid === 1 ? 'second' : 'third'} region of the card for
                your next action.
            {:else}
                Click a region of the card to pick an action.
            {/if}
        {:else if gameSession.gameState.machineState === MachineState.ChoosingActions}
            Waiting for the next player to choose...
        {:else if gameSession.gameState.machineState === MachineState.Negotiating && gameSession.gameState.negotiation}
            Negotiate for {negotiationActionNoun} or
            <button
                type="button"
                class="leading-none px-2 pt-[3px] pb-[2px] rounded bg-red-700/10 hover:bg-red-700/20 font-semibold disabled:opacity-40"
                disabled={!gameSession.isNegotiator}
                onclick={() => gameSession.declineNegotiation()}
            >
                force a duel
            </button>.
        {:else if gameSession.gameState.machineState === MachineState.Dueling && gameSession.gameState.duel}
            <!-- The duelists are named right here rather than getting a row each below,
                 so the whole duel fits in two lines: who's in it, then your own bid. -->
            Dueling for {duelActionNoun}{gameSession.gameState.duel.tieCount >= 1
                ? ' again'
                : ''}: {@render playerPillList(gameSession.gameState.duel.playerIds)}.
            {#if previousTiedRoundBids}
                <!-- Kept on its own line, unlike the other two-sentence messages: naming
                     the duelists and then listing everyone's previous bid is reliably too
                     long to sit on one line, so letting it wrap mid-sentence reads worse
                     than an intentional break here. -->
                <br class="block mb-0.5" />
                Tied last round: {@render bidList(previousTiedRoundBids)}.
            {/if}
        {:else if gameSession.canTakePoliticsCard && !gameSession.selectedPoliticsPile}
            {#if lastNegotiationPayment && lastNegotiationPayment.fromPlayerId === gameSession.gameState.politicsTakingPlayerId}
                {@render playerPill(lastNegotiationPayment.fromPlayerId)} paid {@render playerPill(
                    lastNegotiationPayment.toPlayerId
                )}
                {lastNegotiationPayment.amount} ducat{lastNegotiationPayment.amount === 1
                    ? ''
                    : 's'} for the politics action.
            {:else if lastDuelOutcome?.type === 'win' && lastDuelOutcome.winnerId === gameSession.gameState.politicsTakingPlayerId}
                {@render playerPill(lastDuelOutcome.winnerId)} outspent {@render playerPillList(
                    lastDuelOutcome.otherIds
                )} to win Crown and Scepter.
            {:else}
                {@render myPill()} won Crown and Scepter.
            {/if}
            Click one of the politics piles to look through it.
        {:else if !gameSession.setupComplete}
            Waiting for the other player(s) to place a castle...
        {/if}
    </div>

    <!-- Cancelling an alliance used to be offered as a sentence-with-a-button here. It's
         the beating heart on the shared boundary wall now (see allianceMarkers) - the price
         and the consequence both show on hover, and the affordance stays put on the board
         instead of appearing in a status area whose other messages are turn-scoped. -->

    {#if displayNegotiation}
        {@const negotiation = displayNegotiation}
        <div class="flex flex-col gap-2 text-black text-sm">
            <div class="flex flex-wrap items-center gap-2 text-[20px]">
                <div class="flex flex-col leading-tight border border-black/30 rounded px-2 py-1">
                    {#each negotiation.playerIds as playerId (playerId)}
                        <button
                            type="button"
                            disabled={!gameSession.isNegotiator}
                            class="text-left {negotiationProposerId === playerId
                                ? 'font-semibold text-black'
                                : 'text-black/40 hover:text-black/60'}"
                            onclick={() => (negotiationProposerId = playerId)}
                        >
                            {playerName(gameSession, playerId)}
                        </button>
                    {/each}
                </div>
                <span>offers</span>
                <button
                    type="button"
                    class="leading-none px-2 pt-[3px] pb-[2px] rounded bg-black/10 hover:bg-black/20 font-semibold disabled:opacity-40"
                    disabled={!gameSession.isNegotiator || negotiationAmount <= 1}
                    onclick={() => (negotiationAmount = Math.max(1, negotiationAmount - 1))}
                >
                    −
                </button>
                <span class="w-6 text-center font-semibold">{negotiationAmount}</span>
                <button
                    type="button"
                    class="leading-none px-2 pt-[3px] pb-[2px] rounded bg-black/10 hover:bg-black/20 font-semibold disabled:opacity-40"
                    disabled={!gameSession.isNegotiator || negotiationAmount >= negotiationProposerMoney}
                    onclick={() => (negotiationAmount = negotiationAmount + 1)}
                >
                    +
                </button>
                <span>
                    ducat{negotiationAmount === 1 ? '' : 's'} to {negotiationOtherPlayerId
                        ? playerName(gameSession, negotiationOtherPlayerId)
                        : ''}
                </span>
            </div>

            <div class="flex flex-wrap items-center gap-4">
                {#each orderedNegotiatorIds as playerId (playerId)}
                    <div class="flex items-center gap-2">
                        <button
                            type="button"
                            class="px-2 py-[3px] rounded bg-green-700/20 hover:bg-green-700/30 font-semibold disabled:opacity-40 disabled:hover:bg-green-700/20"
                            disabled={gameSession.myPlayer?.id !== playerId ||
                                negotiation.signedPlayerIds.includes(playerId)}
                            onclick={() => commitNegotiationOffer()}
                        >
                            Signed
                        </button>
                        <span class="signature-text inline-block h-8 w-32 border-b border-black/40 px-1">
                            {#if negotiation.signedPlayerIds.includes(playerId)}
                                {playerName(gameSession, playerId)}
                            {/if}
                        </span>
                        {#if SHOW_NEGOTIATION_TEST_CONTROLS && negotiation.offer && gameSession.myPlayer?.id !== playerId && !negotiation.signedPlayerIds.includes(playerId)}
                            <button
                                type="button"
                                title="Temporary solo-testing stand-in for a second session/tab"
                                class="px-1.5 py-0.5 rounded border border-dashed border-black/40 text-black/60 text-xs hover:bg-black/10"
                                onclick={() => gameSession.debugSignNegotiationOfferAs(playerId)}
                            >
                                sign for them (test)
                            </button>
                        {/if}
                    </div>
                {/each}
            </div>
        </div>
    {/if}

    {#if gameSession.gameState.machineState === MachineState.Dueling && gameSession.gameState.duel}
        {@const duel = gameSession.gameState.duel}
        {@const myId = gameSession.myPlayer?.id}
        <div class="flex flex-col gap-1 text-black text-[18px]">
            <!-- Your own bid, and nothing else - the duelists are all named in the status
                 message above instead of getting a row each, and a sealed bid means an
                 opponent's row would have had nothing actionable on it anyway. This row
                 does confirm your OWN bid once it's in, since the action bar keeps
                 listing every duelist as active for the whole duel (see dueling.ts's
                 enter()) and nothing else on screen would tell you it landed. -->
            {#if myId && duel.playerIds.includes(myId)}
                {@const money = gameSession.gameState.getPlayerState(myId).money}
                {@const bidAmount = Math.min(duelBidAmounts[myId] ?? 0, money)}
                <div class="flex flex-wrap items-center gap-2">
                    {#if gameSession.hasPlayerBidInDuel(myId)}
                        <span class="text-black/60">Your bid is in.</span>
                    {:else}
                        <span class="font-semibold">Your bid:</span>
                        {@render duelBidStepper(myId, bidAmount, money)}
                        {#if gameSession.selectedTreasureCard}
                            <!-- Clicking the chip unarms the card. This is the ONLY way back:
                                 arming is local UI state, not a game action, so Undo never
                                 touches it, and APPLY in the hand only ever arms. It used to
                                 be a "don't play it" button on a sentence below. -->
                            <button
                                type="button"
                                class="px-1.5 py-[3px] rounded font-semibold bg-green-700/15 hover:bg-red-700/20"
                                title="Click to take this Treasure back out of your bid"
                                onclick={() => gameSession.selectTreasureCard(undefined)}
                            >
                                + Treasure ({gameSession.selectedTreasureCard.value}) ✕
                            </button>
                        {/if}
                        <button
                            type="button"
                            class="px-2 py-[3px] rounded bg-green-700/20 hover:bg-green-700/30 font-semibold"
                            onclick={() =>
                                gameSession.submitDuelBid(
                                    bidAmount,
                                    gameSession.selectedTreasureCard?.id
                                )}
                        >
                            Submit bid
                        </button>
                        <!-- Sits beside the button rather than in a sentence of its own
                             below: it only needs to tell a duelist the option exists, and
                             the how-to (open your hand, hit APPLY) is the same gesture a
                             Treasure takes everywhere else in the game. Once one is armed
                             this gives way to the confirmation row underneath. -->
                        {#if gameSession.myTreasureCards.length > 0 && !gameSession.selectedTreasureCard}
                            <span class="text-black/70 text-[15px]">Nudge: You hold a Treasure!</span>
                        {/if}
                    {/if}
                </div>
            {/if}

            <!-- Solo-testing stand-in for a second session, kept to one shared row of
                 small dashed buttons (one per opponent who hasn't bid), each expanding
                 into a stepper only once clicked. Flip SHOW_DUEL_TEST_CONTROLS off to
                 lose this row entirely. -->
            {#if SHOW_DUEL_TEST_CONTROLS}
                {@const pending = duel.playerIds.filter(
                    (id) => id !== myId && !gameSession.hasPlayerBidInDuel(id)
                )}
                {#if pending.length > 0}
                    <div class="flex flex-wrap items-center gap-2">
                        {#each pending as playerId (playerId)}
                            {@const money = gameSession.gameState.getPlayerState(playerId).money}
                            {@const bidAmount = Math.min(duelBidAmounts[playerId] ?? 0, money)}
                            {#if testBiddingForPlayerId === playerId}
                                {@render playerPill(playerId)}
                                {@render duelBidStepper(playerId, bidAmount, money)}
                                <button
                                    type="button"
                                    class="px-1.5 py-0.5 rounded border border-dashed border-black/40 text-black/60 text-xs hover:bg-black/10"
                                    onclick={() => {
                                        gameSession.debugSubmitDuelBidAs(playerId, bidAmount)
                                        testBiddingForPlayerId = undefined
                                    }}
                                >
                                    submit (test)
                                </button>
                            {:else}
                                <button
                                    type="button"
                                    title="Temporary solo-testing stand-in for a second session/tab"
                                    class="px-1.5 py-0.5 rounded border border-dashed border-black/40 text-black/60 text-xs hover:bg-black/10"
                                    onclick={() => (testBiddingForPlayerId = playerId)}
                                >
                                    bid for {playerName(gameSession, playerId)} (test)
                                </button>
                            {/if}
                        {/each}
                    </div>
                {/if}
            {/if}

            <!-- There's deliberately no card picker in the bid row above: a Treasure
                 card is played the same way everywhere else in the game - open your
                 hand (click your cards in your player panel), then hit APPLY on the
                 card, which arms it (see PoliticsHand/selectTreasureCard) for the bid
                 you submit next. This line only exists so a duelist knows the option is
                 there at all, and then confirms it once a card is armed. -->
        </div>
    {/if}

    {#if gameSession.errorMessage}
        <div class="text-red-700 text-sm font-medium">
            {gameSession.errorMessage}
        </div>
    {/if}

    <!-- A hand-hewn castle-wall frame (see RampartBorder/RampartCorner) around the
         actual board content, sized in a 3x3 grid so the border strips stretch to
         exactly match the board's own width/height. -->
    <!-- The id is how things outside this component find the board's real position on
         screen - currently the region-scoring aid, which centers itself on the frame (see
         ActionToolbar). -->
    <div
        id="lowenherz-board-frame"
        bind:this={frameEl}
        class="grid drop-shadow-[0_6px_14px_rgba(0,0,0,0.4)]"
        style="grid-template-columns: 20px {boardWidthPx}px 20px; grid-template-rows: 20px {boardHeightPx}px 20px; width: fit-content;"
    >
        <RampartCorner />
        <div><RampartBorder side="top" /></div>
        <RampartCorner />

        <div><RampartBorder side="left" /></div>
        <div
            class="relative"
            style="width: fit-content;"
            role="presentation"
            onmousemove={(e) => {
                hoverPoint = boardPointFromEvent(e.currentTarget, e.clientX, e.clientY)
            }}
            onmouseleave={() => (hoverPoint = undefined)}
        >
        {#if tileLayout.length > 0}
            <!-- The 6 physical board tiles, positioned and rotated exactly as this game
                 assembled them - sits behind the clickable square grid below. -->
            <!-- Negative z-index (not a lower positive one) so this stays behind the
                 grid below without needing to move the grid into the positioned
                 stacking layer itself - the grid must stay a plain static element so
                 the wall bars/click-targets (painted after it, unpositioned-relative
                 z-auto) keep rendering on top of it, exactly as before this change. -->
            <div
                class="absolute overflow-hidden pointer-events-none -z-10"
                style="top:1px; left:1px; width:{board.squares[0].length * CELL_SIZE}px; height:{board.squares
                    .length * CELL_SIZE}px;"
            >
                {#each tileLayout as tile (tile.tileCol + ',' + tile.tileRow)}
                    <img
                        src={tileImages[tile.tileId]}
                        alt=""
                        class="absolute"
                        style="
                            left: {tile.tileCol * TILE_PX}px;
                            top: {tile.tileRow * TILE_PX}px;
                            width: {TILE_PX}px;
                            height: {TILE_PX}px;
                            transform: rotate({tile.rotation}deg);
                        "
                    />
                {/each}
            </div>
        {/if}
        <div
            class="grid border-2 border-black/60"
            style="grid-template-columns: repeat({board.squares[0].length}, {CELL_SIZE}px);"
        >
            {#each board.squares as rowSquares, row (row)}
                {#each rowSquares as square, col (col)}
                    {@const tint = regionTint(col, row)}
                    <button
                        type="button"
                        onclick={() => onSquareClick(col, row)}
                        onmouseenter={() => (hoveredSquare = { col, row })}
                        onmouseleave={() => {
                            // Guarded so that moving between two squares cannot blank the
                            // preview: leaving A clears only while A is still the hovered one, and
                            // entering B has already overwritten it by then.
                            if (hoveredSquare?.col === col && hoveredSquare?.row === row) {
                                hoveredSquare = undefined
                            }
                        }}
                        class="relative flex items-center justify-center border border-black/20 {isSelected(col, row) ? 'ring-4 ring-yellow-300 z-10' : ''} {isLegalKnightSquare(col, row) && PLACEMENT_HINT !== 'legal' ? 'ring-2 ring-yellow-100' : ''}"
                        style="width:{CELL_SIZE}px; height:{CELL_SIZE}px; {tileLayout.length > 0 ? '' : `background-color:${terrainBg[square.type]};`}"
                    >
                        {#if tint}
                            {@const pulsing =
                                (expandStageActive && isSelectableExpandRegion(col, row)) ||
                                isOwnSelectableRenegadeRegion(col, row) ||
                                isOwnSelectableAllianceRegion(col, row) ||
                                isSelectableRenegadeEnemyRegion(col, row) ||
                                isSelectableAllianceEnemyRegion(col, row)}
                            <!-- Same region tint as always, but pulsing (rather than a ring
                                 around the square) while it's a region the player could
                                 currently pick - their own, to expand it or as the starting
                                 region for a Renegade/Alliance card, or a bordering enemy
                                 region to target with one. -->
                            <span
                                class="absolute inset-0 pointer-events-none {pulsing ? 'region-expand-pulse' : ''}"
                                style="background-color:{tint}; {pulsing ? '' : 'opacity:0.385;'}"
                            ></span>
                        {/if}
                        {#if isCastlePreviewSquare(col, row) && placementColor}
                            <!-- The castle that would go here, under the cursor. Static rather
                                 than pulsing: it is answering "this one?", and one square at a
                                 time needs no animation to be noticed. Own colour for the opening
                                 laps and the NEUTRAL colour for the closing ones, since those
                                 castles belong to the third prince. -->
                            <div class="absolute inset-0 pointer-events-none opacity-60">
                                {@render pieceIcon(castleFill, castleLines, placementColor)}
                            </div>
                        {/if}
                        <!-- The circle is suppressed on the square the hover preview is drawn on,
                             just above: the castle already says this square will take one, and a
                             ring around it is the same claim twice. Tied to the preview rather
                             than to hover itself, so hovering during the KNIGHT stage - which has
                             no preview - does not blank the only mark on the square. -->
                        {#if showsLegalHighlight(col, row) && !isCastlePreviewSquare(col, row) && placementColor}
                            {@const hintColor = gameSession.colors.getUiColor(placementColor)}
                            <!-- A filled disc, about a third of the square. r 1.85 of the
                                 ten-unit viewBox is a 3.7-unit diameter - the same outer edge the
                                 stroked ring had, so "filled in" means exactly that rather than
                                 also changing size.
                                 
                                 Expressed as a fill with no stroke rather than a fill plus the old
                                 stroke: one property doing one job, and nothing to keep in step if
                                 the size changes again. The svg still fills the cell, so the
                                 geometry carries the size and there is no scaling to distort.
                                 
                                 In the PLACING colour, so the closing laps mark the neutral
                                 prince's spots in the neutral colour rather than claiming them
                                 for whoever is placing. -->
                            <svg
                                viewBox="0 0 10 10"
                                class="absolute inset-0 w-full h-full pointer-events-none"
                                aria-hidden="true"
                            >
                                <circle cx="5" cy="5" r="1.85" fill={hintColor} fill-opacity="0.8" />
                            </svg>

                        {/if}
                        {#if showsIllegalScrim(col, row)}
                            <!-- Drawn after the region tint but before the pieces, so a piece
                                 standing on a dimmed square is dimmed WITH it rather than painted
                                 over. -->
                            <span class="absolute inset-0 pointer-events-none bg-black/40"></span>
                        {/if}
                        {#if showsIllegalX(col, row)}
                            <!-- Small, centred, and the only thing on the square: showsIllegalX
                                 has already excluded every square that holds a piece, so there is
                                 nothing here to obscure. -->
                            <span
                                class="absolute inset-0 pointer-events-none flex items-center justify-center"
                            >
                                <!-- The X spans ~90% of the square: the svg fills the cell and
                                     the stroke runs corner to corner inset by half a unit of the
                                     ten-unit viewBox.
                                     
                                     stroke-width is in viewBox units, so it grows with the square
                                     - 0.6 of 10 across a 44px cell is about 2.6px. That matters
                                     because the width was tuned against a much smaller mark:
                                     keeping the old 1.9 here would have drawn a line over 8px
                                     thick, a red barrier rather than a red X. -->
                                <svg viewBox="0 0 10 10" class="w-full h-full opacity-70" aria-hidden="true">
                                    <path
                                        d="M0.5 0.5 L9.5 9.5 M9.5 0.5 L0.5 9.5"
                                        stroke="#b0201a"
                                        stroke-width="0.6"
                                        stroke-linecap="round"
                                        fill="none"
                                    />
                                </svg>
                            </span>
                        {/if}
                        {#if knightStageActive && isLegalKnightPlacement(col, row) && myColor}
                            <!-- A faded preview of the knight that would actually be placed here,
                                 fading in and out - rather than a border/ring highlight. -->
                            <div class="absolute inset-0 ghost-knight-pulse pointer-events-none">
                                {@render pieceIcon(knightFill, knightLines, myColor, -1)}
                            </div>
                        {/if}
                        {#if isLegalRenegadePlacementSquare(col, row) && myColor}
                            <!-- Same faded preview, for the replacement knight Renegade would
                                 place here. -->
                            <div class="absolute inset-0 ghost-knight-pulse pointer-events-none">
                                {@render pieceIcon(knightFill, knightLines, myColor, -1)}
                            </div>
                        {/if}
                        {#if square.castleColor}
                            {@render pieceIcon(castleFill, castleLines, square.castleColor)}
                        {:else if isSelected(col, row) && placementColor}
                            <!-- The castle isn't actually placed yet (still needs its adjacent
                                 knight square picked), but it reads as solid and settled here.
                                 Same own-then-neutral colour as the hover preview.
                                 
                                 Deliberately not animated. A hop on landing was tried and read as
                                 forced: the hover preview already shows the castle on the square
                                 before the click, so the click has nothing left to announce - it
                                 only has to stop looking like a preview. -->
                            {@render pieceIcon(castleFill, castleLines, placementColor)}
                        {:else if square.knightColor}
                            {#if isRenegadeRemovedSquare(col, row)}
                                <!-- The knight the player just clicked to remove - simply
                                     vanishes from view, same as it always has, rather than
                                     staying rendered with some marker on top of it. It isn't
                                     actually gone from game state until the whole Renegade
                                     play is confirmed, but this square shouldn't look occupied
                                     in the meantime. -->
                            {:else if isRenegadeArrivalSquare(col, row)}
                                <!-- Held back until the defecting knight actually lands on
                                     it - see renegadeFlight. -->
                            {:else if isLegalRenegadeRemovableSquare(col, row)}
                                <!-- The real knight already there, pulsing in place - rather than
                                     a ring around it - to show it's a legal removal target. -->
                                <div class="absolute inset-0 ghost-knight-pulse pointer-events-none">
                                    {@render pieceIcon(knightFill, knightLines, square.knightColor, -1)}
                                </div>
                            {:else}
                                {@render pieceIcon(knightFill, knightLines, square.knightColor, -1)}
                            {/if}
                        {/if}
                    </button>
                {/each}
            {/each}
        </div>

        <!-- Boundary walls: crenellated bars (see WallSegment) anchored at the
             wall's starting corner - west edges run down from there, north edges run
             right, so two segments sharing a grid corner always anchor at the same
             pixel point and their end-squares overlap. -->
        {#each board.walls as wall (wall.col + ',' + wall.row + ',' + wall.edge)}
            {#if !expansionHiddenWallKeys.has(`${wall.col},${wall.row},${wall.edge}`)}
                {@const junctions = wallJunctionVisibility(wall)}
                <div
                    class="absolute pointer-events-none"
                    style="left: {wall.col * CELL_SIZE}px; top: {wall.row * CELL_SIZE}px;"
                >
                    <WallSegment
                        orientation={wall.edge === 'west' ? 'vertical' : 'horizontal'}
                        hideStartJunction={junctions.hideStart}
                        hideEndJunction={junctions.hideEnd}
                    />
                </div>
            {/if}
        {/each}

        <!-- Preview walls around a not-yet-confirmed expansion pick - same look as
             real walls, just slightly transparent, since they aren't real yet. -->
        {#each expansionPreviewWalls as wall (wall.col + ',' + wall.row + ',' + wall.edge + '-preview')}
            {@const junctions = wallJunctionVisibility(wall)}
            <div
                class="absolute pointer-events-none"
                style="left: {wall.col * CELL_SIZE}px; top: {wall.row * CELL_SIZE}px; opacity: 0.85;"
            >
                <WallSegment
                    orientation={wall.edge === 'west' ? 'vertical' : 'horizontal'}
                    hideStartJunction={junctions.hideStart}
                    hideEndJunction={junctions.hideEnd}
                />
            </div>
        {/each}

        <!-- Alliance markers: a small heart on every boundary wall between two allied
             regions - the only on-board sign an alliance exists, and (when I'm a
             participant who can afford the 10 ducats) the control for ending it. -->
        {#each allianceMarkers as marker (marker.id)}
            {@const previewing = hoveredAllianceId === marker.id}

            <!-- No ghost-wall restoration here any more. The rulebook marks an alliance by
                 turning one shared wall 90 degrees, and cancelling puts it back in line -
                 but this board draws allied walls flush at all times and shows the alliance
                 with hearts instead, so animating a wall "back" into an orientation it
                 already has was undoing something the player had never seen. The hover
                 preview is now the hearts themselves. -->
            {#each marker.walls as wall (wall.col + ',' + wall.row + ',' + wall.edge + '-heart')}
                {@const { left, top } = heartPosition(wall)}
                {#if marker.cancellable}
                    <!-- A heart's own idle animation is a heartbeat, which is exactly the
                         "alive, touchable" cue this needs - it beats only while cancelling
                         is actually open to this player, and sits dead still otherwise.
                         The words live in aria-label rather than on screen. -->
                    <button
                        type="button"
                        aria-label={allianceCancelLabel(marker)}
                        title={allianceCancelLabel(marker)}
                        class="absolute flex items-center justify-center z-40 cursor-pointer rounded-full {previewing
                            ? ''
                            : 'alliance-heartbeat'}"
                        style="left: {left}px; top: {top}px; width: 24px; height: 24px; font-size: 19px;"
                        onmouseenter={() => (hoveredAllianceId = marker.id)}
                        onmouseleave={() => (hoveredAllianceId = undefined)}
                        onfocus={() => (hoveredAllianceId = marker.id)}
                        onblur={() => (hoveredAllianceId = undefined)}
                        onclick={(e) => {
                            e.stopPropagation()
                            hoveredAllianceId = undefined
                            gameSession.cancelAlliance(marker.id)
                        }}
                    >
                        <!-- Ducat-gold ring, so the beating heart reads as costing money
                             rather than as decoration. -->
                        <span
                            class="absolute inset-0 rounded-full pointer-events-none"
                            style="border: 1.5px solid rgba(217, 180, 74, {previewing
                                ? 1
                                : 0.85}); box-shadow: 0 0 6px rgba(217, 180, 74, 0.55);"
                        ></span>
                        <!-- The shiver is on the glyph, not the button, so the gold ring
                             stays put and the heart trembles inside it. -->
                        <span class="relative leading-none {previewing ? 'alliance-heart-shiver' : ''}"
                            >{previewing ? '💔' : '🩷'}</span
                        >
                    </button>
                {:else}
                    <div
                        class="absolute pointer-events-none flex items-center justify-center z-40"
                        style="left: {left}px; top: {top}px; width: 24px; height: 24px; font-size: 19px;"
                    >
                        🩷
                    </div>
                {/if}
            {/each}

            <!-- The price, shown once per alliance (on its first heart) while previewing -
                 the same minted-ducat medallion the player panels use, so the cost reads
                 in the game's own currency iconography instead of a sentence. -->
            {#if previewing}
                {@const wall = marker.walls[0]}
                <div
                    class="absolute pointer-events-none z-50 flex items-center gap-0.5 alliance-price-rise"
                    style="
                        left: {(wall.edge === 'west'
                        ? wall.col * CELL_SIZE
                        : wall.col * CELL_SIZE + CELL_SIZE / 2) + 12}px;
                        top: {(wall.edge === 'west'
                        ? wall.row * CELL_SIZE + CELL_SIZE / 2
                        : wall.row * CELL_SIZE) - 30}px;
                    "
                >
                    <span
                        class="text-[14px] font-bold leading-none"
                        style="color: #7a2e2e; text-shadow: 0 1px 0 rgba(255,255,255,0.8);"
                    >
                        −{ALLIANCE_CANCELLATION_COST}
                    </span>
                    <span class="relative w-[20px] h-[20px] shrink-0">
                        {@render ducatMedallion()}
                    </span>
                </div>
            {/if}
        {/each}

        <!-- Village names, in the overlay layer rather than inside each square button: a
             pill is wider than its square and has to be able to spill over its neighbours,
             which needs a shared stacking context to sit above them all. They're always
             rendered and merely transparent, so the opacity transition can play in BOTH
             directions - mounting them on hover would fade in but vanish on the way out. -->
        {#each villages as village (village.col + ',' + village.row)}
            <div
                class="absolute pointer-events-none z-40 village-name {hoveringVillage
                    ? 'village-name-shown'
                    : ''}"
                style="left: {village.col * CELL_SIZE + CELL_SIZE / 2}px; top: {village.row *
                    CELL_SIZE +
                    CELL_SIZE / 2}px;"
            >
                {village.name}
            </div>
        {/each}

        <!-- The defecting knight in flight. Two copies of the same piece stacked - the old
             owner's colour fading out, the new owner's fading in - so the change of side
             happens over the arc rather than as a swap at either end. -->
        {#if renegadeFlight}
            {#key renegadeFlight.id}
                <div
                    class="absolute pointer-events-none z-50 renegade-flight"
                    style="
                        left: {renegadeFlight.left}px;
                        top: {renegadeFlight.top}px;
                        width: {CELL_SIZE}px;
                        height: {CELL_SIZE}px;
                        --renegade-dx: {renegadeFlight.dx}px;
                        --renegade-dy: {renegadeFlight.dy}px;
                    "
                >
                    <div class="absolute inset-0 renegade-flight-old">
                        {@render pieceIcon(knightFill, knightLines, renegadeFlight.fromColor, -1)}
                    </div>
                    <div class="absolute inset-0 renegade-flight-new">
                        {@render pieceIcon(knightFill, knightLines, renegadeFlight.toColor, -1)}
                    </div>
                </div>
            {/key}
        {/if}

        <!-- The alliance breaking. Rendered outside the allianceMarkers loop on purpose:
             by the time this plays the alliance is gone from state, so there is no marker
             left to hang it on - the positions come from lastKnownAllianceWalls. One burst
             per wall that carried a heart, so a long shared border comes apart along its
             whole length rather than in one spot. -->
        {#each allianceBursts as burst (burst.id)}
            <div
                class="absolute pointer-events-none z-50"
                style="left: {burst.left}px; top: {burst.top}px; width: 24px; height: 24px;"
            >
                <span
                    class="absolute inset-0 flex items-center justify-center alliance-burst-core"
                    style="font-size: 19px;"
                >
                    💔
                </span>
                {#each BURST_SHARD_ANGLES as angle, i (i)}
                    <span
                        class="absolute inset-0 flex items-center justify-center alliance-burst-shard"
                        style="--shard-angle: {angle}deg; animation-delay: {i * 9}ms;"
                    >
                        🩷
                    </span>
                {/each}
            </div>
        {/each}

        <!-- A single pulsing preview of the wall that would actually be placed at
             whichever legal spot is nearest the mouse - rather than glowing every
             legal spot at once. Shows nothing while the mouse isn't over the board
             (hoverPoint unset) or over a state with no legal walls at all. -->
        {#if ghostWall}
            {@const junctions = wallJunctionVisibility(ghostWall)}
            <div
                class="absolute pointer-events-none z-20 ghost-wall-pulse"
                style="left: {ghostWall.col * CELL_SIZE}px; top: {ghostWall.row * CELL_SIZE}px;"
            >
                <WallSegment
                    orientation={ghostWall.edge === 'west' ? 'vertical' : 'horizontal'}
                    hideStartJunction={junctions.hideStart}
                    hideEndJunction={junctions.hideEnd}
                />
            </div>
        {/if}

        <!-- One bouncing arrow per legal expansion direction, centered on the wall it
             would cross, pointing toward the space it would claim - in the expanding
             player's own color. The rotation (to actually face the right direction)
             has to sit on this outer element, un-animated, since it varies per arrow -
             the bounce lives on the inner wrapper below, moving along the arrow's own
             "up" axis so it ends up bouncing the right way once rotated. -->
        {#each expansionArrows as arrow (arrow.key)}
            <div
                class="absolute pointer-events-none z-[25]"
                style="
                    left: {(arrow.wall.edge === 'west'
                    ? arrow.wall.col * CELL_SIZE
                    : arrow.wall.col * CELL_SIZE + CELL_SIZE / 2) - 12}px;
                    top: {(arrow.wall.edge === 'west'
                    ? arrow.wall.row * CELL_SIZE + CELL_SIZE / 2
                    : arrow.wall.row * CELL_SIZE) - 12}px;
                    width: 24px;
                    height: 24px;
                    color: {myColor ? gameSession.colors.getUiColor(myColor) : '#ffffff'};
                    transform: rotate({ARROW_ROTATION[arrow.direction]}deg);
                "
            >
                <div class="expansion-arrow-bounce">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                        <path d="M12 3 L21 18 L3 18 Z" stroke="black" stroke-width="1" stroke-linejoin="round" />
                    </svg>
                </div>
            </div>
        {/each}

        <!-- Clickable lines for legal wall placements - one click directly on the
             boundary between two squares places the wall there. Invisible - the
             ghost wall above is the only visual cue - but every legal edge stays
             independently clickable, not just whichever one is currently ghosted. -->
        {#each legalWallEdges as edge (edge.col1 + ',' + edge.row1 + '-' + edge.col2 + ',' + edge.row2)}
            {@const sameRow = edge.row1 === edge.row2}
            <button
                type="button"
                aria-label="Place wall"
                class="absolute z-30 cursor-pointer"
                style="
                    left: {sameRow ? edge.col2 * CELL_SIZE - 8 : edge.col1 * CELL_SIZE}px;
                    top: {sameRow ? edge.row1 * CELL_SIZE : edge.row2 * CELL_SIZE - 8}px;
                    width: {sameRow ? 16 : CELL_SIZE}px;
                    height: {sameRow ? CELL_SIZE : 16}px;
                "
                onclick={() => gameSession.placeWallBetween(edge.col1, edge.row1, edge.col2, edge.row2)}
            ></button>
        {/each}

        <!-- Floating score-change popups (see the $effect above) -->
        {#each popups as popup (popup.id)}
            <div
                class="score-popup absolute z-50 pointer-events-none rounded-full px-2 py-0.5 text-sm font-bold text-white shadow"
                style="left:{popup.col * CELL_SIZE + CELL_SIZE / 2}px; top:{popup.row *
                    CELL_SIZE}px; background-color:{popup.color};"
            >
                {popup.text}
            </div>
        {/each}
        </div>
        <div><RampartBorder side="right" /></div>

        <RampartCorner />
        <div><RampartBorder side="bottom" /></div>
        <RampartCorner />
    </div>
</div>

<style>
    @keyframes score-popup-float {
        0% {
            transform: translate(-50%, -50%) translateY(0);
            opacity: 1;
        }
        100% {
            transform: translate(-50%, -50%) translateY(-32px);
            opacity: 0;
        }
    }

    .score-popup {
        animation: score-popup-float 4s ease-out forwards;
    }

    @keyframes ghost-knight-pulse-frames {
        0%,
        100% {
            opacity: 0.15;
        }
        50% {
            opacity: 0.65;
        }
    }

    .ghost-knight-pulse {
        animation: ghost-knight-pulse-frames 1.8s ease-in-out infinite;
    }

    @keyframes ghost-wall-pulse-frames {
        0%,
        100% {
            opacity: 0.25;
        }
        50% {
            opacity: 0.85;
        }
    }

    .ghost-wall-pulse {
        animation: ghost-wall-pulse-frames 1.8s ease-in-out infinite;
    }

    @keyframes region-expand-pulse-frames {
        0%,
        100% {
            opacity: 0.25;
        }
        50% {
            opacity: 0.55;
        }
    }

    .region-expand-pulse {
        animation: region-expand-pulse-frames 1.8s ease-in-out infinite;
    }


    @keyframes expansion-arrow-bounce-frames {
        0%,
        100% {
            transform: translateY(0);
        }
        50% {
            transform: translateY(-4px);
        }
    }

    .expansion-arrow-bounce {
        animation: expansion-arrow-bounce-frames 1s ease-in-out infinite;
    }

    /* A real heartbeat: two quick beats, then a rest - the idle state of an alliance
       heart this player could actually afford to break. Runs only while cancelling is
       open to them, so a beating heart always means "you can end this".
       Beats every 5.7s rather than every 1.9s. The percentages keep the two beats at
       their original absolute speed (266ms apart) and put the whole 3x slowdown into the
       rest between them - stretching the beats themselves would read as a slow squish
       instead of a pulse. */
    @keyframes alliance-heartbeat-frames {
        0% {
            transform: scale(1);
        }
        4.7% {
            transform: scale(1.22);
        }
        9.3% {
            transform: scale(1);
        }
        14% {
            transform: scale(1.16);
        }
        18.7%,
        100% {
            transform: scale(1);
        }
    }

    /* The alliance coming apart: the heart swells, cracks and collapses while shards spray
       outward. Deliberately quick (620ms against the heartbeat's 5.7s cycle) - it marks a
       moment rather than holding the board. */
    @keyframes alliance-burst-core-frames {
        0% {
            transform: scale(1);
            opacity: 1;
        }
        30% {
            transform: scale(1.55) rotate(-6deg);
            opacity: 1;
        }
        100% {
            transform: scale(0.35) rotate(8deg);
            opacity: 0;
        }
    }

    .alliance-burst-core {
        animation: alliance-burst-core-frames 620ms ease-out forwards;
    }

    /* Each shard is rotated to its own angle first, then thrown "up" along that rotated
       axis - which sends it outward in that direction without needing per-shard x/y. */
    @keyframes alliance-burst-shard-frames {
        0% {
            transform: rotate(var(--shard-angle)) translateY(0) scale(0.85);
            opacity: 0.95;
        }
        100% {
            transform: rotate(var(--shard-angle)) translateY(-30px) scale(0.3);
            opacity: 0;
        }
    }

    .alliance-burst-shard {
        font-size: 11px;
        animation: alliance-burst-shard-frames 620ms cubic-bezier(0.2, 0.75, 0.3, 1) forwards;
    }

    .alliance-heartbeat {
        animation: alliance-heartbeat-frames 5.7s ease-in-out infinite;
    }

    /* The town's name laid across the village itself, dark on parchment so it stays
       legible over forest, hill and village art alike. Centred on the square in both axes
       (hence -50%, -50%) and free to overhang its neighbours, since a town name is nearly
       always wider than one cell - which is also why these live in the overlay layer
       rather than inside a square. */
    .village-name {
        transform: translate(-50%, -50%);
        white-space: nowrap;
        padding: 1px 6px 2px;
        border-radius: 9999px;
        font-size: 12px;
        line-height: 1.25;
        color: #f6e8c8;
        background-color: rgba(43, 26, 10, 0.92);
        border: 1px solid rgba(217, 180, 74, 0.75);
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.45);
        opacity: 0;
        /* Out is slower than in: names appear promptly when wanted, and linger a moment on
           the way out so sweeping across the board doesn't strobe. */
        transition: opacity 260ms ease-out;
    }

    .village-name-shown {
        opacity: 1;
        transition: opacity 160ms ease-in;
    }

    /* The renegade knight's arc. The horizontal and vertical travel come in as custom
       properties (the squares differ every time), while the -34px at the midpoint is the
       lift: it's what makes the path bow upward instead of sliding flat across the board.
       Scaling up at the apex and back down on landing does the rest of the 3D read - a
       piece nearer the eye is bigger - and the drop shadow stretching and softening at the
       same moment says the same thing a second way. */
    @keyframes renegade-flight-frames {
        0% {
            transform: translate(0, 0) scale(1);
            filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.4));
        }
        50% {
            transform: translate(
                    calc(var(--renegade-dx) / 2),
                    calc(var(--renegade-dy) / 2 - 34px)
                )
                scale(1.4);
            filter: drop-shadow(0 14px 9px rgba(0, 0, 0, 0.33));
        }
        100% {
            transform: translate(var(--renegade-dx), var(--renegade-dy)) scale(1);
            filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.4));
        }
    }

    .renegade-flight {
        animation: renegade-flight-frames 900ms cubic-bezier(0.36, 0, 0.35, 1) forwards;
    }

    /* The turn of coat, held to the middle of the arc: still clearly the old colour as it
       lifts, unmistakably the new one as it lands. */
    @keyframes renegade-colour-out {
        0%,
        22% {
            opacity: 1;
        }
        72%,
        100% {
            opacity: 0;
        }
    }

    @keyframes renegade-colour-in {
        0%,
        22% {
            opacity: 0;
        }
        72%,
        100% {
            opacity: 1;
        }
    }

    .renegade-flight-old {
        animation: renegade-colour-out 900ms linear forwards;
    }

    .renegade-flight-new {
        animation: renegade-colour-in 900ms linear forwards;
    }

    /* The broken heart trembling while you hover it - the alliance is about to give. Fast
       and small (a couple of pixels, a few degrees) so it reads as a shiver rather than a
       wobble, and it runs only during the hover preview, where the heartbeat has stopped. */
    @keyframes alliance-heart-shiver-frames {
        0%,
        100% {
            transform: translate(0, 0) rotate(0deg);
        }
        20% {
            transform: translate(-0.6px, 0.2px) rotate(-2.5deg);
        }
        40% {
            transform: translate(0.6px, -0.2px) rotate(2.5deg);
        }
        60% {
            transform: translate(-0.45px, -0.3px) rotate(-1.75deg);
        }
        80% {
            transform: translate(0.45px, 0.3px) rotate(1.75deg);
        }
    }

    .alliance-heart-shiver {
        display: inline-block; /* transforms don't apply to a purely inline box */
        animation: alliance-heart-shiver-frames 240ms linear infinite;
    }

    @keyframes alliance-price-rise-frames {
        0% {
            transform: translateY(6px);
            opacity: 0;
        }
        100% {
            transform: translateY(0);
            opacity: 1;
        }
    }

    .alliance-price-rise {
        animation: alliance-price-rise-frames 220ms ease-out forwards;
    }
</style>
