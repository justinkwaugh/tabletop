<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // The seats the engine waits on, one colour chip each; what they decide is in the History.
    let gameSession = getGameSession()
    let playerIds = $derived(gameSession.gameState.activePlayerIds)
</script>

<p class="text-sm text-oath-text-muted">
    Waiting on {#each playerIds as playerId, index (playerId)}{index > 0
            ? ' '
            : ''}<PlayerName {playerId} />{/each}.
</p>
