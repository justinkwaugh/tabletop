<script lang="ts">
    import { flip } from 'svelte/animate'
    import { cubicOut } from 'svelte/easing'
    import PlayerState from '$lib/components/PlayerState.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { sharesKey } from '$lib/animators/flights.svelte.js'
    import { pendingGains, seatCards } from '$lib/utils/seatCards.js'

    const gameSession = getGameSession()

    // Share counts tick ahead of the shown state as a share's locomotive lands (Animation plan, Share).
    const cards = $derived(
        seatCards(gameSession.gameState, (playerId, railroadId, shares) =>
            gameSession.flights.shown(sharesKey(playerId, railroadId), shares)
        )
    )
    const pending = $derived(pendingGains(gameSession.journeyPreview?.payments ?? []))
</script>

<div class="flex flex-col gap-2 grow-0 shrink-0">
    <!-- The cards reorder between phases (R-2.2) and rounds (R-2.5) once the new state is shown,
         after any flight to them has landed; they slide to their new places. -->
    {#each cards as card (card.playerId)}
        <div animate:flip={{ duration: 320, easing: cubicOut }}>
            <PlayerState {card} pendingGain={pending.get(card.playerId)} />
        </div>
    {/each}
</div>
