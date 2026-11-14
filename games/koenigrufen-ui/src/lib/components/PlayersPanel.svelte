<script lang="ts">
    import { CustomFont } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import KalamBold from '$lib/fonts/Kalam-Bold.woff2'
    import CardStyleToggle from './CardStyleToggle.svelte'
    import PlayerPanel from './PlayerPanel.svelte'

    const gameSession = getGameSession()
</script>

<CustomFont fontFamily="Koenigrufen Pen" url={KalamBold} format="woff2" fontWeight="700" />

<div class="space-y-2">
    {#each gameSession.seatsFromMe as playerId (playerId)}
        <PlayerPanel {playerId} />
    {/each}
    <CardStyleToggle />
</div>
