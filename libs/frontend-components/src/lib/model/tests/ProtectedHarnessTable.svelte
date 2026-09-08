<script lang="ts">
    import type { GameState, HydratedGameState } from '@tabletop/common'
    import { HydratedPrivateHandState } from '@tabletop/common/test-fixtures/private-hand'
    import type { GameSession } from '../gameSession.svelte.js'
    let { gameSession }: { gameSession: GameSession<GameState, HydratedGameState> } = $props()
    const state = $derived(
        gameSession.gameState instanceof HydratedPrivateHandState
            ? gameSession.gameState
            : undefined
    )
</script>

{#if state}
    <div data-testid="table">
        {#each state.players as player}
            <p data-testid={player.playerId}>
                {player.hand ? player.hand.cards.map((card) => card.id).join(',') : 'Hidden'}
            </p>
        {/each}
        <p data-testid="deck">{state.drawPile.items.length}</p>
        <p data-testid="actions">{gameSession.actions.length}</p>
    </div>
{/if}
