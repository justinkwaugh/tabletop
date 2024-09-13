<script lang="ts">
    import { getContext } from 'svelte'
    import type { KaivaiGameSession } from '$lib/model/KaivaiGameSession.svelte'
    import { MachineState } from '@tabletop/kaivai'
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
        } else if (gameSession.gameState.machineState === MachineState.Building) {
            return 'to build another hut...'
        } else if (gameSession.gameState.machineState === MachineState.Delivering) {
            return 'to deliver more fish...'
        } else if (gameSession.gameState.machineState === MachineState.Fishing) {
            return 'to fish again...'
        } else if (gameSession.gameState.machineState === MachineState.InitialHuts) {
            return 'to place their initial huts...'
        } else if (gameSession.gameState.machineState === MachineState.MovingGod) {
            return 'to move the fisherman god...'
        } else if (gameSession.gameState.machineState === MachineState.FinalScoring) {
            return 'to choose an island to score...'
        }

        return 'to choose an action...'
    })

    let isScoring = $derived.by(() => {
        return gameSession.gameState.machineState === MachineState.IslandBidding
    })
</script>

<div class="mb-2 p-2 text-center flex flex-row flex-wrap justify-center items-center">
    <div class="flex flex-col justify-center items-center mx-4">
        {#if isScoring}
            <h1 class="text-lg md:text-xl kaivai-font uppercase">
                Collecting other players' bids...
            </h1>
            <div class="flex flex-row justify-center items-center">
                {#each gameSession.gameState.activePlayerIds as playerId}
                    <div class="flex flex-col justify-center items-center mx-2">
                        <h1 class="text-lg">
                            <PlayerName {playerId} />
                        </h1>
                    </div>
                {/each}
            </div>
        {:else}
            <h1 class="text-lg md:text-xl kaivai-font uppercase">
                Waiting for <PlayerName playerId={currentPlayerId} />
                {waitingText}
            </h1>
        {/if}
    </div>
</div>
