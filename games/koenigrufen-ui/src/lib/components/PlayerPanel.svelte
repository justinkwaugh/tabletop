<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // A score sheet line on card stock: the player's running total from hand to hand.
    let { playerId }: { playerId: string } = $props()

    const gameSession = getGameSession()
    const state = $derived(gameSession.gameState)
    const player = $derived(state.getPlayerState(playerId))
    const fill = $derived(gameSession.colors.getPlayerBgColorValue(playerId))
    const ink = $derived(gameSession.colors.getPlayerTextColorValue(playerId))
    const lastChange = $derived(gameSession.lastHandResult?.scoreChanges[playerId])
    const won = $derived(gameSession.wonCardsOf(playerId))
</script>

<div class="panel">
    <div class="name" style:background={fill} style:color={ink}>
        {gameSession.getPlayerName(playerId)}
        {#if state.dealerId === playerId}<span class="role">dealer</span>{/if}
    </div>
    <div class="body">
        <div class="score">
            <span class="label">Score</span>
            <span class="value">{player.score}</span>
        </div>
        {#if lastChange !== undefined}
            <div class="change" class:up={lastChange > 0} class:down={lastChange < 0}>
                last hand {lastChange > 0 ? '+' : ''}{lastChange}
            </div>
        {/if}
        <div class="cards">
            {player.handCount} in hand · {won} won
        </div>
    </div>
</div>

<style>
    .panel {
        overflow: hidden;
        border-radius: 10px;
        border: 1px solid #b9ae95;
        background: #fbf8ef;
        color: #2a2116;
        box-shadow: 0 1px 0 rgb(0 0 0 / 0.4);
    }

    .name {
        display: flex;
        justify-content: space-between;
        padding: 4px 10px;
        font-weight: 700;
    }

    .role {
        font-weight: 400;
        font-size: 0.75rem;
        opacity: 0.85;
    }

    .body {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 2px 8px;
        padding: 6px 10px 8px;
        font-family: Georgia, 'Times New Roman', serif;
    }

    .score {
        display: flex;
        align-items: baseline;
        gap: 8px;
    }

    .label {
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        opacity: 0.6;
    }

    .value {
        font-size: 1.5rem;
        font-weight: 700;
    }

    .change {
        align-self: center;
        font-size: 0.8rem;
    }

    .up {
        color: #2c6e49;
    }

    .down {
        color: #9b2c2c;
    }

    .cards {
        grid-column: 1 / -1;
        font-size: 0.8rem;
        opacity: 0.7;
    }
</style>
