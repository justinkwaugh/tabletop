<script lang="ts">
    import { getContext } from 'svelte'
    import { isBarrier, isCancelCube, isCube, isMayor, isRoof } from '@tabletop/estates'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import { MachineState } from '@tabletop/estates'

    import { fade } from 'svelte/transition'
    import { HTML } from '@threlte/extras'

    import { PlayerName } from '@tabletop/frontend-components'

    let { position, ...others }: { position: [number, number, number] } = $props()
    let gameSession = getContext('gameSession') as EstatesGameSession
    let activePlayerId: string | undefined = $derived.by(() => {
        if (gameSession.gameState.activePlayerIds.length === 1) {
            return gameSession.gameState.activePlayerIds[0]
        }
        return undefined
    })
    const instructions = $derived.by(() => {
        if (gameSession.gameState.machineState === MachineState.StartOfTurn) {
            return 'to choose a piece to auction'
        } else if (gameSession.gameState.machineState === MachineState.Auctioning) {
            return 'to place a bid'
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
</script>

<HTML {position} {...others} distanceFactor={5} transform>
    <div
        transition:fade={{ duration: 300 }}
        class="py-2 px-8 bg-transparent rounded-lg flex flex-col justify-center items-center gap-y-2 text-center"
    >
        <h1 class="text-lg text-gray-200">
            Waiting for <PlayerName playerId={activePlayerId} />
            {instructions}
        </h1>
    </div>
</HTML>
