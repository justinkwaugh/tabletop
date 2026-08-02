<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import type { Color } from '@tabletop/common'
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
        isSubmitDuelBid,
        ActionCardType,
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
    import knightFill from '$lib/images/pieces/knight-fill.png'
    import knightLines from '$lib/images/pieces/knight-lines.png'
    import castleFill from '$lib/images/pieces/castle-fill.png'
    import castleLines from '$lib/images/pieces/castle-lines.png'
    import { playerName } from '$lib/model/actionCardHelpers.js'

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

    // A Silver Mine sitting on the discard pile means it was just revealed and is
    // waiting for the active player to manually draw the next card (see
    // startOfTurn.ts). Its per-player hill scoring lives on the DrawActionCard action
    // that drew it - the most recent draw, since nothing's been drawn since. Returns
    // undefined once a later card is drawn (that draw becomes the most recent one).
    const lastMineReveal = $derived.by(() => {
        const discarded = gameSession.gameState.discardedActionCard
        if (discarded?.type !== ActionCardType.Mining) return undefined
        const actions = gameSession.actions
        for (let i = actions.length - 1; i >= 0; i--) {
            const action = actions[i]
            if (isDrawActionCard(action)) {
                return action.metadata?.cardType === ActionCardType.Mining
                    ? (action.metadata.hillScoring ?? [])
                    : undefined
            }
        }
        return undefined
    })

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

    function submitNegotiationProposal() {
        if (!negotiationProposerId) return
        gameSession.proposeNegotiationOffer(negotiationProposerId, negotiationAmount)
    }

    // The Signed button needs a real standing offer to exist before it can sign one
    // (see canSignNegotiationOffer) - if nobody's touched the stepper yet, this
    // submits the current draft for real first, then signs it, so the button still
    // works as a single click without a phantom offer having to exist beforehand.
    async function signNegotiation(hasRealOffer: boolean) {
        if (!hasRealOffer) {
            if (!negotiationProposerId) return
            await gameSession.proposeNegotiationOffer(negotiationProposerId, negotiationAmount)
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
    let duelBidAmounts = $state<Record<string, number>>({})
    let duelBidTreasureCardId = $state<string | undefined>(undefined)
    let lastSeenDuelSignature: string | undefined = undefined

    $effect(() => {
        const duel = gameSession.gameState.duel
        if (!duel) {
            lastSeenDuelSignature = undefined
            duelBidAmounts = {}
            duelBidTreasureCardId = undefined
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
            duelBidTreasureCardId = undefined
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

    // Every boundary wall that sits directly between two allied regions - a visual
    // marker (a heart) since the alliance itself has no other on-board indication.
    // "wall north of (c,r)" separates (c,r) from (c,r-1); "wall west of (c,r)"
    // separates (c,r) from (c-1,r) - see model/board.ts's wallBetween().
    const allianceWalls = $derived.by(() => {
        if (alliances.length === 0) return []
        const result: { col: number; row: number; edge: 'north' | 'west' }[] = []
        for (const wall of board.walls) {
            const keyHere = squareKey(wall.col, wall.row)
            const keyThere =
                wall.edge === 'north' ? squareKey(wall.col, wall.row - 1) : squareKey(wall.col - 1, wall.row)
            const isAllianceBoundary = alliances.some((alliance) => {
                const regionA = regions.find((r) => r.id === alliance.regionAId)
                const regionB = regions.find((r) => r.id === alliance.regionBId)
                if (!regionA || !regionB) return false
                return (
                    (regionA.squareKeys.includes(keyHere) && regionB.squareKeys.includes(keyThere)) ||
                    (regionB.squareKeys.includes(keyHere) && regionA.squareKeys.includes(keyThere))
                )
            })
            if (isAllianceBoundary) result.push(wall)
        }
        return result
    })

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

    // Whether the player is currently trying to expand a region rather than place a
    // knight - both are possible whenever canExpandRegion is true, so this is a plain
    // UI toggle, not game state.
    let expandMode = $state(false)

    // Reset expand-mode and any in-progress region selection every time a new
    // knight-placement turn begins (knightPlacingPlayerId goes through undefined
    // between turns, so this fires on every transition, including the same player
    // getting a later turn). Without this, a previous player's expandMode/selected
    // region carried over into the next player's turn - canExpandRegion would
    // correctly show the button, but legalNextExpansionSquares silently computed
    // legality against the wrong (stale) region id and came back empty, making it
    // look like there was nothing to click.
    let lastKnightPlacingPlayerId: string | undefined = $state(undefined)
    $effect(() => {
        const current = gameSession.gameState.knightPlacingPlayerId
        if (current !== lastKnightPlacingPlayerId) {
            lastKnightPlacingPlayerId = current
            expandMode = false
            gameSession.cancelExpansion()
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
    // auto-removed after a couple seconds. Watches gameSession.actions (append-only
    // while actively playing) for newly-arrived PlaceWall/ExpandRegion actions and
    // reads their metadata for exact anchor squares/amounts - see the anchorSquareKey
    // fields on PlaceWallMetadata/ExpandRegionMetadata.
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
            const color = region.ownerColor ? gameSession.colors.getUiColor(region.ownerColor) : '#888888'
            addPopup(region.anchorSquareKey, region.points, color)
        }
    }

    // processedActionCount starts uninitialized (-1) so the first effect run just
    // records the current history length instead of firing a popup for every past
    // action already in the game when this component mounts.
    let processedActionCount = -1
    $effect(() => {
        const actions = gameSession.actions
        if (processedActionCount === -1) {
            processedActionCount = actions.length
            return
        }
        const newActions = actions.slice(processedActionCount)
        processedActionCount = actions.length

        for (const action of newActions) {
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
            }
        }
    })

    const CELL_SIZE = 44
    const TILE_SIZE = 5
    const TILE_PX = TILE_SIZE * CELL_SIZE
    // +4 accounts for the squares grid's own border-2 (2px on each side) - explicit
    // pixel sizes (not "auto") so the rampart frame's middle track always matches the
    // board's actual rendered box exactly, with no gap on any edge.
    const boardWidthPx = $derived(board.squares[0].length * CELL_SIZE + 4)
    const boardHeightPx = $derived(board.squares.length * CELL_SIZE + 4)

    // Mouse position relative to the board (see the mousemove/mouseleave handlers
    // below) - undefined whenever the cursor isn't over the board at all, which is
    // exactly when the ghost wall preview should show nothing.
    let hoverPoint: { x: number; y: number } | undefined = $state(undefined)

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
        if (!expandMode || !gameSession.selectedExpandRegionId) return []
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
        if (!expandMode || gameSession.expansionSquares.length === 0) return []
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
        if (!expandMode || gameSession.expansionSquares.length === 0) return new Set<string>()
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
        const key = squareKey(col, row)
        return gameSession.myRegions.some((r) => r.squareKeys.includes(key))
    }

    function regionAt(col: number, row: number) {
        const key = squareKey(col, row)
        return regions.find((r) => r.squareKeys.includes(key))
    }

    function isOwnSelectableRenegadeRegion(col: number, row: number): boolean {
        if (!gameSession.isPlayingRenegadeCard || gameSession.renegadeOwnRegionId) return false
        if (!isOwnSelectableRegion(col, row)) return false
        const region = regionAt(col, row)
        return region !== undefined && gameSession.legalRenegadeOwnRegionIds.has(region.id)
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
        return isOwnSelectableRegion(col, row)
    }

    function isSelectableAllianceEnemyRegion(col: number, row: number): boolean {
        if (!gameSession.allianceOwnRegionId) return false
        const region = regionAt(col, row)
        return region !== undefined && legalAllianceEnemyRegionIds.has(region.id)
    }

    // A faint tint over any square already claimed by a region, so newly-created
    // regions are visible at a glance. Neutral zones (no owner) get a plain gray tint.
    function regionTint(col: number, row: number): string | undefined {
        const key = squareKey(col, row)

        // A space picked for the region-in-progress (not yet confirmed/dispatched)
        // reads as already part of the region, tinted the same as the rest of it -
        // rather than a separate "pending" ring - since the walls around it are drawn
        // the same way too (see expansionPreviewWalls).
        if (expandMode && gameSession.expansionSquares.some((s) => s.col === col && s.row === row)) {
            const region = regions.find((r) => r.id === gameSession.selectedExpandRegionId)
            if (region) return region.ownerColor ? gameSession.colors.getUiColor(region.ownerColor) : '#888888'
        }

        const region = regions.find((r) => r.squareKeys.includes(key))
        if (!region) return undefined
        return region.ownerColor ? gameSession.colors.getUiColor(region.ownerColor) : '#888888'
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
            await gameSession.placeCastleWithKnight(col, row)
            return
        }

        if (gameSession.canPlaceCastle) {
            gameSession.selectCastleSquare(col, row)
            return
        }

        if (expandMode && gameSession.canExpandRegion) {
            if (!gameSession.selectedExpandRegionId) {
                if (isOwnSelectableRegion(col, row)) {
                    const key = squareKey(col, row)
                    const region = gameSession.myRegions.find((r) => r.squareKeys.includes(key))
                    if (region) gameSession.selectRegionToExpand(region.id)
                }
                return
            }
            if (isLegalExpansionSquare(col, row)) {
                await gameSession.addExpansionSquare(col, row)
            }
            return
        }

        if (gameSession.canPlaceKnight) {
            await gameSession.placeKnight(col, row)
        }
    }

    let { onFrameOffset }: { onFrameOffset?: (px: number) => void } = $props()

    // Reports how far the castle-wall frame sits below this component's own top edge
    // (the status/instruction text above it grows and shrinks with game state, so
    // this isn't a fixed number) - lets Board.svelte match that same offset on the
    // deck-piles column so their tops stay level with the actual board frame instead
    // of the top of this whole component.
    let rootEl: HTMLElement | undefined = $state()
    let frameEl: HTMLElement | undefined = $state()
    $effect(() => {
        if (!rootEl || !frameEl || !onFrameOffset) return
        const report = () => {
            const rootRect = rootEl!.getBoundingClientRect()
            const frameRect = frameEl!.getBoundingClientRect()
            onFrameOffset!(frameRect.top - rootRect.top)
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

{#snippet bidList(bids: SubmitDuelBid[])}
    {#each bids as bid, i (bid.playerId)}
        {i > 0 ? ', ' : ''}{@render playerPill(bid.playerId)} bid {bid.amount} ducat{bid.amount === 1
            ? ''
            : 's'}{#if bid.metadata?.treasureCardUsed}
            {' '}+ Treasure ({bid.metadata.treasureCardUsed.value}){/if}
    {/each}
{/snippet}

<div class="flex flex-col gap-2" bind:this={rootEl}>
    <!-- Warms up the Tangerine signature font as soon as the board mounts, so it's
         already cached by the time anyone actually signs a negotiation (see
         .signature-text-warmup in app.css). -->
    <span class="signature-text-warmup" aria-hidden="true">warmup</span>
    {#if lastBankWin}
        <div class="text-black text-[20px]">
            {@render playerPill(lastBankWin.playerId)} gained {lastBankWin.amount} ducat{lastBankWin.amount === 1
                ? ''
                : 's'} from the bank.
        </div>
    {/if}
    {#if lastDuelOutcome?.type === 'giveUp'}
        <div class="text-black text-[20px]">
            {@render bidList(lastDuelOutcome.bids)} — tied again, so no one performs the{lastDuelOutcome.actionNoun
                ? ` ${lastDuelOutcome.actionNoun}`
                : ''} action.
        </div>
    {/if}
    {#if lastAllianceCancellation}
        {@const otherId = playerIdForColor(lastAllianceCancellation.otherColor)}
        {@const cancelerIsMe = gameSession.myPlayer?.id === lastAllianceCancellation.playerId}
        <div class="text-black text-[20px]">
            {@render playerPill(lastAllianceCancellation.playerId)} canceled {cancelerIsMe
                ? 'your'
                : 'their'} alliance with
            {#if otherId}
                {@render playerPill(otherId)}
            {:else}
                a neutral prince
            {/if}.
        </div>
    {/if}
    <div class="text-black text-[20px] leading-loose">
        {#if gameSession.isPlayingAllianceCard}
            {#if !gameSession.allianceOwnRegionId}
                Playing Alliance — click one of your regions.
            {:else if legalAllianceEnemyRegionIds.size === 0}
                That region has no neighboring enemy region left to ally with. Click Undo
                to try a different region.
            {:else}
                Click a bordering enemy region.
            {/if}
        {:else if gameSession.isPlayingRenegadeCard}
            {#if !gameSession.renegadeOwnRegionId}
                {#if gameSession.legalRenegadeOwnRegionIds.size === 0}
                    None of your regions have room for the replacement knight right now (no
                    open space, or they can't afford a wooded one). Click Undo.
                {:else}
                    Playing Renegade — click one of your regions.
                {/if}
            {:else if !gameSession.renegadeEnemyRegionId}
                {#if legalRenegadeEnemyRegionIds.size === 0}
                    That region has no neighboring enemy region to target. Click Undo to
                    try a different region.
                {:else}
                    Now click a bordering enemy region.
                {/if}
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
            <br class="block mb-0.5" />
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
        {:else if gameSession.canPlaceKnight && expandMode}
            {#if !gameSession.selectedExpandRegionId}
                Click one of your regions to expand it.
            {:else if gameSession.expansionSquares.length === 0 && gameSession.legalNextExpansionSquares.length === 0}
                This region has nowhere legal to expand into right now.
                {#if gameSession.myRegions.length > 1}
                    Click Undo to try a different region, or place a knight / pass instead.
                {:else}
                    Click Undo, then place a knight or pass instead.
                {/if}
            {:else}
                Click to expand ({gameSession.expansionSquares.length}/2 so far).
            {/if}
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
            <br class="block mb-[7px]" />
            {#if gameSession.canExpandRegion}
                Either
                <button
                    type="button"
                    class="leading-none px-2 pt-[3px] pb-[2px] rounded bg-black/10 text-black hover:bg-black/20"
                    onclick={() => {
                        expandMode = false
                        gameSession.cancelExpansion()
                    }}
                >
                    place a knight
                </button>
                or
                <button
                    type="button"
                    class="leading-none px-2 pt-[3px] pb-[2px] rounded bg-black/10 text-black hover:bg-black/20"
                    onclick={() => {
                        expandMode = true
                        if (gameSession.myRegions.length === 1) {
                            gameSession.selectRegionToExpand(gameSession.myRegions[0].id)
                        }
                    }}
                >
                    expand a region
                </button>
                or
                <button
                    type="button"
                    class="leading-none px-2 pt-[3px] pb-[2px] rounded bg-black/10 text-black hover:bg-black/20"
                    onclick={() => gameSession.passKnightPlacement()}
                >
                    pass
                </button>.
            {:else}
                Place a knight or
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
            The deck revealed a Silver Mine:
            {#if mineScorers.length > 0}
                {#each mineScorers as entry (entry.playerId)}
                    <br />
                    {@render playerPill(entry.playerId)} earned {entry.points} power point{entry.points === 1
                        ? ''
                        : 's'}
                {/each}
            {:else}
                <br />
                No one had hills enclosed in a region, so no power points were awarded.
            {/if}
            <br />
            {#if gameSession.canDrawActionCard}
                Click the action card draw pile to start the next round.
            {:else}
                Waiting for {@render playerPill(gameSession.gameState.firstPlayerId)} to draw the
                next action card...
            {/if}
        {:else if lastRoundEndedInDuelGiveUp}
            The duel was tied a second time, so no one performs the action.
            <br />
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
            Click a region of the card to pick an action.
        {:else if gameSession.gameState.machineState === MachineState.ChoosingActions}
            Waiting for the next player to choose...
        {:else if gameSession.gameState.machineState === MachineState.Negotiating && gameSession.gameState.negotiation}
            Negotiation for {negotiationActionNoun} or either player may
            <button
                type="button"
                class="leading-none px-2 pt-[3px] pb-[2px] rounded bg-red-700/10 hover:bg-red-700/20 font-semibold disabled:opacity-40"
                disabled={!gameSession.isNegotiator}
                onclick={() => gameSession.declineNegotiation()}
            >
                force a duel
            </button>.
        {:else if gameSession.gameState.machineState === MachineState.Dueling && gameSession.gameState.duel}
            Dueling for {duelActionNoun}{gameSession.gameState.duel.tieCount >= 1 ? ' again' : ''}.
            {#if previousTiedRoundBids}
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
            <br class="block mb-0.5" />
            Click one of the politics piles to look through it.
        {:else if !gameSession.setupComplete}
            Waiting for the other player(s) to place a castle...
        {/if}
    </div>

    {#each gameSession.myCancellableAlliances as alliance (alliance.id)}
        {@const otherPlayerId = playerIdForColor(alliance.otherColor)}
        <div class="text-black text-[16px]">
            You may also
            <button
                type="button"
                class="leading-none px-2 pt-[3px] pb-[2px] rounded bg-black/10 text-black hover:bg-black/20 font-semibold"
                onclick={() => gameSession.cancelAlliance(alliance.id)}
            >
                cancel your alliance
            </button>
            with {#if otherPlayerId}{@render playerPill(otherPlayerId)}{:else}a neutral prince{/if} for {ALLIANCE_CANCELLATION_COST}
            ducats.
        </div>
    {/each}

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
                            onclick={() => {
                                negotiationProposerId = playerId
                                submitNegotiationProposal()
                            }}
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
                    onclick={() => {
                        negotiationAmount = Math.max(1, negotiationAmount - 1)
                        submitNegotiationProposal()
                    }}
                >
                    −
                </button>
                <span class="w-6 text-center font-semibold">{negotiationAmount}</span>
                <button
                    type="button"
                    class="leading-none px-2 pt-[3px] pb-[2px] rounded bg-black/10 hover:bg-black/20 font-semibold disabled:opacity-40"
                    disabled={!gameSession.isNegotiator || negotiationAmount >= negotiationProposerMoney}
                    onclick={() => {
                        negotiationAmount = negotiationAmount + 1
                        submitNegotiationProposal()
                    }}
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
                            onclick={() => signNegotiation(!!negotiation.offer)}
                        >
                            Signed
                        </button>
                        <span class="signature-text inline-block h-8 w-32 border-b border-black/40 px-1">
                            {#if negotiation.signedPlayerIds.includes(playerId)}
                                {playerName(gameSession, playerId)}
                            {/if}
                        </span>
                        {#if negotiation.offer && gameSession.myPlayer?.id !== playerId && !negotiation.signedPlayerIds.includes(playerId)}
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
        <div class="flex flex-col gap-1 text-black text-[18px]">
            {#each duel.playerIds as playerId (playerId)}
                {@const myMoney = gameSession.gameState.getPlayerState(playerId).money}
                {@const bidAmount = Math.min(duelBidAmounts[playerId] ?? 0, myMoney)}
                <div class="flex flex-wrap items-center gap-2">
                    <div class="w-28 flex justify-end">
                        {@render playerPill(playerId)}
                    </div>
                    {#if gameSession.hasPlayerBidInDuel(playerId)}
                        <span class="text-black/60">bid submitted</span>
                    {:else}
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
                            disabled={bidAmount >= myMoney}
                            onclick={() => {
                                duelBidAmounts[playerId] = bidAmount + 1
                            }}
                        >
                            +
                        </button>
                        <span>ducat{bidAmount === 1 ? '' : 's'}</span>
                        {#if gameSession.myPlayer?.id === playerId}
                            {#if gameSession.myTreasureCards.length > 0}
                                <span>+</span>
                                <select
                                    bind:value={duelBidTreasureCardId}
                                    class="rounded border border-black/30 px-1 py-0.5"
                                >
                                    <option value={undefined}>no Treasure card</option>
                                    {#each gameSession.myTreasureCards as treasureCard (treasureCard.id)}
                                        <option value={treasureCard.id}>Treasure ({treasureCard.value})</option>
                                    {/each}
                                </select>
                            {/if}
                            <button
                                type="button"
                                class="px-2 py-[3px] rounded bg-green-700/20 hover:bg-green-700/30 font-semibold"
                                onclick={() => {
                                    gameSession.submitDuelBid(bidAmount, duelBidTreasureCardId)
                                    duelBidTreasureCardId = undefined
                                }}
                            >
                                Submit bid
                            </button>
                        {:else}
                            <button
                                type="button"
                                title="Temporary solo-testing stand-in for a second session/tab"
                                class="px-1.5 py-0.5 rounded border border-dashed border-black/40 text-black/60 text-xs hover:bg-black/10"
                                onclick={() => gameSession.debugSubmitDuelBidAs(playerId, bidAmount)}
                            >
                                submit bid (test)
                            </button>
                        {/if}
                    {/if}
                </div>
            {/each}
        </div>
    {/if}

    <!-- The top-level "place knight / expand region / pass" choice is embedded
         directly in the status message above now - this toolbar only needs to cover
         the expand-region sub-flow (once that mode's actually engaged), since
         Confirm/a way back to knight-placing/Pass all still need to be reachable
         without backing all the way out to the top-level message first. Backing out
         of an in-progress region selection (like backing out of playing a
         Renegade/Alliance card above) is handled by the Undo button instead of a
         separate Cancel here - see ActionToolbar.svelte. -->
    {#if gameSession.canExpandRegion && expandMode}
        <div class="flex gap-2 items-center">
            {#if gameSession.selectedExpandRegionId}
                {#if gameSession.expansionSquares.length > 0}
                    <button
                        type="button"
                        class="px-2 py-[3px] rounded bg-green-700 text-white text-sm hover:bg-green-800"
                        onclick={() => gameSession.passKnightPlacement()}
                    >
                        Confirm expansion
                    </button>
                {/if}
            {/if}
            <button
                type="button"
                class="px-2 py-[3px] rounded bg-black/10 text-black text-sm hover:bg-black/20"
                onclick={() => {
                    expandMode = false
                    gameSession.cancelExpansion()
                }}
            >
                Place a knight instead
            </button>
            <button
                type="button"
                class="px-2 py-[3px] rounded bg-black/10 text-black text-sm hover:bg-black/20"
                onclick={() => gameSession.passKnightPlacement()}
            >
                Pass
            </button>
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
    <div
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
                const rect = e.currentTarget.getBoundingClientRect()
                hoverPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top }
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
                        class="relative flex items-center justify-center border border-black/20 {isSelected(col, row) ? 'ring-4 ring-yellow-300 z-10' : ''} {isLegalKnightSquare(col, row) ? 'ring-2 ring-yellow-100' : ''}"
                        style="width:{CELL_SIZE}px; height:{CELL_SIZE}px; {tileLayout.length > 0 ? '' : `background-color:${terrainBg[square.type]};`}"
                    >
                        {#if tint}
                            {@const pulsing =
                                (expandMode && isOwnSelectableRegion(col, row)) ||
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
                        {#if !expandMode && isLegalKnightPlacement(col, row) && myColor}
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
                        {#if gameSession.canPlaceCastle && !gameSession.selectedCastleSquare && isLegalCastleSquare(col, row) && myColor}
                            <!-- Setup phase, before a castle square is picked: a slower,
                                 dimmer pulsing preview of the castle that would go here, at
                                 every currently-legal square. -->
                            <div class="absolute inset-0 ghost-castle-pulse pointer-events-none">
                                {@render pieceIcon(castleFill, castleLines, myColor)}
                            </div>
                        {/if}
                        {#if isLegalKnightSquare(col, row) && myColor}
                            <!-- Setup phase, once a castle square is picked: same pulsing
                                 preview treatment as regular-play knight placement, for the
                                 knight that would go adjacent to it. -->
                            <div class="absolute inset-0 ghost-knight-pulse pointer-events-none">
                                {@render pieceIcon(knightFill, knightLines, myColor, -1)}
                            </div>
                        {/if}
                        {#if square.castleColor}
                            {@render pieceIcon(castleFill, castleLines, square.castleColor)}
                        {:else if isSelected(col, row) && myColor}
                            <!-- The castle isn't actually placed yet (still needs its
                                 adjacent knight square picked), but it reads as solid/settled
                                 here - only the knight candidates above should be pulsing at
                                 this point. -->
                            {@render pieceIcon(castleFill, castleLines, myColor)}
                        {:else if square.knightColor}
                            {#if isRenegadeRemovedSquare(col, row)}
                                <!-- The knight the player just clicked to remove - simply
                                     vanishes from view, same as it always has, rather than
                                     staying rendered with some marker on top of it. It isn't
                                     actually gone from game state until the whole Renegade
                                     play is confirmed, but this square shouldn't look occupied
                                     in the meantime. -->
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

        <!-- Alliance markers: a small heart on every boundary wall between two -->
        <!-- allied regions - the only on-board sign an alliance exists. -->
        {#each allianceWalls as wall (wall.col + ',' + wall.row + ',' + wall.edge + '-heart')}
            <div
                class="absolute pointer-events-none flex items-center justify-center z-40"
                style="
                    left: {(wall.edge === 'west' ? wall.col * CELL_SIZE : wall.col * CELL_SIZE + CELL_SIZE / 2) -
                        10.5}px;
                    top: {(wall.edge === 'west' ? wall.row * CELL_SIZE + CELL_SIZE / 2 : wall.row * CELL_SIZE) -
                        10.5}px;
                    width: 21px;
                    height: 21px;
                    font-size: 19px;
                "
            >
                🩷
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

    /* Same shape as ghost-knight-pulse but half speed and a lower peak opacity - just
       for the opening castle-placement preview (see isLegalCastleSquare above). */
    @keyframes ghost-castle-pulse-frames {
        0%,
        100% {
            opacity: 0.15;
        }
        50% {
            opacity: 0.45;
        }
    }

    .ghost-castle-pulse {
        animation: ghost-castle-pulse-frames 3.6s ease-in-out infinite;
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
</style>
