<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import MapLegend from './MapLegend.svelte'
    import AllowanceList from './AllowanceList.svelte'
    import SeatSquares from './SeatSquares.svelte'

    const gameSession = getGameSession()

    const state = $derived(gameSession.gameState)
    const upcoming = $derived(state.result ? undefined : state.upcomingCard())
</script>

<aside class="card-panel">
    {#if upcoming}
        <section class="upcoming" aria-label="Upcoming round">
            <div class="upcoming-label">Upcoming · Round {state.round + 2}</div>
            <div class="upcoming-sheet">
                <AllowanceList card={upcoming} label="Next round's actions" compact />
                <SeatSquares playerIds={state.turnOrderForCard(upcoming)} compact />
            </div>
        </section>
    {/if}

    <MapLegend />
</aside>

<style>
    .card-panel {
        width: 360px;
        display: flex;
        flex-direction: column;
        gap: 14px;
        color: #4a2c12;
        font-family: 'Libre Baskerville', Georgia, serif;
    }

    .upcoming {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .upcoming-sheet {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        padding: 12px;
        border: 2px dashed rgba(107, 74, 42, 0.45);
        border-radius: 12px;
        background: rgba(107, 74, 42, 0.12);
        box-shadow: inset 0 2px 6px rgba(74, 44, 18, 0.18);
        color: #6b4a2a;
    }

    .upcoming-label {
        font-size: 20px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        text-align: center;
    }
</style>
