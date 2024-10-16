<script lang="ts">
    import { useViewport, HTML } from '@threlte/extras'
    import AuctionPreview from './AuctionPreview.svelte'
    import HighBid from './HighBid.svelte'
    import BidControls from './BidControls.svelte'
    import BidButtons from './BidButtons.svelte'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import { getContext, onMount } from 'svelte'
    import { EstatesGameState, MachineState } from '@tabletop/estates'
    import Instructions from './Instructions.svelte'
    import WaitingInstructions from './WaitingInstructions.svelte'
    import GameEndPanel from './GameEndPanel.svelte'
    import Offer from './Offer.svelte'
    import { fadeIn, fadeOut } from '$lib/utils/animations'
    import { GameSessionMode } from '@tabletop/frontend-components'

    let gameSession = getContext('gameSession') as EstatesGameSession

    const viewport = useViewport()
    let ready = $state(false)
    let auctionControls: HTMLDivElement

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
    function onAdd(element: HTMLElement) {
        element.style.opacity = '0'
        fadeIn({ object: element, duration: 0.3 })
    }

    async function onGameStateChange({
        to,
        from
    }: {
        to: EstatesGameState
        from?: EstatesGameState
    }) {
        if (
            to.machineState === MachineState.Auctioning &&
            (!from || from.machineState === MachineState.StartOfTurn)
        ) {
            ready = false
        }
    }

    onMount(() => {
        gameSession.addGameStateChangeListener(onGameStateChange)
        return () => {
            gameSession.removeGameStateChangeListener(onGameStateChange)
        }
    })

    $effect(() => {
        if (gameSession.shouldHideHud) {
            fadeOut({ object: auctionControls, duration: 0.2 })
        } else {
            fadeIn({ object: auctionControls, duration: 0.2 })
        }
    })
</script>

{#if ready && gameSession.gameState.machineState === MachineState.Auctioning && gameSession.mode === GameSessionMode.Play}
    <HTML position.y={$viewport.height / 2 - 0.6} center>
        <div
            bind:this={auctionControls}
            use:onAdd
            class="flex flex-col justify-start items-center gap-y-4"
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
        {#if gameSession.isMyTurn}
            <BidButtons hidden={gameSession.shouldHideHud} />
        {/if}
    </HTML>
{/if}

{#if gameSession.isMyTurn && gameSession.mode === GameSessionMode.Play}
    {#if gameSession.gameState.machineState !== MachineState.Auctioning}
        <HTML position.y={instructionY} center>
            <Instructions hidden={gameSession.shouldHideHud} />
        </HTML>
    {/if}
{:else if gameSession.gameState.result}
    <HTML position.y={$viewport.height / 2 - 1} distanceFactor={5} center transform>
        <GameEndPanel hidden={gameSession.shouldHideHud} />
    </HTML>
{:else if gameSession.mode === GameSessionMode.Play}
    <HTML position.y={instructionY} distanceFactor={5} center transform>
        <WaitingInstructions hidden={gameSession.shouldHideHud} />
    </HTML>
{/if}

<AuctionPreview
    flyDone={onFlyDone}
    hidden={gameSession.shouldHideHud}
    position={[0, $viewport.height / 2 - 0.6, 0]}
/>

{#if gameSession.mobileView}
    <HTML position={[0, -$viewport.height / 2 + 0.6, 0]} center={true}
        ><Offer hidden={gameSession.shouldHideHud} /></HTML
    >
{/if}
