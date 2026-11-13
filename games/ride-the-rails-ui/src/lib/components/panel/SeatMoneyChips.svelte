<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { seatMoney } from '$lib/model/actionArea.js'
    import SeatChip from './SeatChip.svelte'

    const gameSession = getGameSession()

    // R-2.5.1: money decides the next round's order, so it is shown in turn order.
    const seats = $derived(seatMoney(gameSession.gameState))
</script>

<div class="flex flex-wrap gap-1.5" aria-label="Money in turn order">
    {#each seats as seat (seat.playerId)}
        <SeatChip playerId={seat.playerId} text="${seat.money}" />
    {/each}
</div>
