<script lang="ts">
    import { Popover } from 'flowbite-svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { MachineState } from '@tabletop/lowenherz'
    import PlayerPill from './PlayerPill.svelte'
    import regionCreationAid from '$lib/images/region-creation.png'

    const gameSession = getGameSession()

    // Backing out of an in-progress local-only selection (playing a Renegade/
    // Alliance card, or the expand-region sub-flow) takes priority over reverting a
    // submitted game action - those flows don't submit anything of their own until
    // fully confirmed, so there's nothing yet for a "real" undo to revert, and this
    // button is the only backing-out mechanism for them (no separate Cancel button).
    const hasLocalStepToCancel = $derived(
        gameSession.isPlayingRenegadeCard ||
            gameSession.isPlayingAllianceCard ||
            gameSession.selectedExpandRegionId !== undefined
    )
    const canUndo = $derived(hasLocalStepToCancel || !!gameSession.undoableAction)

    function handleUndo() {
        if (gameSession.isPlayingRenegadeCard) {
            gameSession.cancelPlayingRenegadeCard()
        } else if (gameSession.isPlayingAllianceCard) {
            gameSession.cancelPlayingAllianceCard()
        } else if (gameSession.selectedExpandRegionId !== undefined) {
            gameSession.cancelExpansion()
        } else {
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
    const isNegotiating = $derived(gameSession.gameState.machineState === MachineState.Negotiating)
    // Almost always a single active player ("Waiting for X to take an action.."),
    // but Negotiating always has exactly the two negotiators active at once ("...to
    // negotiate.."), and a 3+-way Dueling tie could in principle leave more than one
    // active too - "to take their actions.." covers that generic multi-player case.
    const waitingVerb = $derived(
        isNegotiating
            ? 'to negotiate:'
            : activePlayerIds.length > 1
              ? 'to take their actions:'
              : 'to take an action:'
    )
    const phase = $derived.by(() => {
        switch (gameSession.gameState.machineState) {
            case MachineState.PlacingCastles:
                return 'Initial castle placement'
            case MachineState.StartOfTurn:
                return 'Starting a new round'
            case MachineState.ChoosingActions:
                return 'Choosing actions'
            case MachineState.PlacingWalls:
            case MachineState.PlacingKnights:
            case MachineState.TakingPoliticsCard:
                return 'Performing actions'
            default:
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
        <!-- One inline span (not separate flex children) so "Waiting for...", the dot,
             and the italic phase all share a single baseline - as separate
             items-center flex children the italic phase didn't line up with the text
             to its left. -->
        <span class="min-w-0 truncate">
            <span class="font-bold"
                >Waiting for
                {#each activePlayerIds as playerId, i (playerId)}{i > 0
                        ? i === activePlayerIds.length - 1
                            ? ' and '
                            : ', '
                        : ''}<PlayerPill {playerId} showAsYou={false} />{/each}
                {waitingVerb}</span
            >{#if phase}<span class="text-black/40 mx-2">·</span><span class="italic">{phase}</span>{/if}
        </span>
    {/if}
    <!-- ml-auto lives here (not on a separate wrapper) so this points readout rides
         along with the Undo button at the far right, rather than each needing its
         own margin. -->
    <div class="ml-auto flex items-center gap-1.5">
        <span class="font-semibold">Points:</span>
        {#each gameSession.gameState.players as ps (ps.playerId)}
            <span
                class="w-9 shrink-0 text-center px-1 py-0.5 rounded-md font-bold text-white"
                style="background-color: {gameSession.colors.getPlayerUiColor(ps.playerId)}"
            >
                {ps.powerPoints}
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
    <!-- Region-scoring player-aid card, same pattern as Sol's ? help icon: click to
         pop the reference card near the icon, click anywhere outside to dismiss. -->
    <button
        id="region-aid"
        type="button"
        aria-label="Region scoring reference"
        class="leading-none rounded-full bg-black/10 hover:bg-black/20 h-6 w-6 flex items-center justify-center text-lg font-bold text-black"
    >
        ?
    </button>
    <Popover
        reference="#lowenherz-action-bar"
        classes={{ content: 'p-0 bg-transparent border-0 shadow-none dark:bg-transparent dark:border-0' }}
        placement="bottom"
        triggeredBy="#region-aid"
        trigger="click"
        offset={16}
        arrow={false}
    >
        <!-- Transparent popover shell + slightly see-through card, so the card's own
             rounded corners show the board behind them rather than the popover's
             (dark, in dark mode) background box. -->
        <img
            src={regionCreationAid}
            alt="Region creation scoring table"
            class="w-[260px] opacity-90 drop-shadow-lg"
        />
    </Popover>
</div>
