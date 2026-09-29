<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

    const winners = $derived(gameSession.gameState.winningPlayerIds)
    const rows = $derived(
        Object.entries(gameSession.gameState.scores())
            .map(([playerId, score]) => ({ playerId, ...score }))
            .toSorted((a, b) => b.total - a.total)
    )
</script>

<div class="flex flex-col items-center gap-2 px-4 pt-3 pb-2 text-[#4a2c12]">
    <h1 class="inline-flex flex-wrap items-center gap-x-2 text-[22px] font-semibold">
        {#if winners.length > 1}
            <span>The oracles are divided between</span>
        {:else}
            <span>Magna Grecia honours</span>
        {/if}
        {#each winners as winnerId, index (winnerId)}
            {#if index > 0}<span>and</span>{/if}
            <PlayerName playerId={winnerId} />
        {/each}
    </h1>
    <table class="scores">
        <thead>
            <tr>
                <th></th>
                <th>Points</th>
                <th>Markets</th>
                <th>Oracles</th>
                <th>Total</th>
            </tr>
        </thead>
        <tbody>
            {#each rows as row (row.playerId)}
                <tr class:winner={winners.includes(row.playerId)}>
                    <td class="text-left"><PlayerName playerId={row.playerId} /></td>
                    <td>{row.points}</td>
                    <td>{row.markets}</td>
                    <td>{row.oracles}</td>
                    <td class="total">{row.total}</td>
                </tr>
            {/each}
        </tbody>
    </table>
</div>

<style>
    .scores {
        border-collapse: collapse;
        font-size: 16px;
    }

    .scores th {
        padding: 2px 12px;
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: #8c6a45;
    }

    .scores td {
        padding: 3px 12px;
        text-align: center;
        border-top: 1px solid rgba(107, 63, 29, 0.2);
    }

    .scores tr.winner td {
        background: rgba(227, 177, 47, 0.18);
    }

    .total {
        font-weight: 700;
    }
</style>
