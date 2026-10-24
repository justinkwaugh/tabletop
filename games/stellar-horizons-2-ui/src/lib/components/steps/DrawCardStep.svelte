<script lang="ts">
    import { cardPile, deckName, drawableLevels, romanLevel } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // Rulebook 1.20: the drawer chooses the level of each card they draw, among those their techs
    // allow whose deck has cards (campaign plan, slice 4, Q3).
    const gameSession = getGameSession()
    const gameState = $derived(gameSession.gameState)
    const playerId = $derived(gameSession.myPlayerId ?? '')
    const draws = $derived(gameState.getPlayerState(playerId).cardDraws)
    const deck = $derived(draws.at(0))
    const levels = $derived(deck ? drawableLevels(gameState, playerId, deck) : [])
</script>

{#if deck}
    <div class="sh-step">
        <p class="hint">
            Draw {draws.length > 1 ? `${draws.length} cards; first ` : ''}a {deckName(deck)} for your
            hand. Choose the level to draw from.
        </p>
        <div class="row">
            {#each levels as level (level)}
                <button
                    type="button"
                    class="level"
                    onclick={() => gameSession.drawCard(deck, level)}
                >
                    <span class="name">Level {romanLevel(level)}</span>
                    <span class="left">{cardPile(gameState, deck, level).remaining} left</span>
                </button>
            {/each}
        </div>
    </div>
{/if}

<style>
    .row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .level {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        min-width: 96px;
        padding: 6px 12px;
    }

    .name {
        font-weight: 700;
    }

    .left {
        font-size: 12px;
        color: #8fa4c2;
    }
</style>
