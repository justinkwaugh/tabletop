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
    // Almost always a single active player ("Waiting for X to take an action"), but
    // Negotiating always has exactly the two negotiators active at once, and a 3+-way
    // Dueling tie leaves all the tied players active too - the plural covers both.
    // Which of those it is doesn't need spelling out here anymore, since the phase
    // label below now names the specific thing they're doing.
    const waitingVerb = $derived(
        activePlayerIds.length > 1 ? 'to take their actions' : 'to take an action'
    )
    // Every machine state that can actually be waiting on someone gets a label - a
    // bare "Performing actions" covered the three action states without saying which
    // one, and Negotiating/Dueling/ResolvingActions had no label at all. Exhaustive
    // (no default) so a new state can't silently fall through to blank.
    // Per-player Silver Mine payout, while a revealed mine is still sitting on the
    // discard pile (see GameSession.lastMineHillScoring) - keyed for the lookup below.
    const minePointsByPlayerId = $derived(
        new Map((gameSession.lastMineHillScoring ?? []).map((entry) => [entry.playerId, entry.points]))
    )
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
        <span class="font-bold uppercase tracking-wide">Game over</span>
    {:else if activePlayerIds.length > 0}
        <!-- One inline span (not separate flex children) so "Waiting for..." and the
             italic phase share a single baseline - as separate items-center flex
             children the italic phase didn't line up with the text to its left. The
             colon only appears when there's actually a phase to introduce. -->
        <span class="min-w-0 truncate">
            <span class="font-bold"
                >Waiting for
                {#each activePlayerIds as playerId, i (playerId)}{i > 0
                        ? i === activePlayerIds.length - 1
                            ? ' and '
                            : ', '
                        : ''}<PlayerPill {playerId} showAsYou={false} />{/each}
                {waitingVerb}{phase ? ':' : ''}</span
            >{#if phase}<span class="italic">&nbsp;{phase}</span>{/if}
        </span>
    {/if}
    <!-- ml-auto lives here (not on a separate wrapper) so this points readout rides
         along with the Undo button at the far right, rather than each needing its
         own margin. -->
    <div class="ml-auto flex items-center gap-1.5">
        <span class="font-semibold">Points:</span>
        {#each gameSession.gameState.players as ps (ps.playerId)}
            {@const mineGain = minePointsByPlayerId.get(ps.playerId) ?? 0}
            <!-- relative, so a Silver Mine payout can hang a "+N" directly beneath THIS
                 player's points box - the board only announces the reveal (see
                 RealBoard), the per-player numbers are read off here where each
                 player's running total already is. Absolutely positioned (and
                 pointer-events-none) so it can't change the bar's fixed 44px height
                 or nudge the boxes around. -->
            <span class="relative w-9 shrink-0">
                <span
                    class="block text-center px-1 py-0.5 rounded-md font-bold text-white"
                    style="background-color: {gameSession.colors.getPlayerUiColor(ps.playerId)}"
                >
                    {ps.powerPoints}
                </span>
                {#if mineGain > 0}
                    <span
                        class="pointer-events-none absolute top-full left-0 mt-[3px] w-full text-center px-1 py-0.5 rounded-md text-[13px] font-bold leading-none text-white shadow-sm"
                        style="background-color: {gameSession.colors.getPlayerUiColor(ps.playerId)}"
                        title="Silver Mine: power points for enclosed hills"
                    >
                        +{mineGain}
                    </span>
                {/if}
            </span>
        {/each}
    </div>
    <button
        class="px-3 py-1 rounded-lg bg-black/10 hover:bg-black/20 text-black font-semibold transition-colors disabled:opacity-40 disabled:hover:bg-black/10 disabled:cursor-not-allowed"
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
