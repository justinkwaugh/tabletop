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
    import { ActionSource, type Color, type GameAction } from '@tabletop/common'
    import {
        isAdvanceResolution,
        isCancelAlliance,
        isDrawActionCard,
        isNegotiationMove,
        isNeutralOwner,
        isPlaceWall,
        isSubmitDuelBid,
        isTakePoliticsCard,
        MachineState,
        type Negotiation,
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
    const placementOwner = $derived(gameSession.placementOwner)
    const regions = $derived(gameSession.gameState.regions)
    const knightSwordsLeft = $derived(gameSession.gameState.knightsRemaining ?? 0)
    const displayNegotiation = $derived(gameSession.displayNegotiation)
    const allianceMarkers = $derived(gameSession.allianceMarkers)
    const availableKnightPlans = $derived(gameSession.availableKnightPlans)
    const expandStageActive = $derived(gameSession.expandStageActive)
    // There is no separate signing action - clicking the button just proposes whatever is
    // on screen. If that happens to match the standing offer exactly, the engine treats it
    // as acceptance and executes the deal immediately (see NegotiationMove.apply); otherwise
    // it becomes the new standing offer and the turn passes to the other side. The button's
    // own label (see the template) reflects which of those this click would do.
    async function commitNegotiationOffer() {
        if (!gameSession.negotiationProposerId) return
        await gameSession.proposeNegotiationOffer(
            gameSession.negotiationProposerId,
            gameSession.negotiationAmount
        )
    }

    function choosePlan(plan: KnightPlan) {
        gameSession.selectKnightPlan(plan)
    }

    // The band kind (border/knight/politics) at a given slot, translated to the noun
    // used in status messages - money-bag slots never reach negotiation or dueling
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
            // executedOffer is only ever set on the Propose that completes a deal (see
            // NegotiationMove.apply) - Decline and every other Propose leave it unset.
            if (isNegotiationMove(action) && action.metadata?.executedOffer) {
                return action.metadata.executedOffer
            }
        }
        return undefined
    })


    // A bid's actual strength, including any Treasure cards added on top - metadata
    // keeps a snapshot of the cards used (see SubmitDuelBidMetadata's comment) since
    // the real cards get removed from the winner's hand once they're spent, so they
    // can't be looked up fresh from current player state after the fact.
    function effectiveBidAmount(bid: SubmitDuelBid): number {
        const treasureValue = (bid.metadata?.treasureCardsUsed ?? []).reduce(
            (sum, card) => sum + (card.value ?? 0),
            0
        )
        return bid.amount + treasureValue
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

    // Once a deal is struck, gameState.negotiation disappears immediately - the machine moves
    // straight on to whatever the settled action needs next - which read as an abrupt cut, control
    // handed over before anyone could see the agreed terms land. So the completed view is held a
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
            //
            // No action also means no "next user action" to release the freeze on - undoing all
            // the way back out of a completed negotiation, or scrubbing history past it, would
            // otherwise leave its Sign/decline controls on screen with nothing engine-side behind
            // them. Release unconditionally rather than trying to detect staleness: the hold is a
            // live-play-only affordance and nothing here is meant to survive a jump backward.
            if (!action) {
                gameSession.releaseFrozenNegotiation()
                return
            }

            const settling = isNegotiationMove(action) && action.metadata?.executedOffer
            if (settling && from?.negotiation) {
                // `from` is the state right before this Propose executed the deal, so its offer
                // is exactly the terms that were agreed - freeze a copy so the panel can keep
                // showing them for a beat instead of snapping away the instant negotiation clears.
                gameSession.freezeNegotiation(from.negotiation)
                return
            }

            // Anything else the players do means the deal has been read and acted on.
            if (action.source === ActionSource.User) {
                gameSession.releaseFrozenNegotiation()
            }
        }

        gameSession.addGameStateChangeListener(listener)
        return () => gameSession.removeGameStateChangeListener(listener)
    })

    // Once the deal is settled, its winner has somewhere else to be: the wall/knight/politics
    // prompt above (isPlayingAllianceCard / canPlaceWall / canPlaceKnight / canTakePoliticsCard)
    // already tells them what to do with what they just won, so re-reading the offer they signed
    // moments ago is only in their way. Everyone else has nothing to act on right now, so the
    // frozen offer and both signatures are exactly what they should be looking at.
    //
    // Scoped to the frozen hold, not live negotiation: gameState.negotiation is only undefined
    // once the deal has resolved, and canPlaceWall/etc. are only ever true once a slot's winner
    // has been routed to their placement phase - the two can never both be true while a
    // negotiation is still live, so this never hides the panel from an active negotiator.
    const negotiationHoldHidesForMe = $derived(
        !gameSession.gameState.negotiation &&
            (gameSession.canPlaceWall || gameSession.canPlaceKnight || gameSession.canTakePoliticsCard)
    )

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

    // Nothing resets the bids between duels any more. They are keyed to the duel they were
    // entered for (see GameSession.duelBidAmounts), as are any armed Treasure cards, so a
    // re-duel reads as no bids and nothing armed rather than being cleared afterwards. That
    // also retired a high-water-mark variable kept solely so an effect could tell one duel
    // from the next.

    // Whether the castle about to be placed belongs to the neutral prince rather than to the
    // player placing it. Asked of the owner rather than of the player count: the closing laps
    // place neutral castles at two players AND at three, so counting seats would get three-player
    // games wrong.
    const placingNeutral = $derived(placementOwner !== undefined && isNeutralOwner(placementOwner))

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
        {@const treasureValue = (bid.metadata?.treasureCardsUsed ?? []).reduce(
            (sum, card) => sum + (card.value ?? 0),
            0
        )}
        {i > 0 ? ', ' : ''}{@render playerPill(bid.playerId)} bid {bid.amount} ducat{bid.amount === 1
            ? ''
            : 's'}{#if treasureValue > 0}
            {' '}+ Treasure ({treasureValue}){/if}
    {/each}
{/snippet}

<!-- items-center so each message box is centred over the board rather than
     starting at its left edge; text-center on the boxes themselves handles the
     wrapping lines within them. -->

<!-- items-center so each message box is centred over the board rather than starting at its left
     edge; text-center on the boxes themselves handles the wrapping lines within them. -->
<div class="flex flex-col gap-2 items-center">
    <!-- Stepping back through history leaves every message below stale: they narrate the
         live game ("waiting for X", "click a region..."), which says nothing about the
         moment you've rewound to. So while in history, lead with what the action you're
         looking at actually did - the same sentence the history feed uses, since
         gameSession.actions already reflects the visible (rewound) context rather than the
         live one. Same idea as Sol's LastActionDescription, just scoped to history. -->
    {#if historyAction}
        <div class="text-black text-[18px] text-center border-b-2 border-black/15 pb-1">
            {#if historyAction.playerId}
                {@render playerPill(historyAction.playerId)}
            {/if}
            <ActionDescription action={historyAction} justify="start" history={false} />
        </div>
    {/if}
    {#if lastDuelOutcome?.type === 'giveUp'}
        <div class="text-black text-[18px] text-center">
            {@render bidList(lastDuelOutcome.bids)} — tied again, so no one performs the{lastDuelOutcome.actionNoun
                ? ` ${lastDuelOutcome.actionNoun}`
                : ''} action.
        </div>
    {/if}
    <div class="text-black text-[18px] text-center leading-loose">
        {#if gameSession.isPlayingAllianceCard}
            <!-- No "that region has nothing to ally with" case to report: a region with no
                 eligible neighbor isn't offered in the first place (see
                 legalAllianceOwnRegionIds), so reaching the second step guarantees there's
                 something to click. -->
            {#if !gameSession.allianceOwnRegionId}
                Playing Alliance — choose one of your regions.
            {:else}
                Choose a bordering enemy region.
            {/if}
        {:else if gameSession.isPlayingRenegadeCard}
            <!-- No "that region has nothing to play Renegade with" or "nothing can safely be
                 removed" case to report, same reasoning as Alliance above: a region with no
                 candidate square, or an enemy region with nothing safe to take, isn't offered as
                 a choice in the first place (see legalRenegadeOwnRegionIds/
                 legalRenegadeEnemyRegions, which canPlayRenegadeCard already checked before this
                 flow could even start), so reaching any of these steps guarantees there's
                 something to click. -->
            {#if !gameSession.renegadeOwnRegionId}
                Playing Renegade — choose one of your regions.
            {:else if !gameSession.renegadeEnemyRegionId}
                Choose a bordering enemy region.
            {:else if !gameSession.renegadeRemovedSquare}
                Choose an enemy knight to remove.
            {:else}
                Now choose a square in your region to place your knight in exchange.
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
        {:else if gameSession.gameState.machineState === MachineState.PlacingWalls &&
            gameSession.gameState.wallPlacingPlayerId}
            Waiting for {@render playerPill(gameSession.gameState.wallPlacingPlayerId)} to place
            {gameSession.gameState.wallsRemaining} wall{gameSession.gameState.wallsRemaining === 1
                ? ''
                : 's'}.
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
            <!-- No "this region has nowhere legal to expand into" case to report: a region
                 with no legal target isn't offered as a choice in the first place (see
                 GameSession.expandableRegions' own comment on this), so picking one
                 guarantees there's somewhere to click. -->
            {#if expandStageActive && !gameSession.selectedExpandRegionId}
                Choose one of your regions to expand it.
            {:else if gameSession.canContinueExpansion}
                <!-- The one moment with its own stop button. Knight squares are not offered while
                     an expansion is open, so the click that used to end it - placing the knight -
                     is gone, and something has to say "that's enough".
                     
                     What that button does depends on whether a sword is left: with one it ends the
                     expansion and moves on to the knight, with none there is nothing to move on to
                     and it ends the action. Either way the player is stopping, which is why both
                     read as "pass". -->
                Choose to expand a second time, or
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
                Choose to expand a first time, or
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
                Choose a square to place your knight.
            {/if}
            <!-- Suppressed for the two click-to-expand branches, which end in their own "or pass"
                 - and only those two. The region-pick branch also has expandStageActive set,
                 and it still wants this. -->
            {#if !gameSession.canContinueExpansion &&
                !(expandStageActive && gameSession.selectedExpandRegionId)}
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
                <!-- Forced rather than left to wrap naturally: how the action was won is one
                     sentence and what to do with it is another, so they read as two lines on
                     screen even when both would fit on one. -->
                <br />
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
        {:else if gameSession.gameState.machineState === MachineState.PlacingKnights &&
            gameSession.gameState.knightPlacingPlayerId}
            Waiting for {@render playerPill(gameSession.gameState.knightPlacingPlayerId)} to perform
            a {knightActionName}.
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
                Choose the action card draw pile to start the next round.
            {:else}
                Waiting for {@render playerPill(gameSession.gameState.firstPlayerId)} to draw the
                next action card.
            {/if}
        {:else if lastRoundEndedInDuelGiveUp}
            The duel was tied a second time, so no one performs the action.
            {#if gameSession.canDrawActionCard}
                Choose the action card draw pile to start the next round.
            {:else}
                Waiting for {@render playerPill(gameSession.gameState.firstPlayerId)} to draw the
                next action card.
            {/if}
        {:else if gameSession.canDrawActionCard}
            Choose the action card draw pile to start the next round.
        {:else if gameSession.gameState.machineState === MachineState.StartOfTurn}
            Waiting for {@render playerPill(gameSession.gameState.firstPlayerId)} to draw the
            next action card.
        {:else if gameSession.canChooseAction}
            <!-- Below 4 players the first player lays 2 decision cards (see
                 buildDecisionPlan). No need to announce the count: the ordinal on the
                 follow-up prompt ("a second region") is what tells them their turn isn't
                 over, and it says it exactly when it matters. -->
            {@const decisions = gameSession.myDecisionsThisRound}
            {#if decisions.laid > 0}
                Choose a {decisions.laid === 1 ? 'second' : 'third'} region of the card for
                your next action.
            {:else}
                Choose a region of the card to pick an action.
            {/if}
        {:else if gameSession.gameState.machineState === MachineState.ChoosingActions &&
            gameSession.gameState.activePlayerIds[0]}
            Waiting for {@render playerPill(gameSession.gameState.activePlayerIds[0])} to choose.
        {:else if gameSession.gameState.machineState === MachineState.ChoosingActions}
            Waiting for the next player to choose.
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
            Choose one of the politics decks.
        {:else if gameSession.canTakePoliticsCard && gameSession.selectedPoliticsPile}
            <!-- PoliticsPileReveal's own row deals its cards below this - kept here rather than
                 as a heading local to that component so it never has to agree on layout height
                 with PoliticsDeckChooser's row above it. -->
            Choose a card to take it.
        {:else if gameSession.gameState.machineState === MachineState.TakingPoliticsCard &&
            gameSession.gameState.politicsTakingPlayerId}
            Waiting for {@render playerPill(gameSession.gameState.politicsTakingPlayerId)} to take a
            politics card.
        {:else if !gameSession.setupComplete}
            Waiting for the other player(s) to place a castle.
        {/if}
    </div>

    <!-- Cancelling an alliance used to be offered as a sentence-with-a-button here. It's
         the beating heart on the shared boundary wall now (see allianceMarkers) - the price
         and the consequence both show on hover, and the affordance stays put on the board
         instead of appearing in a status area whose other messages are turn-scoped. -->

    {#if displayNegotiation && !negotiationHoldHidesForMe}
        {@const negotiation = displayNegotiation}
        <!-- items-center on the column, justify-center on each row: the column is only as wide as
             its widest row (the terms), so without the latter the shorter signing row sat flush
             left under it - centred as a block, but not centred on the board the panel sits above.
             The rows now centre on each other, and the column centres on the game column, which is
             the same column ScalingWrapper centres the board in. -->
        <div class="flex flex-col items-center text-black text-sm">
            <div class="flex flex-wrap items-center justify-center gap-2 pb-5 text-[16px]">
                <!-- Side by side rather than stacked. Two names in a column made this box two lines
                     tall on its own, which set the height of the whole row and so of the space the
                     panel takes above the board. The caption underneath is what the stacked layout
                     got for free: a column of two names reads as a choice, a row of two names reads
                     as a score, so with them side by side the box has to say what it is. -->
                <div class="relative flex flex-col items-center leading-tight">
                    <div class="flex flex-row items-center gap-2 border border-black/30 rounded px-2 py-1">
                        {#each negotiation.playerIds as playerId (playerId)}
                            <button
                                type="button"
                                disabled={!gameSession.isMyNegotiationTurn}
                                class={gameSession.negotiationProposerId === playerId
                                    ? ''
                                    : 'opacity-30 hover:opacity-70'}
                                onclick={() => gameSession.setNegotiationProposer(playerId)}
                            >
                                {@render playerPill(playerId)}
                            </button>
                        {/each}
                    </div>
                    <!-- Out of flow, so the column's height is the box's height and the box
                         centres on the row exactly as the sentence text does. In flow the column
                         was box-plus-caption tall, and items-center centred THAT - which lifted the
                         names about half a caption above the line they are meant to sit on. The
                         row's bottom padding is where this now sits, and leading-none is what lets
                         a 12px pad hold a 10px caption at all: without it the span inherits the
                         column's text-sm line-height (20px), so a 22px caption sat under a 16px pad
                         and all but touched the row below - the two rows could not close up until
                         the caption stopped being taller than the space reserved for it. The pad is
                         pb-5 now, not the 12px minimum that math needs - Justin wanted more air
                         between this row and the next, and the caption just rides in the extra
                         space above the row boundary rather than needing it. -->
                    <span
                        class="absolute top-full mt-0.5 text-[10px] leading-none text-black/50 whitespace-nowrap"
                    >
                        Choose a player
                    </span>
                </div>
                <span>{gameSession.negotiationProposerId === gameSession.myPlayer?.id ? 'offer' : 'offers'}</span>
                <!-- Its own tight-gap group, separate from the row's gap-2: that gap reads fine
                     between unrelated segments (the picker, "offer(s)", this trio, "ducats to"),
                     but stacked with the -/+ buttons' own px-2 it left the number floating rather
                     than looking bound to the controls that change it. -->
                <span class="flex items-center gap-0.5">
                    <button
                        type="button"
                        class="leading-none px-2 pt-[3px] pb-[2px] rounded bg-black/10 hover:bg-black/20 font-semibold disabled:opacity-40"
                        disabled={!gameSession.isMyNegotiationTurn ||
                            gameSession.negotiationAmount <= gameSession.minimumNegotiationOffer}
                        onclick={() =>
                            gameSession.setNegotiationAmount(
                                Math.max(
                                    gameSession.minimumNegotiationOffer,
                                    gameSession.negotiationAmount - 1
                                )
                            )}
                    >
                        −
                    </button>
                    <span class="w-6 text-center font-semibold">{gameSession.negotiationAmount}</span>
                    <button
                        type="button"
                        class="leading-none px-2 pt-[3px] pb-[2px] rounded bg-black/10 hover:bg-black/20 font-semibold disabled:opacity-40"
                        disabled={!gameSession.isMyNegotiationTurn ||
                            gameSession.negotiationAmount >= negotiationProposerMoney}
                        onclick={() => gameSession.setNegotiationAmount(gameSession.negotiationAmount + 1)}
                    >
                        +
                    </button>
                </span>
                <span class="flex items-center gap-1">
                    ducat{gameSession.negotiationAmount === 1 ? '' : 's'} to
                    {#if negotiationOtherPlayerId}
                        {@render playerPill(negotiationOtherPlayerId)}
                    {/if}
                </span>
            </div>

            {#if gameSession.gameState.machineState === MachineState.Negotiating}
                <div class="flex flex-wrap items-center justify-center gap-2 pb-4 text-[16px]">
                    {#if gameSession.isMyNegotiationTurn && gameSession.isNegotiator}
                        {#if gameSession.isAcceptingNegotiationOffer}
                            <span>Modify the proposal&nbsp; or</span>
                        {/if}
                        <button
                            type="button"
                            class="px-2 py-[3px] rounded bg-green-700/20 hover:bg-green-700/30 text-[14px] font-semibold"
                            onclick={() => commitNegotiationOffer()}
                        >
                            {gameSession.isAcceptingNegotiationOffer
                                ? 'Accept'
                                : negotiation.offer
                                  ? 'Counterpropose'
                                  : 'Propose'}
                        </button>
                        <span>or</span>
                    {/if}
                    <button
                        type="button"
                        class="px-2 py-[3px] rounded bg-red-700/10 hover:bg-red-700/20 text-[14px] font-semibold disabled:opacity-40"
                        disabled={!gameSession.canDeclineNegotiation}
                        onclick={() => gameSession.declineNegotiation()}
                    >
                        Force a duel
                    </button>
                </div>
            {:else if negotiation.offer}
                {@const toPlayerId = negotiation.playerIds.find(
                    (id) => id !== negotiation.offer!.fromPlayerId
                )}
                <!-- The completed hold (see the onMount listener above): the deal is done, so
                     there is nothing left to sign or decline - just the struck terms, on screen
                     for a beat before the next thing takes over. -->
                <div class="pb-4 text-[16px]">
                    {playerName(gameSession, negotiation.offer.fromPlayerId)} pays {toPlayerId
                        ? playerName(gameSession, toPlayerId)
                        : ''}
                    {negotiation.offer.amount} ducat{negotiation.offer.amount === 1 ? '' : 's'}.
                </div>
            {/if}
        </div>
    {/if}

    {#if gameSession.gameState.machineState === MachineState.Dueling && gameSession.gameState.duel}
        {@const duel = gameSession.gameState.duel}
        {@const myId = gameSession.myPlayer?.id}
        <div class="flex flex-col gap-1 text-black text-[16px]">
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
                {@const unarmedTreasureCards = gameSession.myTreasureCards.filter(
                    (c) => !gameSession.armedDuelTreasureIds.includes(c.id)
                )}
                <div class="flex flex-wrap items-center gap-2">
                    <span class="font-semibold">Your bid:</span>
                        {@render duelBidStepper(myId, bidAmount, money)}
                        <!-- One chip per armed Treasure - nothing in the rulebook caps a bid at
                             one, so unlike a wooded knight placement's single armedTreasure this
                             is a set (see GameSession.armedDuelTreasureIds). Clicking a chip
                             unarms just that card. This is the ONLY way back: arming is local UI
                             state, not a game action, so Undo never touches it, and APPLY in the
                             hand only ever arms. It used to be a "don't play it" button on a
                             sentence below.

                             The X that used to sit on the end is gone; the hover title and the
                             red hover state are what advertise that a chip is removable. -->
                        {#each gameSession.armedDuelTreasureCards as treasureCard (treasureCard.id)}
                            <button
                                type="button"
                                class="px-1.5 py-[3px] rounded font-semibold bg-green-700/15 hover:bg-red-700/20"
                                title="Choose to take this Treasure back out of your bid"
                                onclick={() => gameSession.unarmDuelTreasure(treasureCard.id)}
                            >
                                + Treasure ({treasureCard.value})
                            </button>
                        {/each}
                        {#if unarmedTreasureCards.length > 0}
                            <!-- The empty slot the next chip will fill, shown only while a duelist
                                 still holds an unarmed Treasure. It replaces a "Nudge: You hold a
                                 Treasure!" sentence that sat after Submit bid: same information,
                                 but pointing at the place the card lands instead of announcing it
                                 somewhere else in the row, so arming one swaps this for the real
                                 chip in situ rather than moving anything.

                                 With exactly one Treasure left unarmed there's nothing to choose
                                 between, so a click arms it directly - same arm-only effect as
                                 hitting APPLY in the hand, just without the detour. With more than
                                 one, this instead opens the hand (the same peek PlayerState's pile
                                 offers) so the player can pick which to APPLY. -->
                            <button
                                type="button"
                                class="px-1.5 py-[3px] rounded font-semibold border border-dashed border-black/30 text-black/45 hover:border-black/50 hover:text-black/70"
                                title={unarmedTreasureCards.length === 1
                                    ? 'Add this Treasure to your bid'
                                    : 'Open your hand and hit APPLY on a Treasure to add it to this bid'}
                                onclick={(event) => {
                                    if (unarmedTreasureCards.length === 1) {
                                        gameSession.armDuelTreasure(unarmedTreasureCards[0].id)
                                        return
                                    }
                                    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
                                    gameSession.showMyPoliticsCards({
                                        x: rect.left + rect.width / 2,
                                        y: rect.top + rect.height / 2
                                    })
                                }}
                            >
                                + Treasure?
                            </button>
                        {/if}
                        <button
                            type="button"
                            class="px-2 py-[3px] rounded bg-green-700/20 hover:bg-green-700/30 font-semibold"
                            onclick={() =>
                                gameSession.submitDuelBid(
                                    bidAmount,
                                    gameSession.armedDuelTreasureIds
                                )}
                        >
                            Submit bid
                        </button>
                </div>
            {/if}

            <!-- There's deliberately no card picker in the bid row above: a Treasure
                 card is played the same way everywhere else in the game - open your
                 hand (click your cards in your player panel), then hit APPLY on the
                 card, which arms it (see PoliticsHand/armDuelTreasure) for the bid
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
