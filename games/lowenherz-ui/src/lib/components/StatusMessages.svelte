<script lang="ts">
    import { onMount } from 'svelte'
    import type { HydratedLowenherzGameState } from '@tabletop/lowenherz'
    // Everything above the board: what just happened, what you are being asked to do, and the
    // negotiation and duel controls.
    //
    // Rendered by GameTable OUTSIDE ScalingWrapper, which is the whole point of it being its own
    // component. The board scales with the window; instructions that scale with it end up either
    // too small to read or absurdly large, and this is instruction rather than scenery.
    //
    // Everything declared here was declared in RealBoard and is referenced by nothing else - it
    // moved rather than being copied. The values both halves need went onto the session in an
    // earlier pass, which is why this file reads them off gameSession instead of receiving props.
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import type { Color, GameAction } from '@tabletop/common'
    import {
        isAdvanceResolution,
        isCancelAlliance,
        isDrawActionCard,
        isNegotiationMove,
        isPlaceWall,
        isSubmitDuelBid,
        isTakePoliticsCard,
        MachineState,
        type Negotiation,
        NegotiationMoveKind,
        type SubmitDuelBid
    } from '@tabletop/lowenherz'
    import PlayerPill from './PlayerPill.svelte'
    import ActionDescription from './ActionDescription.svelte'
    import { playerName } from '$lib/model/actionCardHelpers.js'
    import type { KnightPlan } from '$lib/model/session.svelte.js'

    const gameSession = getGameSession()

    // Session reads the board declares too. One-liners, so each half asking for itself is
    // clearer than threading them through props.
    const board = $derived(gameSession.gameState.board)
    const placementColor = $derived(gameSession.placementColor)
    const regions = $derived(gameSession.gameState.regions)
    const knightSwordsLeft = $derived(gameSession.gameState.knightsRemaining ?? 0)
    const displayNegotiation = $derived(gameSession.displayNegotiation)
    const legalRenegadeOwnRegionIdSet = $derived(gameSession.legalRenegadeOwnRegionIds)
    const allianceMarkers = $derived(gameSession.allianceMarkers)
    const availableKnightPlans = $derived(gameSession.availableKnightPlans)
    const expandStageActive = $derived(gameSession.expandStageActive)
    const knightStageActive = $derived(gameSession.knightStageActive)
    const expansionDeadEnd = $derived(gameSession.expansionDeadEnd)
    const expansionBlockedReasons = $derived(
        expansionDeadEnd ? gameSession.expansionBlockedReasons : []
    )
    // Solo-testing stand-ins for a second session: signing a negotiation, and bidding in a duel,
    // on another player's behalf. Both exist because hotseat resolves myPlayer to a single seat, so
    // one person cannot otherwise finish either flow alone.
    //
    // Gated on showDebug rather than on a hardcoded flag. showDebug is isAdmin && debugViewEnabled,
    // so in the dev harness the Debug toggle in the top bar turns them on, and in a real game only
    // an admin who has deliberately switched debug view on ever sees them - never a beta tester,
    // who would otherwise be able to settle a duel from one seat and spend an opponent's ducats.
    //
    // Not import.meta.env.DEV: this package is built with svelte-package and consumed by the app,
    // and svelte-package warns about import.meta.env for exactly that reason.
    const SHOW_DUEL_TEST_CONTROLS = $derived(gameSession.showDebug)

    async function commitNegotiationOffer() {
        const negotiation = displayNegotiation
        if (!negotiation || !gameSession.negotiationProposerId) return

        // Signing means "I commit to what's on screen", so submit the draft first whenever
        // it isn't already the standing offer. Proposing clears existing signatures
        // engine-side, which is correct: it's a different deal.
        const offer = negotiation.offer
        const draftIsStandingOffer =
            offer !== undefined &&
            offer.fromPlayerId === gameSession.negotiationProposerId &&
            offer.amount === gameSession.negotiationAmount
        if (!draftIsStandingOffer) {
            const proposed = await gameSession.proposeNegotiationOffer(
                gameSession.negotiationProposerId,
                gameSession.negotiationAmount
            )
            // Refused (e.g. a payer who can't afford it) - don't follow up with a Sign that
            // has nothing valid to sign.
            if (!proposed) return
        }

        await gameSession.signNegotiationOffer()
    }

    function choosePlan(plan: KnightPlan) {
        gameSession.selectKnightPlan(plan)
    }

    // The band kind (border/knight/politics) at a given slot, translated to the noun
    // used in status messages - money-bag slots never reach negotiation or dueling
    const negotiationActionNoun = $derived.by(() => {
        const negotiation = gameSession.gameState.negotiation
        return negotiation ? gameSession.actionNounForSlot(negotiation.slot) : ''
    })

    const duelActionNoun = $derived.by(() => {
        const duel = gameSession.gameState.duel
        return duel ? gameSession.actionNounForSlot(duel.slot) : ''
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
    // Also bounded by the current action card's own draw (see lastMineReveal) so an
    // earlier card's negotiation in the same round can't leak into a later one.
    const lastNegotiationPayment = $derived.by(() => {
        const actions = gameSession.actions
        let roundBoundariesSeen = 0
        for (let i = actions.length - 1; i >= 0; i--) {
            const action = actions[i]
            if (isDrawActionCard(action)) return undefined
            if (isAdvanceResolution(action) && action.metadata?.roundAdvanced) {
                roundBoundariesSeen++
                if (gameSession.isPastCurrentRound(roundBoundariesSeen)) return undefined
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
    // current action card's own draw (see lastMineReveal) so an earlier card's duel in
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
                    if (gameSession.isPastCurrentRound(roundBoundariesSeen)) break
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
        // own freshness check (see lastMineReveal) to avoid lingering once a later
        // slot has resolved.
        if (!gameSession.isFreshestResolvedSlot(recentDuelContext.slot)) return undefined
        return {
            type: 'giveUp' as const,
            bids: lastRound,
            actionNoun: recentDuelContext.slot ? gameSession.actionNounForSlot(recentDuelContext.slot) : ''
        }
    })

    // Once both sides have signed, gameState.negotiation disappears immediately (the
    // machine moves straight on to whatever the settled action needs next) - which
    // read as an abrupt cut, control handed to the next player before anyone could
    // actually see both signatures land. This holds the fully-signed view on screen
    // a beat longer instead of snapping away the instant it clears. Only applies to
    // an actual completed deal, not a decline (which routes straight to a duel and
    // should switch over immediately).
    const NEGOTIATION_HOLD_MS = 1000

    // Once both sides have signed, gameState.negotiation disappears immediately - the machine moves
    // straight on to whatever the settled action needs next - which read as an abrupt cut, control
    // handed over before anyone could see both signatures land. So the fully-signed view is held a
    // beat longer.
    //
    // Driven by the closing NegotiationMove, which carries the executed offer, rather than by an
    // effect noticing the negotiation vanish. That effect needed lastLiveNegotiation - a copy of
    // the previous value - because by the time it ran there was nothing left to hold. The listener
    // is told, so it only needs the snapshot from before this action, refreshed each time.
    //
    // Only a completed deal is held. A decline routes straight to a duel and should switch over
    // immediately, and it carries no executed offer, so it never reaches the branch.
    onMount(() => {
        // `from` is the state before this action, so the negotiation about to disappear is right
        // there in the argument - no snapshot to keep, and no chance of it being a state out of
        // date. (gameSession.gameState is not usable here: the session notifies its listeners
        // before assigning the exposed state, so it still reads as the state before `from`.)
        const listener = async ({
            action,
            from
        }: {
            action?: GameAction
            from?: HydratedLowenherzGameState
        }) => {
            // Action presence, not isViewingHistory: plain history navigation and undo suppress
            // actions (see GameSession.onHistoryAction), so this holds only during live play and
            // `full-action` replay - and a replay that steps through a negotiation ought to show
            // the offer it settled on, which the old guard prevented.
            if (!action) return

            const settling = isNegotiationMove(action) && action.metadata?.executedOffer
            if (settling && from?.negotiation) {
                gameSession.freezeNegotiation(from.negotiation, NEGOTIATION_HOLD_MS)
            }
        }

        gameSession.addGameStateChangeListener(listener)
        return () => gameSession.removeGameStateChangeListener(listener)
    })

    const negotiationOtherPlayerId = $derived.by(() => {
        const negotiation = displayNegotiation
        if (!negotiation || !gameSession.negotiationProposerId) return undefined
        return negotiation.playerIds.find((id) => id !== gameSession.negotiationProposerId)
    })

    const negotiationProposerMoney = $derived(
        gameSession.negotiationProposerId ? gameSession.gameState.getPlayerState(gameSession.negotiationProposerId).money : 0
    )


    // A local, per-player draft bid amount - each duelist's own private stepper,
    // unlike negotiation's single shared offer (a duel bid is a one-shot commitment
    // per player, not a joint draft either side can revise).
    // The negotiation half of the same pair, on the same gate - see SHOW_DUEL_TEST_CONTROLS above.
    const SHOW_NEGOTIATION_TEST_CONTROLS = $derived(gameSession.showDebug)

    // Nothing resets the bids between duels any more. They are keyed to the duel they were
    // entered for (see GameSession.duelBidAmounts), as is an armed Treasure card, so a re-duel
    // reads as no bids and nothing armed rather than being cleared afterwards. That also retired a
    // high-water-mark variable kept solely so an effect could tell one duel from the next.

    // Whether the castle about to be placed belongs to the neutral prince rather than to the
    // player placing it. Asked of the colour rather than of the player count: the closing laps
    // place neutral castles at two players AND at three, so counting seats would get three-player
    // games wrong.
    const placingNeutral = $derived(
        placementColor !== undefined && placementColor === gameSession.gameState.neutralColor
    )

    // The action currently being looked at while rewound through the history controls -
    // the one whose result is what's drawn on the board. Already undefined during live play
    // and when rewound past the very first action, so it doubles as "are we in history".
    const historyAction = $derived(gameSession.history.currentAction)

    // One label per thing a single sword can buy. The composite labels are gone with the
    // composite plans - a two-sword action now reads this list twice.
    const KNIGHT_PLAN_LABELS: Record<KnightPlan, string> = {
        knight: 'place a knight',
        expand: 'expand a region'
    }

    // "two knights action" when the card gives two swords, so the player knows there is a second
    // question coming before they answer the first. Named from the slot's own band count, which
    // does not move as the action is spent.
    const knightActionName = $derived(
        gameSession.knightActionSwords === 2 ? 'two knights action' : 'knight action'
    )

    // Whether expanding was actually on the table when the current plan was picked. A plan
    // chosen while expansion WAS possible is a real decision and must stand; one chosen
    // while it was impossible was made without that option ever being shown.
</script>

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
            gameSession.setDuelBidAmount(playerId, Math.max(0, bidAmount - 1))
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
            gameSession.setDuelBidAmount(playerId, bidAmount + 1)
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

<!-- items-center so each message box is centred over the board rather than starting at its left
     edge; text-center on the boxes themselves handles the wrapping lines within them. -->
<div class="flex flex-col gap-2 items-center">
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
    {#if lastDuelOutcome?.type === 'giveUp'}
        <div class="text-black text-[20px] text-center">
            {@render bidList(lastDuelOutcome.bids)} — tied again, so no one performs the{lastDuelOutcome.actionNoun
                ? ` ${lastDuelOutcome.actionNoun}`
                : ''} action.
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
                {#if placingNeutral}
                    Place a neutral knight adjacent to the castle.
                {:else}
                    Place a knight adjacent to the castle.
                {/if}
            {:else if placingNeutral}
                Place a neutral castle on the board.
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
        {:else if gameSession.canPlaceKnight && (gameSession.knightPlan || gameSession.canContinueExpansion)}
            <!-- Either a step is under way, or an expansion is open between steps - the second is
                 why canContinueExpansion is here too: no step is chosen at that moment, and
                 without it this whole block fell through to the chooser while the board was
                 offering expansion squares.
                 
                 A plan's already declared, so this just narrates the current step. No
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
            {:else if gameSession.canContinueExpansion}
                <!-- The one moment with its own stop button. Knight squares are not offered while
                     an expansion is open, so the click that used to end it - placing the knight -
                     is gone, and something has to say "that's enough".
                     
                     What that button does depends on whether a sword is left: with one it ends the
                     expansion and moves on to the knight, with none there is nothing to move on to
                     and it ends the action. Either way the player is stopping, which is why both
                     read as "pass". -->
                Click to expand a second time, or
                <button
                    type="button"
                    class="leading-none px-2 pt-[3px] pb-[2px] rounded bg-black/10 text-black hover:bg-black/20"
                    onclick={() =>
                        knightSwordsLeft > 0
                            ? gameSession.declineSecondSpace()
                            : gameSession.passKnightPlacement()}
                >
                    pass
                </button>.
            {:else if expandStageActive}
                <!-- "a first time" rather than a 0/2 count, matching the second-time wording. The
                     count came off engine state so an Undo could not leave it claiming a space that
                     had been taken back; with no number there is nothing to go stale. -->
                Click to expand a first time, or
                <button
                    type="button"
                    class="leading-none px-2 pt-[3px] pb-[2px] rounded bg-black/10 text-black hover:bg-black/20"
                    onclick={() => gameSession.passKnightPlacement()}
                >
                    pass
                </button>.
            {:else}
                <!-- No count here any more. A step is one knight, so "2 to place" would be
                     describing a second sword the player has not chosen how to spend yet - they
                     are asked again once this one is down. -->
                Click a square to place your knight.
            {/if}
            <!-- Suppressed for the two click-to-expand branches, which end in their own "or pass"
                 - and only those two. The region-pick and dead-end branches also have
                 expandStageActive set, and they still want this. -->
            {#if !gameSession.canContinueExpansion &&
                !(expandStageActive && gameSession.selectedExpandRegionId && !expansionDeadEnd)}
                Or
                <button
                    type="button"
                    class="leading-none px-2 pt-[3px] pb-[2px] rounded bg-black/10 text-black hover:bg-black/20"
                    onclick={() => gameSession.passKnightPlacement()}
                >
                    pass
                </button>
                to stop here.
            {/if}
        {:else if gameSession.canPlaceKnight}
            <!-- How the action was won, said once. It is news when the action opens and noise on
                 the second question, where the player has already spent a sword on it - so it is
                 shown only while nothing has been spent yet. -->
            {#if knightSwordsLeft >= gameSession.knightActionSwords}
                {#if lastNegotiationPayment && lastNegotiationPayment.fromPlayerId === gameSession.gameState.knightPlacingPlayerId}
                {@render playerPill(lastNegotiationPayment.fromPlayerId)} paid {@render playerPill(
                    lastNegotiationPayment.toPlayerId
                )}
                    {lastNegotiationPayment.amount} ducat{lastNegotiationPayment.amount === 1
                        ? ''
                        : 's'} for the {knightActionName}.
                {:else if lastDuelOutcome?.type === 'win' && lastDuelOutcome.winnerId === gameSession.gameState.knightPlacingPlayerId}
                    {@render playerPill(lastDuelOutcome.winnerId)} outspent {@render playerPillList(
                        lastDuelOutcome.otherIds
                    )} to win a {knightActionName}.
                {:else}
                    {@render myPill()} won a {knightActionName}.
                {/if}
            {/if}
            <!-- One question per sword. A single available option is taken for the player, so this
                 only appears when there is a genuine choice to make. -->
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
                <!-- "First," only when a second question is actually coming, and "Then," once it
                     has arrived. A one-sword action keeps "Either", where "First" would promise a
                     second step that does not exist - and the second step of a two-sword action
                     would otherwise still be calling itself the first. -->
                {#if gameSession.knightActionSwords === 2}
                    {(gameSession.gameState.knightsRemaining ?? 0) === 2 ? 'First,' : 'Second,'}
                {:else}
                    Either
                {/if}
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
            <div class="flex flex-wrap items-center gap-2 pb-4 text-[20px]">
                <!-- Side by side rather than stacked. Two names in a column made this box two lines
                     tall on its own, which set the height of the whole row and so of the space the
                     panel takes above the board. The caption underneath is what the stacked layout
                     got for free: a column of two names reads as a choice, a row of two names reads
                     as a score, so with them side by side the box has to say what it is. -->
                <div class="relative flex flex-col items-center leading-tight">
                    <div class="flex flex-row items-center border border-black/30 rounded px-2 py-1">
                        {#each negotiation.playerIds as playerId, i (playerId)}
                            {#if i > 0}
                                <span class="mx-2 text-black/25" aria-hidden="true">|</span>
                            {/if}
                            <button
                                type="button"
                                disabled={!gameSession.isNegotiator ||
                                    gameSession.hasSignedNegotiationOffer}
                                class={gameSession.negotiationProposerId === playerId
                                    ? 'font-semibold text-black'
                                    : 'text-black/40 hover:text-black/60'}
                                onclick={() => gameSession.setNegotiationProposer(playerId)}
                            >
                                {playerName(gameSession, playerId)}
                            </button>
                        {/each}
                    </div>
                    <!-- Out of flow, so the column's height is the box's height and the box
                         centres on the row exactly as the sentence text does. In flow the column
                         was box-plus-caption tall, and items-center centred THAT - which lifted the
                         names about half a caption above the line they are meant to sit on. The
                         row's pb-4 is where this now sits. -->
                    <span
                        class="absolute top-full mt-0.5 text-[12px] text-black/50 whitespace-nowrap"
                    >
                        Choose a player
                    </span>
                </div>
                <span>offers</span>
                <button
                    type="button"
                    class="leading-none px-2 pt-[3px] pb-[2px] rounded bg-black/10 hover:bg-black/20 font-semibold disabled:opacity-40"
                    disabled={!gameSession.isNegotiator ||
                        gameSession.hasSignedNegotiationOffer ||
                        gameSession.negotiationAmount <= 1}
                    onclick={() => gameSession.setNegotiationAmount(Math.max(1, gameSession.negotiationAmount - 1))}
                >
                    −
                </button>
                <span class="w-6 text-center font-semibold">{gameSession.negotiationAmount}</span>
                <button
                    type="button"
                    class="leading-none px-2 pt-[3px] pb-[2px] rounded bg-black/10 hover:bg-black/20 font-semibold disabled:opacity-40"
                    disabled={!gameSession.isNegotiator ||
                        gameSession.hasSignedNegotiationOffer ||
                        gameSession.negotiationAmount >= negotiationProposerMoney}
                    onclick={() => gameSession.setNegotiationAmount(gameSession.negotiationAmount + 1)}
                >
                    +
                </button>
                <span>
                    ducat{gameSession.negotiationAmount === 1 ? '' : 's'} to {negotiationOtherPlayerId
                        ? playerName(gameSession, negotiationOtherPlayerId)
                        : ''}
                </span>

                <!-- One signature line, and it is the viewing player's own. There used to be a row
                     per negotiator, which cost a whole line of the space above the board to tell
                     you something the flow already implies: a standing offer exists only because
                     somebody proposed and signed it, so the other side's signature is not news -
                     and when it IS news, the sentence below says so by name. -->
                <button
                    type="button"
                    class="ml-2 px-2 py-[3px] rounded bg-green-700/20 hover:bg-green-700/30 text-[18px] font-semibold disabled:opacity-40 disabled:hover:bg-green-700/20"
                    disabled={!gameSession.isNegotiator || gameSession.hasSignedNegotiationOffer}
                    onclick={() => commitNegotiationOffer()}
                >
                    Signed
                </button>
                <span class="signature-text inline-block h-8 w-32 border-b border-black/40 px-1">
                    {#if gameSession.myPlayer && negotiation.signedPlayerIds.includes(gameSession.myPlayer.id)}
                        {playerName(gameSession, gameSession.myPlayer.id)}
                    {/if}
                </span>
            </div>

            <!-- Which half of the exchange you are in, in one line. This is also where the other
                 player's signature is reported, now that they have no row of their own: it is only
                 worth a mention when it changes what your click does, and then it wants naming
                 rather than a blank with a name on it. -->
            {#if gameSession.isNegotiator}
                {@const myId = gameSession.myPlayer?.id}
                {@const otherId = negotiation.playerIds.find((id) => id !== myId)}
                {@const otherHasSigned = otherId
                    ? negotiation.signedPlayerIds.includes(otherId)
                    : false}
                {@const showTestSign =
                    SHOW_NEGOTIATION_TEST_CONTROLS && !!negotiation.offer && !!otherId && !otherHasSigned}
                <!-- Only rendered when there is something to report. With nobody signed yet the
                     controls and the Signed button beside them already say what to do, and a line
                     restating it was a line of the space above the board earning nothing. The whole
                     row is conditional rather than just its text, so an empty div does not leave a
                     gap behind it. -->
                {#if otherHasSigned || showTestSign}
                    <div class="flex flex-wrap items-center gap-2 text-black/60 text-[16px]">
                        {#if otherHasSigned && otherId}
                            <span>
                                {@render playerPill(otherId)} has signed. Sign to accept these terms
                                as they stand, or change them to counter - which withdraws their
                                signature.
                            </span>
                        {/if}
                        {#if showTestSign && otherId}
                            <button
                                type="button"
                                title="Temporary solo-testing stand-in for a second session/tab"
                                class="px-1.5 py-0.5 rounded border border-dashed border-black/40 text-black/60 text-xs hover:bg-black/10"
                                onclick={() => gameSession.debugSignNegotiationOfferAs(otherId)}
                            >
                                sign for them (test)
                            </button>
                        {/if}
                    </div>
                {/if}
            {/if}
        </div>
    {/if}

    {#if gameSession.gameState.machineState === MachineState.Dueling && gameSession.gameState.duel}
        {@const duel = gameSession.gameState.duel}
        {@const myId = gameSession.myPlayer?.id}
        <div class="flex flex-col gap-1 text-black text-[18px]">
            <!-- Your own bid form, and nothing else - the duelists are named in the status bar
                 rather than getting a row each, and a sealed bid means an opponent's row would
                 have had nothing actionable on it anyway.
                 
                 It used to also confirm "Your bid is in." once you had bid, because the bar kept
                 listing every duelist as active for the whole duel (see dueling.ts's enter()) and
                 nothing else said your bid had landed. The bar now drops whoever has bid, so your
                 own name disappearing from it is the confirmation - and the row goes away entirely
                 rather than saying so twice. -->
            {#if myId && duel.playerIds.includes(myId) && !gameSession.hasPlayerBidInDuel(myId)}
                {@const money = gameSession.gameState.getPlayerState(myId).money}
                {@const bidAmount = Math.min(gameSession.duelBidAmounts[myId] ?? 0, money)}
                <div class="flex flex-wrap items-center gap-2">
                    <span class="font-semibold">Your bid:</span>
                        {@render duelBidStepper(myId, bidAmount, money)}
                        {#if gameSession.selectedTreasureCard}
                            <!-- Clicking the chip unarms the card. This is the ONLY way back:
                                 arming is local UI state, not a game action, so Undo never
                                 touches it, and APPLY in the hand only ever arms. It used to
                                 be a "don't play it" button on a sentence below.
                                 
                                 The X that used to sit on the end is gone; the hover title and the
                                 red hover state are what advertise that it is removable now. -->
                            <button
                                type="button"
                                class="px-1.5 py-[3px] rounded font-semibold bg-green-700/15 hover:bg-red-700/20"
                                title="Click to take this Treasure back out of your bid"
                                onclick={() => gameSession.selectTreasureCard(undefined)}
                            >
                                + Treasure ({gameSession.selectedTreasureCard.value})
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
                            {@const bidAmount = Math.min(gameSession.duelBidAmounts[playerId] ?? 0, money)}
                            {#if gameSession.testBiddingForPlayerId === playerId}
                                {@render playerPill(playerId)}
                                {@render duelBidStepper(playerId, bidAmount, money)}
                                <button
                                    type="button"
                                    class="px-1.5 py-0.5 rounded border border-dashed border-black/40 text-black/60 text-xs hover:bg-black/10"
                                    onclick={() => {
                                        gameSession.debugSubmitDuelBidAs(playerId, bidAmount)
                                        gameSession.setTestBiddingForPlayerId(undefined)
                                    }}
                                >
                                    submit (test)
                                </button>
                            {:else}
                                <button
                                    type="button"
                                    title="Temporary solo-testing stand-in for a second session/tab"
                                    class="px-1.5 py-0.5 rounded border border-dashed border-black/40 text-black/60 text-xs hover:bg-black/10"
                                    onclick={() => (gameSession.setTestBiddingForPlayerId(playerId))}
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
</div>
