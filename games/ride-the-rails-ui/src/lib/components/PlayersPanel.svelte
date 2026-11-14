<script lang="ts">
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
    {#each cards as card (card.playerId)}
        <PlayerState {card} pendingGain={pending.get(card.playerId)} />
    {/each}
</div>
