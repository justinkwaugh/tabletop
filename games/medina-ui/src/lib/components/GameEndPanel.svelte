<script lang="ts">
    import { CalledGameEnding } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte'
    import RoofedName from './RoofedName.svelte'

    const session = getGameSession()
    const winners = $derived(session.gameState.winningPlayerIds)
    const rows = $derived(
        Object.entries(session.scores)
            .map(([playerId, score]) => ({
                playerId,
                total: score.total,
                palaces: score.palaces.reduce((sum, palace) => sum + palace.total, 0),
                palaceTiles: score.palaceTiles,
                towerTiles: score.towerTiles
            }))
            .toSorted((a, b) => b.total - a.total)
    )
</script>

<div class="end">
    {#if session.gameCall}
        <CalledGameEnding />
    {:else}
        <h2>
            {#each winners as winnerId, index (winnerId)}
                {#if index > 0}<span class="said">and</span>{/if}
                <RoofedName playerId={winnerId} />
            {/each}
            <span class="said">{winners.length > 1 ? 'win' : 'wins'}</span>
        </h2>
        <table>
            <thead>
                <tr>
                    <th></th>
                    <th>Palaces</th>
                    <th>Palace tiles</th>
                    <th>Tower tiles</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
                {#each rows as row (row.playerId)}
                    <tr class:winner={winners.includes(row.playerId)}>
                        <td class="name"><RoofedName playerId={row.playerId} /></td>
                        <td>{row.palaces}</td>
                        <td>{row.palaceTiles}</td>
                        <td>{row.towerTiles}</td>
                        <td class="total">{row.total}</td>
                    </tr>
                {/each}
            </tbody>
        </table>
    {/if}
</div>

<style>
    .end {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        padding: 8px 14px 10px;
        color: #2a1609;
    }

    h2 {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 8px;
        align-items: center;
        justify-content: center;
        margin: 0;
        font:
            700 25px/1.1 'Medina Display',
            Georgia,
            serif;
    }

    .said {
        position: relative;
        top: 3px;
    }

    table {
        border-collapse: collapse;
        font:
            500 16px/1.2 'Medina Body',
            system-ui,
            sans-serif;
    }

    th {
        padding: 2px 12px;
        color: #5c3a1d;
        font-weight: 500;
    }

    td {
        padding: 3px 12px;
        border-top: 1px solid #7f5228;
        text-align: center;
    }

    td.name {
        font:
            700 17px/1.25 'Medina Display',
            Georgia,
            serif;
        text-align: left;
    }

    .total {
        font:
            700 19px/1 'Medina Display',
            Georgia,
            serif;
    }

    tr.winner td {
        background: rgb(255 243 212 / 0.25);
    }

    @media (max-width: 639px) {
        th,
        td {
            padding-inline: 6px;
        }
    }
</style>
