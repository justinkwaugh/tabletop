<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
</script>

<div class="card">
    {#each gameSession.gameState.activePlayerIds as playerId (playerId)}
        <p><PlayerName {playerId} /> is acting.</p>
    {/each}
</div>

<style>
    .card {
        margin: 0 8px 8px;
        padding: 10px 14px;
        border-radius: 8px;
        background: rgb(0 0 0 / 0.16);
        box-shadow: inset 0 0 0 2px var(--reef-line);
    }
</style>
