<script lang="ts">
    import { useViewport, HTML } from '@threlte/extras'
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
    import Offer from './Offer.svelte'
    import { gsap } from 'gsap'

    let { hidden = $bindable() }: { hidden?: boolean } = $props()
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
    function fadeIn(element: HTMLElement) {
        gsap.to(element, { opacity: 1, duration: 0.5 })
    }

    function fadeOut(element: HTMLElement) {
        gsap.to(element, { opacity: 0, duration: 0.5 })
    }
</script>

{#if ready && gameSession.gameState.machineState === MachineState.Auctioning}
    <HTML position.y={$viewport.height / 2 - 0.6} center>
        <div
            use:fadeIn
            class="flex flex-col justify-start items-center gap-y-4 opacity-0 {hidden
                ? 'hidden'
                : ''}"
        >
            <div class="w-[340px] flex flex-row justify-between items-center">
                <HighBid />

                {#if gameSession.isMyTurn}
                    <BidControls />
                {/if}
            </div>
        </div>
    </HTML>
    <HTML position.y={$viewport.height / 2 - 1.4} center>
        {#if gameSession.isMyTurn && !gameSession.shouldHideHud}
            <BidButtons />
        {/if}
    </HTML>
{/if}

{#if !gameSession.shouldHideHud}
    {#if gameSession.isMyTurn}
        {#if gameSession.gameState.machineState !== MachineState.Auctioning}
            <HTML position.y={instructionY} center>
                <Instructions />
            </HTML>
        {/if}
    {:else if gameSession.gameState.result}
        <HTML position.y={$viewport.height / 2 - 1} distanceFactor={5} center transform>
            <GameEndPanel />
        </HTML>
    {:else}
        <HTML position.y={instructionY} distanceFactor={5} center transform>
            <WaitingInstructions />
        </HTML>
    {/if}
{/if}

<AuctionPreview
    flyDone={onFlyDone}
    hidden={gameSession.shouldHideHud}
    position={[0, $viewport.height / 2 - 0.6, 0]}
/>

{#if gameSession.mobileView && !gameSession.shouldHideHud}
    <HTML position={[0, -$viewport.height / 2 + 0.6, 0]} center={true}><Offer /></HTML>
{/if}
