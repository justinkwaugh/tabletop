<script lang="ts">
    import type { Player } from '@tabletop/common'
    import { type HydratedLowenherzPlayerState, type LowenherzPlayerState } from '@tabletop/lowenherz'
    import { flip } from 'svelte/animate'
    import { cubicOut } from 'svelte/easing'
    import PlayerState from '$lib/components/PlayerState.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let gameSession = getGameSession()

    type PlayerAndState = { player: Player; playerState: HydratedLowenherzPlayerState }

    let playersAndStates: PlayerAndState[] = $derived.by(() => {
        const playersAndStates = gameSession.gameState.players.map((playerState) => {
            return {
                player: getPlayerForState(playerState),
                playerState
            }
        })

        const playersAndStatesById = new Map(
            playersAndStates.map((item) => [item.playerState.playerId, item])
        )
        // Löwenherz rotates its own firstPlayerId over a fixed turnOrder each round
        // (see resolutionHelpers.ts's advanceRound()) rather than reordering the
        // shared turnManager's turnOrder array - so this list has to be sorted
        // relative to firstPlayerId directly for the flip animation below to have
        // anything to animate.
        const rotated = [...gameSession.gameState.turnOrder]
        while (rotated[0] !== gameSession.gameState.firstPlayerId) {
            rotated.push(rotated.shift()!)
        }
        const turnOrderSorted = rotated.map((playerId) => playersAndStatesById.get(playerId)!) as PlayerAndState[]

        // if not hotseat, rotate until user player is at top
        if (gameSession.myPlayer && !gameSession.primaryGame.hotseat) {
            const myPlayerId = gameSession.myPlayer.id
            if (myPlayerId) {
                while (turnOrderSorted[0].player.id !== myPlayerId) {
                    turnOrderSorted.push(turnOrderSorted.shift()!)
                }
            }
        }

        return turnOrderSorted
    })
    function getPlayerForState(playerState: LowenherzPlayerState) {
        return gameSession.game.players.find((player) => player.id === playerState.playerId)
    }
</script>

<div class="rounded-lg space-y-2 text-center grow-0 shrink-0">
    {#each playersAndStates as playerAndState (playerAndState.player.id)}
        <div animate:flip={{ duration: 320, easing: cubicOut }}>
            <PlayerState player={playerAndState.player} playerState={playerAndState.playerState} />
        </div>
    {/each}
</div>
