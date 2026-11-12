<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import CardStyleToggle from './CardStyleToggle.svelte'
    import PlayerPanel from './PlayerPanel.svelte'

    const gameSession = getGameSession()
</script>

<div class="space-y-2">
    {#each gameSession.seatsFromMe as playerId (playerId)}
        <PlayerPanel {playerId} />
    {/each}
    <CardStyleToggle />
</div>
