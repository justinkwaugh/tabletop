<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import PlayerTray from './PlayerTray.svelte'

    const session = getGameSession()
</script>

<div class="flex flex-col gap-3">
    {#each session.gameState.players as playerState (playerState.playerId)}
        <PlayerTray {playerState} />
    {/each}
</div>
