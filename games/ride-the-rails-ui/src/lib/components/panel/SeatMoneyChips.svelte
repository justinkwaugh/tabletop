<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { seatMoney } from '$lib/model/actionArea.js'
    import { moneyKey } from '$lib/animators/flights.svelte.js'
    import SeatChip from './SeatChip.svelte'

    const gameSession = getGameSession()

    // R-2.5.1: money decides the next round's order, so it is shown in turn order. It ticks as a
    // flight lands, as on the seat cards (Animation plan).
    const seats = $derived(seatMoney(gameSession.gameState))
</script>

<div class="flex flex-wrap gap-1.5" aria-label="Money in turn order">
    {#each seats as seat (seat.playerId)}
        <span data-flight-target={moneyKey(seat.playerId)}>
            <SeatChip
                playerId={seat.playerId}
                text="${gameSession.flights.shown(moneyKey(seat.playerId), seat.money)}"
            />
        </span>
    {/each}
</div>
