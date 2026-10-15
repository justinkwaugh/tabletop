<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import PlayerTray from './PlayerTray.svelte'

    const session = getGameSession()

    const orderedPlayers = $derived.by(() => {
        const players = session.gameState.players
        const myId = session.myPlayer?.id
        if (myId === undefined || session.primaryGame.hotseat) {
            return players
        }
        return players.toSorted((a, b) => Number(b.playerId === myId) - Number(a.playerId === myId))
    })
</script>

<div class="flex flex-col gap-3">
    {#each orderedPlayers as playerState (playerState.playerId)}
        <PlayerTray {playerState} />
    {/each}
</div>
