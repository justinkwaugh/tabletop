<script lang="ts">
    import { onDestroy } from 'svelte'
    import type { Player } from '@tabletop/common'
    import type { HydratedMarracashPlayerState } from '@tabletop/marracash'
    import PlayerState from '$lib/components/PlayerState.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    onDestroy(() => gameSession.highlightCustomers(undefined))

    type PlayerAndState = { player: Player; playerState: HydratedMarracashPlayerState }

    let seated: PlayerAndState[] = $derived.by(() => {
        const inTurnOrder = gameSession.gameState.turnManager.turnOrder.flatMap((playerId) => {
            const player = gameSession.game.players.find((candidate) => candidate.id === playerId)
            const playerState = gameSession.gameState.findPlayerState(playerId)
            return player && playerState ? [{ player, playerState }] : []
        })
        const myId = gameSession.myPlayer?.id
        const myIndex = inTurnOrder.findIndex((entry) => entry.player.id === myId)
        return gameSession.primaryGame.hotseat || myIndex < 0
            ? inTurnOrder
            : [...inTurnOrder.slice(myIndex), ...inTurnOrder.slice(0, myIndex)]
    })
</script>

<!-- Padded so the turn ring and glow round the active panel aren't clipped by the scrolling tab -->
<div class="flex shrink-0 grow-0 flex-col gap-2 rounded-lg p-2.5">
    {#each seated as entry (entry.player.id)}
        <PlayerState player={entry.player} playerState={entry.playerState} />
    {/each}
</div>
