<script lang="ts">
    import { BONUSES, TRANSCONTINENTAL_BONUS } from '@tabletop/ride-the-rails'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { decidingPlayerId } from '$lib/model/actionArea.js'
    import { ROUND_KEY } from '$lib/animators/flights.svelte.js'
    import { roundTickets, shownRoundNumber } from '$lib/utils/marginTracks.js'
    import RoundTicket from './RoundTicket.svelte'
    import RoundTickets from './RoundTickets.svelte'
    import ConnectionChip from './ConnectionChip.svelte'
    import SeatDot from './SeatDot.svelte'
    import TranscontinentalChip from './TranscontinentalChip.svelte'

    const gameSession = getGameSession()

    const deciderId = $derived(decidingPlayerId(gameSession.gameState))
    // R-4.3.3: only a map whose bonuses include the Transcontinental shows its chip.
    const hasTranscontinental = $derived(
        BONUSES[gameSession.gameState.mapId].some((bonus) => bonus.id === TRANSCONTINENTAL_BONUS.id)
    )
    // Where the six tickets do not fit, the current round's ticket alone, stepping as the round
    // ends (Animation plan, End of round).
    const currentTicket = $derived(
        roundTickets(gameSession.gameState.mapId)[
            gameSession.flights.shown(ROUND_KEY, shownRoundNumber(gameSession.gameState)) - 1
        ]
    )
    const canUndo = $derived(
        gameSession.hasLocalSelection || gameSession.undoableAction !== undefined
    )

    // docs/game-ui-layout.md, Turn header
    const whose = $derived.by(() => {
        if (gameSession.isViewingHistory) {
            return 'History'
        }
        if (gameSession.gameState.result) {
            return 'End of game'
        }
        if (gameSession.isMyTurn || !deciderId) {
            return 'Your turn'
        }
        return `${gameSession.getPlayerName(deciderId)}'s turn`
    })
    const showsSeat = $derived(
        !gameSession.isViewingHistory && !gameSession.gameState.result && deciderId !== undefined
    )
</script>

<div
    class="flex min-h-11 items-center justify-between gap-3 px-3 text-rtr-ink max-sm:min-h-9 max-sm:px-2"
>
    <div class="flex min-w-0 items-baseline gap-3 max-sm:gap-1.5">
        <span
            class="flex items-center gap-2 text-lg leading-tight font-bold max-sm:gap-1.5 max-sm:text-base"
            data-turn-whose
        >
            {#if showsSeat && deciderId}<SeatDot playerId={deciderId} />{/if}
            {whose}
        </span>
    </div>
    <div class="flex shrink-0 items-center gap-3 max-sm:gap-1.5">
        <RoundTickets />
        {#if currentTicket}
            <span class="lg:hidden"><RoundTicket ticket={currentTicket} /></span>
        {/if}
        {#if hasTranscontinental}<TranscontinentalChip />{/if}
        <!-- R-8: a map with a connection bonus shows its chip in the Transcontinental's place. -->
        <ConnectionChip />
        <button
            type="button"
            class="rounded-full border-2 border-rtr-pill bg-transparent px-3 py-0.5 text-sm font-semibold text-rtr-pill hover:enabled:bg-rtr-panel-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rtr-accent max-sm:px-2"
            class:invisible={!canUndo}
            disabled={!canUndo}
            onclick={() => gameSession.undo()}>Undo</button
        >
    </div>
</div>
