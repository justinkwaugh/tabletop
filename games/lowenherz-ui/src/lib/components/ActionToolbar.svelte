<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { MachineState } from '@tabletop/lowenherz'
    import PlayerPill from './PlayerPill.svelte'
    import RegionScoringCard from './RegionScoringCard.svelte'

    const gameSession = getGameSession()

    // The region-scoring aid is a plain overlay rather than a popover anchored to the ?
    // button, because it's meant to land on the middle of the board. The board's position
    // is read at click time (it moves with the window, the zoom wrapper's scale, and the
    // status text above it growing/shrinking), so there's nothing to keep in sync while
    // the card is closed.
    let showRegionAid = $state(false)
    let boardCenter: { x: number; y: number } | undefined = $state(undefined)

    function toggleRegionAid() {
        if (showRegionAid) {
            showRegionAid = false
            return
        }
        const rect = document.getElementById('lowenherz-board-frame')?.getBoundingClientRect()
        boardCenter = rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : undefined
        showRegionAid = true
    }

    // Backing out of an in-progress local-only selection (playing a Renegade/
    // Alliance card, or the expand-region sub-flow) takes priority over reverting a
    // submitted game action - those flows don't submit anything of their own until
    // fully confirmed, so there's nothing yet for a "real" undo to revert, and this
    // button is the only backing-out mechanism for them (no separate Cancel button).
    const hasLocalStepToCancel = $derived(
        gameSession.isPlayingRenegadeCard ||
            gameSession.isPlayingAllianceCard ||
            // A picked castle square during setup is local-only in exactly the same way: the
            // castle is drawn as settled, but nothing is submitted until its knight square is
            // chosen too, so there is no action to revert and Undo is the only way back.
            //
            // Most visible on the very FIRST castle of the game, where no action exists yet and
            // Undo therefore sat dark with a castle apparently on the board. On later castles it
            // lit up, but only because it had the PREVIOUS placement to offer - which is not what
            // the player is trying to take back.
            gameSession.selectedCastleSquare !== undefined ||
            // A declared knight-action plan (see GameSession.knightPlan) is local-only
            // too, and it's the sole way back out of one now that the flow has no cancel
            // buttons - but only while nothing's landed under it yet. Once a knight or an
            // expansion space is down, Undo has a real action to revert instead.
            (gameSession.knightPlan !== undefined && !gameSession.knightPlanHasProgress)
    )
    const canUndo = $derived(hasLocalStepToCancel || !!gameSession.undoableAction)

    function handleUndo() {
        if (gameSession.isPlayingRenegadeCard) {
            gameSession.cancelPlayingRenegadeCard()
        } else if (gameSession.isPlayingAllianceCard) {
            gameSession.cancelPlayingAllianceCard()
        } else if (gameSession.knightPlan !== undefined && !gameSession.knightPlanHasProgress) {
            gameSession.clearKnightPlan()
        } else if (gameSession.selectedCastleSquare) {
            // Before the fall-through on purpose: with a castle square picked, Undo has to mean
            // "put that castle back" rather than "revert whoever placed one before me".
            gameSession.clearCastleSelection()
        } else {
            // Reverting an expansion space leaves the local record of picked spaces
            // (previews, the 1-2 space cap) stale, since nothing else hears about an
            // undo - clearing it lets the space be re-picked. The region auto-reselects
            // when the player owns only one (see RealBoard).
            gameSession.cancelExpansion()
            gameSession.undo()
        }
    }

    // Whose turn it is (just the first active player - Löwenherz can occasionally
    // have more than one, e.g. both negotiators at once, but this bar only needs a
    // quick-glance summary), and a short label for the broad phase they're in. Not
    // every machine state gets one - the ones left out (Negotiating, Dueling,
    // ResolvingActions, StartOfTurn) either already say enough via the player's
    // name alone or are too momentary to be worth a label here.
    const isEndOfGame = $derived(gameSession.gameState.machineState === MachineState.EndOfGame)
    const activePlayerIds = $derived(gameSession.gameState.activePlayerIds)
    // Who is actually being waited ON, which is not always who the engine has active. Both
    // negotiators stay active for the whole negotiation, so once one of them has signed the bar
    // was still naming them both - and the player who had signed was reading "waiting for you"
    // about themselves.
    //
    // Falls back to every active player if that would leave nobody: a standing offer with both
    // signatures does not linger (the deal executes on the second one), but an empty list would
    // read as a stall rather than as a moment.
    const waitingPlayerIds = $derived.by(() => {
        const duelists = waitingDuelistIds
        if (duelists) return duelists

        // Nothing to narrow for a negotiation any more: NegotiatingStateHandler.enter drops a
        // signer from activePlayerIds, so this list already excludes them - and so do the player
        // panels, the game list and anything else reading the same field, which a filter here
        // could never reach.
        return activePlayerIds
    })

    // Same narrowing for a duel: every duelist stays active until the bids resolve, so a player
    // whose bid is in was still being waited on by name.
    //
    // It does leak a little. A sealed bid is private, and "Waiting for Tom" tells the table that
    // everyone except Tom has already bid - something he could otherwise only guess at. Asked for
    // deliberately: the bid AMOUNTS stay sealed, and knowing who has yet to act is what this bar is
    // for everywhere else in the game.
    const waitingDuelistIds = $derived.by(() => {
        if (!gameSession.gameState.duel) return undefined

        const unbid = activePlayerIds.filter((id) => !gameSession.hasPlayerBidInDuel(id))
        return unbid.length > 0 ? unbid : activePlayerIds
    })

    // Almost always a single player ("Waiting for X to take an action"), but a negotiation with
    // nobody signed yet has two, and a 3+-way Dueling tie leaves all the tied players active -
    // the plural covers both. Which of those it is doesn't need spelling out here, since the
    // phase label names the specific thing they're doing.
    const waitingVerb = $derived(
        waitingPlayerIds.length > 1 ? 'to take their actions' : 'to take an action'
    )
    // Every machine state that can actually be waiting on someone gets a label - a
    // bare "Performing actions" covered the three action states without saying which
    // one, and Negotiating/Dueling/ResolvingActions had no label at all. Exhaustive
    // (no default) so a new state can't silently fall through to blank.
    const phase = $derived.by(() => {
        switch (gameSession.gameState.machineState) {
            case MachineState.PlacingCastles:
                return 'Initial castle placement'
            case MachineState.StartOfTurn:
                return 'Starting a new round'
            case MachineState.ChoosingActions:
                return 'Choosing actions'
            case MachineState.ResolvingActions:
                return 'Resolving the action'
            case MachineState.Negotiating:
                return 'Negotiating'
            case MachineState.Dueling:
                return 'Dueling'
            case MachineState.PlacingWalls:
                return 'Placing walls'
            // Either half of the knight action - a player who'd rather expand a region
            // than place a knight does it from this same state (see canExpandRegion).
            case MachineState.PlacingKnights:
                return 'Placing knights or expanding a region'
            case MachineState.TakingPoliticsCard:
                return 'Taking a politics card'
            // Never rendered - the whole readout is replaced by "Game over" above.
            case MachineState.EndOfGame:
                return undefined
        }
    })
</script>

<!-- border-b lives on this SAME box as h-[44px] (border-box sizing, like
     HistoryControls' own p-2/h-[44px]/border combo), not on a wrapping div - a
     border added to a wrapper around a fixed-height child sits 2px lower than one
     baked into the box itself, which was throwing this off from HistoryControls'
     line right next to it. -->
<div
    id="lowenherz-action-bar"
    class="shrink-0 mb-2 px-3 h-[44px] border-b-2 border-black/20 flex items-center gap-2 text-black"
>
    {#if isEndOfGame}
        <!-- The game's own line for this, rather than a bare "GAME OVER" - it names the
             card that ended it (The King is Dead), which is what a player actually saw
             happen. Used to live in the deck column via ActionCardArea; here it lands in
             the same spot every other turn-status message has occupied all game. -->
        <span class="font-bold">The King is dead! The game is over.</span>
    {:else if activePlayerIds.length > 0}
        <!-- One inline span (not separate flex children) so "Waiting for..." and the
             italic phase share a single baseline - as separate items-center flex
             children the italic phase didn't line up with the text to its left. The
             colon only appears when there's actually a phase to introduce. -->
        <span class="min-w-0 truncate">
            <span class="font-bold"
                >Waiting for
                {#each waitingPlayerIds as playerId, i (playerId)}{i > 0
                        ? i === waitingPlayerIds.length - 1
                            ? ' and '
                            : ', '
                        : ''}<PlayerPill {playerId} showAsYou={false} />{/each}
                {waitingVerb}{phase ? ':' : ''}</span
            >{#if phase}<span class="italic">&nbsp;{phase}</span>{/if}
        </span>
    {/if}
    <!-- The points readout used to ride here at the far right (with the ml-auto that now
         lives on the Undo button). It went to the side panel first, then onto the gold
         coin in each player's own panel - see PlayerState's .points-roundel. -->
    <button
        class="ml-auto px-3 py-1 rounded-lg bg-black/10 hover:bg-black/20 text-black font-semibold transition-colors disabled:opacity-40 disabled:hover:bg-black/10 disabled:cursor-not-allowed"
        disabled={!canUndo}
        onclick={handleUndo}
    >
        Undo
    </button>
    <!-- Region-scoring player aid: click to lay the reference card over the middle of the
         board, click anywhere outside (or Escape) to dismiss. -->
    <button
        type="button"
        aria-label="Region scoring reference"
        aria-expanded={showRegionAid}
        class="leading-none rounded-full bg-black/10 hover:bg-black/20 h-6 w-6 flex items-center justify-center text-lg font-bold text-black"
        onclick={toggleRegionAid}
    >
        ?
    </button>
</div>

{#if showRegionAid}
    <!-- Centered on the BOARD rather than the viewport - the table layout puts a sidebar
         down one side, so viewport-centering lands the card visibly off to one side of the
         board it's meant to sit on. boardCenter is measured at click time (see
         toggleRegionAid); if the frame can't be found, this falls back to centering in the
         viewport rather than rendering the card in a corner. -->
    <div
        class="fixed inset-0 z-50 {boardCenter ? '' : 'flex items-center justify-center'}"
        role="button"
        tabindex="0"
        onclick={() => (showRegionAid = false)}
        onkeydown={(e) => {
            if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') showRegionAid = false
        }}
    >
        <div
            class={boardCenter ? 'absolute' : ''}
            style={boardCenter
                ? `left: ${boardCenter.x}px; top: ${boardCenter.y}px; transform: translate(-50%, -50%);`
                : ''}
            role="presentation"
            onclick={(e) => e.stopPropagation()}
        >
            <RegionScoringCard />
        </div>
    </div>
{/if}
