<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

    const standings = $derived(
        (gameSession.gameState.standings ?? []).toSorted((a, b) => b.points - a.points)
    )
</script>

<div class="end">
    <div class="title">
        {#each gameSession.gameState.winningPlayerIds as playerId, index (playerId)}
            {#if index > 0}<span>and</span>{/if}
            <PlayerName {playerId} />
        {/each}
        <span>{gameSession.gameState.winningPlayerIds.length > 1 ? 'share the win' : 'wins'}</span>
    </div>
    <table>
        <thead>
            <tr><th>Farmer</th><th>Economy</th><th>Ecology</th><th>Points</th></tr>
        </thead>
        <tbody>
            {#each standings as standing (standing.playerId)}
                <tr>
                    <td><PlayerName playerId={standing.playerId} /></td>
                    <td>{standing.economy} <small>({standing.economyPoints})</small></td>
                    <td>{standing.ecology} <small>({standing.ecologyPoints})</small></td>
                    <td class="points">{standing.points}</td>
                </tr>
            {/each}
        </tbody>
    </table>
</div>

<style>
    .end {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        padding: 6px 12px;
        font-family: 'Kartoffeln Letters', 'Comic Sans MS', cursive;
        text-transform: uppercase;
        color: #3d2410;
    }

    .title {
        display: inline-flex;
        flex-wrap: wrap;
        gap: 5px;
        font-size: 22px;
    }

    table {
        font-size: 16px;
    }

    th,
    td {
        padding: 0 10px;
        text-align: center;
    }

    small {
        color: #7a6248;
    }

    .points {
        font-weight: 700;
    }
</style>
