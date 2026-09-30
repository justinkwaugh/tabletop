<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import MapLegend from './MapLegend.svelte'
    import RoundCard, { type RoundCardSeat } from './RoundCard.svelte'

    const gameSession = getGameSession()

    const state = $derived(gameSession.gameState)
    const card = $derived(state.currentCard())
    const turnOrder: RoundCardSeat[] = $derived(
        state.roundOrder.map((playerId, index) => ({
            playerId,
            name: gameSession.getPlayerName(playerId),
            color: gameSession.colors.getPlayerUiColor(playerId),
            done: !!state.result || index < state.turnIndex,
            current: !state.result && index === state.turnIndex
        }))
    )
    const upcoming = $derived(state.result ? undefined : state.upcomingCard())
    const upcomingOrder: RoundCardSeat[] = $derived(
        upcoming
            ? state.turnOrderForCard(upcoming).map((playerId) => ({
                  playerId,
                  name: gameSession.getPlayerName(playerId),
                  color: gameSession.colors.getPlayerUiColor(playerId)
              }))
            : []
    )
</script>

<aside class="card-panel">
    <div class="round-label">
        Round <span class="round-number">{state.round + 1}</span> of
        <span class="round-number">{state.roundCount}</span>
    </div>

    <RoundCard {card} seats={turnOrder} />

    <p class="hint">Take two actions, or one enhanced to the higher number.</p>

    {#if upcoming}
        <section class="upcoming" aria-label="Upcoming round">
            <div class="upcoming-label">Upcoming · Round {state.round + 2}</div>
            <RoundCard card={upcoming} seats={upcomingOrder} upcoming />
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
        font-family: Georgia, 'Times New Roman', serif;
    }

    .round-label {
        font-size: 30px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        text-align: center;
    }

    .round-number {
        font-size: 40px;
        font-weight: 700;
    }

    .hint {
        margin: 0;
        font-size: 21px;
        line-height: 1.35;
        text-align: center;
        color: #6b4a2a;
    }

    .upcoming {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .upcoming-label {
        font-size: 20px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        text-align: center;
    }
</style>
