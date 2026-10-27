<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import Elektro from './actions/Elektro.svelte'

    const session = getGameSession()
    const standings = $derived(session.gameState.finalStandings())
</script>

<div class="end">
    <p class="status">
        {#each session.gameState.winningPlayerIds as playerId, index (playerId)}{index > 0
                ? ' and '
                : ''}<PlayerName {playerId} />{/each}
        {session.gameState.winningPlayerIds.length > 1 ? 'share the win' : 'wins'}, supplying the
        most cities.
    </p>
    <ol class="standings">
        {#each standings as standing, index (standing.playerId)}
            <li>
                <span class="rank">{index + 1}</span>
                <PlayerName playerId={standing.playerId} />
                <span>powers {standing.powered} of {standing.cities} cities</span>
                <span class="money"><Elektro amount={standing.money} /></span>
            </li>
        {/each}
    </ol>
</div>

<style>
    .status {
        font-size: 18px;
        font-weight: 600;
    }
    .standings {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 18px;
        margin-top: 4px;
    }
    li {
        display: inline-flex;
        gap: 6px;
        align-items: center;
    }
    .rank {
        font-family: 'Big Shoulders Stencil Display', sans-serif;
        font-weight: 800;
        color: #f3c534;
    }
    .money {
        color: #cfd4bd;
    }
</style>
