<script lang="ts">
    import PlayerState from '$lib/components/PlayerState.svelte'
    import { seatOrder } from '$lib/model/seatPanel.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

    let seats = $derived(seatOrder(gameSession.gameState))
</script>

<div class="space-y-2 grow-0 shrink-0" data-seat-column>
    {#each seats as playerId (playerId)}
        <PlayerState {playerId} />
    {/each}
</div>
