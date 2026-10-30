<script lang="ts">
    import type { Player } from '@tabletop/common'
    import type { HydratedPromontoryPointPlayerState } from '@tabletop/promontory-point'
    import PlayerState from '$lib/components/PlayerState.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let gameSession = getGameSession()

    type PlayerAndState = { player: Player; playerState: HydratedPromontoryPointPlayerState }

    let playersAndStates: PlayerAndState[] = $derived.by(() => {
        const byId = new Map<string, PlayerAndState>()
        for (const playerState of gameSession.gameState.players) {
            const player = gameSession.game.players.find(
                (candidate) => candidate.id === playerState.playerId
            )
            if (player) {
                byId.set(playerState.playerId, { player, playerState })
            }
        }

        const ordered = gameSession.gameState.turnManager.turnOrder.flatMap((playerId) => {
            const entry = byId.get(playerId)
            return entry ? [entry] : []
        })

        // Outside hotseat, rotate so the viewer's own seat is at the top.
        const myPlayerId = gameSession.myPlayer?.id
        if (myPlayerId && !gameSession.primaryGame.hotseat) {
            const index = ordered.findIndex((entry) => entry.player.id === myPlayerId)
            if (index > 0) {
                return [...ordered.slice(index), ...ordered.slice(0, index)]
            }
        }
        return ordered
    })
</script>

<div class="rounded-lg space-y-2 text-center grow-0 shrink-0">
    {#each playersAndStates as playerAndState (playerAndState.player.id)}
        <PlayerState player={playerAndState.player} playerState={playerAndState.playerState} />
    {/each}
</div>
