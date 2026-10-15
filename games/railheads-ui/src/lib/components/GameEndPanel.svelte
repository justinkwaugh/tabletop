<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

    const winners = $derived(gameSession.gameState.winningPlayerIds)
    const rows = $derived(
        gameSession.gameState.players
            .map((player) => ({ playerId: player.playerId, cash: player.cash }))
            .toSorted((a, b) => b.cash - a.cash)
    )
</script>

<div class="end">
    <h1>
        {#if winners.length > 1}
            <span>The richest investors are</span>
        {:else}
            <span>The richest investor is</span>
        {/if}
        {#each winners as winnerId, index (winnerId)}
            {#if index > 0}<span>and</span>{/if}
            <PlayerName
                playerId={winnerId}
                capitalization={winnerId === gameSession.myPlayerId ? 'none' : 'capitalize'}
            />
        {/each}
    </h1>
    <ol class="ranking">
        {#each rows as row (row.playerId)}
            <li class:winner={winners.includes(row.playerId)}>
                <PlayerName playerId={row.playerId} />
                <strong>{gameSession.money(row.cash)}</strong>
            </li>
        {/each}
    </ol>
</div>

<style>
    .end {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
        color: #26300f;
        font-family: 'Libre Baskerville', Georgia, serif;
    }

    h1 {
        display: inline-flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 6px;
        font-size: 20px;
        font-weight: 700;
    }

    .ranking {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 6px 14px;
        margin: 0;
        padding: 0;
        list-style: none;
    }

    .ranking li {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border-radius: 999px;
        padding: 2px 10px;
        box-shadow: inset 0 0 0 1px #b9b48a;
    }

    .ranking li.winner {
        background: rgba(227, 177, 47, 0.25);
    }
</style>
