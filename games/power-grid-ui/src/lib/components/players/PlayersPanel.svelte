<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import PlayerConsole from './PlayerConsole.svelte'
    import TrustConsole from './TrustConsole.svelte'

    const session = getGameSession()
    const order = $derived(session.gameState.playerOrder)
    const hasTrust = $derived(session.gameState.trust !== undefined)
</script>

<div class="players">
    {#each order as playerId, index (playerId)}
        <PlayerConsole {playerId} position={hasTrust && index > 0 ? index + 2 : index + 1} />
        {#if hasTrust && index === 0}
            <TrustConsole />
        {/if}
    {/each}
</div>

<style>
    .players {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding-top: 6px;
    }
</style>
