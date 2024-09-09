<script lang="ts">
    import { getContext } from 'svelte'
    import type { KaivaiGameSession } from '$lib/model/KaivaiGameSession.svelte'
    import { MachineState } from '@tabletop/kaivai'
    import { GamesResponse } from '@tabletop/frontend-components'
    import PlayerName from './PlayerName.svelte'

    let gameSession = getContext('gameSession') as KaivaiGameSession

    const currentPlayerId = $derived(
        gameSession.gameState.activePlayerIds.length === 1
            ? gameSession.gameState.activePlayerIds[0]
            : undefined
    )

    const waitingText = $derived.by(() => {
        if (gameSession.gameState.machineState === MachineState.Bidding) {
            return 'to place their bid...'
        } else if (GamesResponse.gameState === MachineState.Building) {
            return 'to build another hut...'
        } else if (GamesResponse.gameState === MachineState.Delivering) {
            return 'to deliver more fish...'
        } else if (GamesResponse.gameState === MachineState.Fishing) {
            return 'to fish again...'
        } else if (GamesResponse.gameState === MachineState.InitialHuts) {
            return 'to place their initial huts...'
        } else if (GamesResponse.gameState === MachineState.MovingGod) {
            return 'to move the fisherman god...'
        }

        return 'to take their turn...'
    })
</script>

<div class="mb-2 p-2 text-center flex flex-row flex-wrap justify-center items-center">
    <div class="flex flex-col justify-center items-center mx-4">
        <h1 class="text-xl kaivai-font uppercase">
            Waiting for <PlayerName playerId={currentPlayerId} />
            {waitingText}
        </h1>
    </div>
</div>
