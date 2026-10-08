<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { cityInfo } from '@tabletop/kogge'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const raid = $derived(gameSession.gameState.raid)
</script>

{#if raid}
    <div class="kogge-prompt inline-flex flex-wrap gap-1">
        <span>Send</span>
        <PlayerName playerId={raid.raiderId} />
        <span>away from {cityInfo(raid.city).name}: click one of its routes.</span>
    </div>
    <div class="kogge-note">
        A hidden route is turned over; if it leads to a city they raided, the cog stays.
    </div>
{/if}
