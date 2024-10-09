<script lang="ts">
    import { useViewport } from '@threlte/extras'
    import AuctionPreview from './AuctionPreview.svelte'
    import HighBid from './HighBid.svelte'
    import BidControls from './BidControls.svelte'
    import BidButtons from './BidButtons.svelte'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import { getContext } from 'svelte'
    import { MachineState } from '@tabletop/estates'
    import Instructions from './Instructions.svelte'
    import WaitingInstructions from './WaitingInstructions.svelte'
    import GameEndPanel from './GameEndPanel.svelte'

    let gameSession = getContext('gameSession') as EstatesGameSession

    const viewport = useViewport()
    let ready = $state(false)

    function onFlyDone() {
        ready = true
    }

    let instructionY = $derived.by(() => {
        if (
            gameSession.gameState.machineState === MachineState.Auctioning ||
            gameSession.gameState.machineState === MachineState.AuctionEnded ||
            gameSession.gameState.machineState === MachineState.PlacingPiece
        ) {
            return $viewport.height / 2 - 1.6
        } else {
            return $viewport.height / 2 - 0.6
        }
    })
</script>

{#if gameSession.gameState.machineState === MachineState.Auctioning}
    <HighBid {ready} position={[-1.5, $viewport.height / 2 - 0.6, 0]} />
{/if}

<AuctionPreview flyDone={onFlyDone} position={[0, $viewport.height / 2 - 0.6, 0]} />

{#if gameSession.isMyTurn}
    <Instructions position={[0, instructionY, 0]} />
    {#if gameSession.gameState.machineState === MachineState.Auctioning}
        <BidControls {ready} position={[1.5, $viewport.height / 2 - 0.6, 0]} />
        <BidButtons {ready} position={[0, $viewport.height / 2 - 1.6, 0]} />
    {/if}
{:else if gameSession.gameState.result}
    <GameEndPanel position={[0, $viewport.height / 2 - 1, 0]} />
{:else}
    <WaitingInstructions position={[0, instructionY, 0]} />
{/if}
