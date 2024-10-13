<script lang="ts">
    import { getContext } from 'svelte'
    import { isBarrier, isCancelCube, isCube, isMayor, isRoof } from '@tabletop/estates'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import { MachineState } from '@tabletop/estates'

    import { PlayerName } from '@tabletop/frontend-components'
    import { fadeIn, fadeOut } from '$lib/utils/animations'

    let { hidden }: { hidden?: boolean } = $props()
    let gameSession = getContext('gameSession') as EstatesGameSession
    let activePlayerId: string | undefined = $derived.by(() => {
        if (gameSession.gameState.activePlayerIds.length === 1) {
            return gameSession.gameState.activePlayerIds[0]
        }
        return undefined
    })
    let ref: HTMLDivElement
    const instructions = $derived.by(() => {
        if (gameSession.gameState.machineState === MachineState.StartOfTurn) {
            return 'to start an auction'
        } else if (gameSession.gameState.machineState === MachineState.Auctioning) {
            return 'to bid'
        } else if (gameSession.gameState.machineState === MachineState.AuctionEnded) {
            return 'to decide about buying out the winner'
        } else if (gameSession.gameState.machineState === MachineState.PlacingPiece) {
            switch (true) {
                case isCube(gameSession.gameState.chosenPiece):
                    return 'to place their cube'
                case isMayor(gameSession.gameState.chosenPiece):
                    return 'to place the mayor'
                case isRoof(gameSession.gameState.chosenPiece):
                    return 'to place their roof'
                case isBarrier(gameSession.gameState.chosenPiece):
                    return 'to place their barrier'
                case isCancelCube(gameSession.gameState.chosenPiece):
                    return 'to remove a barrier'
                default:
                    return ''
            }
        }
    })

    $effect(() => {
        if (hidden) {
            fadeOut({ object: ref, duration: 0.2 })
        } else {
            fadeIn({ object: ref, duration: 0.2 })
        }
    })
</script>

<div
    bind:this={ref}
    class="py-2 px-4 bg-gray-900
             rounded-lg gap-y-2 text-center border-2 border-gray-700 opacity-0 text-center"
>
    <h1 class="text-lg text-gray-200">
        Waiting for <PlayerName playerId={activePlayerId} />
        {instructions}
    </h1>
</div>
