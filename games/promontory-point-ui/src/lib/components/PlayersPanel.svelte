<script lang="ts">
    import SeatCard from '$lib/components/SeatCard.svelte'
    import { seatViews } from '$lib/model/seatView.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

    // Contract, "Seat card": one seat card per seat, in seat order (R-2.1).
    const seats = $derived(seatViews(gameSession.gameState, gameSession.myPlayer?.id))
</script>

<div class="flex flex-col gap-2.5 grow-0 shrink-0 p-1" data-seat-cards>
    {#each seats as view (view.playerId)}
        <SeatCard {view} />
    {/each}
</div>
