<script lang="ts">
    import { getContext } from 'svelte'
    import { isBarrier, isCancelCube, isCube, isMayor, isRoof } from '@tabletop/estates'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import { MachineState } from '@tabletop/estates'

    import TurnButtons from './TurnButtons.svelte'
    import PlaceButtons from './PlaceButtons.svelte'
    import BuyOutButtons from './BuyOutButtons.svelte'
    import { fadeIn, fadeOut } from '$lib/utils/animations'

    let { hidden }: { hidden?: boolean } = $props()
    let gameSession = getContext('gameSession') as EstatesGameSession
    let ref: HTMLDivElement
    const instructions = $derived.by(() => {
        if (gameSession.gameState.machineState === MachineState.StartOfTurn) {
            return 'Choose a piece to auction'
        } else if (gameSession.gameState.machineState === MachineState.AuctionEnded) {
            return `Buy out the winner for $${gameSession.gameState.auction?.highBid ?? 0}?`
        } else if (gameSession.gameState.machineState === MachineState.PlacingPiece) {
            switch (true) {
                case isCube(gameSession.gameState.chosenPiece):
                    return 'Place your cube on the board'
                case isMayor(gameSession.gameState.chosenPiece):
                    return 'Place the mayor'
                case isRoof(gameSession.gameState.chosenPiece):
                    return 'Place your roof on the board'
                case isBarrier(gameSession.gameState.chosenPiece):
                    return 'Place your barrier on the board'
                case isCancelCube(gameSession.gameState.chosenPiece):
                    return 'Choose a barrier to remove'
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
    class="py-2 px-8 rounded-lg flex flex-col justify-center items-center gap-y-2 text-center text-nowrap bg-gray-900 border-2 border-gray-700 opacity-0"
>
    <h1 class="text-lg text-gray-200">{instructions}</h1>
    {#if gameSession.gameState.machineState === MachineState.StartOfTurn}
        <TurnButtons />
    {/if}
    {#if gameSession.gameState.machineState === MachineState.PlacingPiece}
        <PlaceButtons />
    {/if}
    {#if gameSession.gameState.machineState === MachineState.AuctionEnded}
        <BuyOutButtons />
    {/if}
</div>
