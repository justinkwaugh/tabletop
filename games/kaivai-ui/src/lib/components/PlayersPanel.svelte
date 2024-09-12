<script lang="ts">
    import type { Player } from '@tabletop/common'
    import type { HydratedKaivaiPlayerState, KaivaiPlayerState } from '@tabletop/kaivai'
    import PlayerState from '$lib/components/PlayerState.svelte'
    import { getContext } from 'svelte'
    import type { KaivaiGameSession } from '$lib/model/KaivaiGameSession.svelte'
    import { flip } from 'svelte/animate'

    let gameSession = getContext('gameSession') as KaivaiGameSession

    type PlayerAndState = { player: Player; playerState: HydratedKaivaiPlayerState }

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

        const results = gameSession.gameState.turnManager.turnOrder.map(
            (playerId) => playersAndStatesById.get(playerId)!
        ) as PlayerAndState[]

        const active = results.filter(
            (result) => !gameSession.gameState.passedPlayers.includes(result.player.id)
        )
        const passed = results.filter((result) =>
            gameSession.gameState.passedPlayers.includes(result.player.id)
        )

        active.push(...passed)

        return active
    })
    function getPlayerForState(playerState: KaivaiPlayerState) {
        return gameSession.game.players.find((player) => player.id === playerState.playerId)
    }
</script>

<div class="rounded-lg space-y-2 text-center grow-0 shrink-0">
    {#each playersAndStates as playerAndState (playerAndState.player.id)}
        <div animate:flip={{ duration: 500 }}>
            <PlayerState player={playerAndState.player} playerState={playerAndState.playerState} />
        </div>
    {/each}
</div>
