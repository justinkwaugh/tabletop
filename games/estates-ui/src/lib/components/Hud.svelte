<script lang="ts">
    import '$lib/styles/hud.css'
    import { useViewport, HTML } from '@threlte/extras'
    import AuctionPreview from './AuctionPreview.svelte'
    import HighBid from './HighBid.svelte'
    import BidControls from './BidControls.svelte'
    import BidButtons from './BidButtons.svelte'
    import { MachineState } from '@tabletop/estates'
    import Instructions from './Instructions.svelte'
    import WaitingInstructions from './WaitingInstructions.svelte'
    import GameEndPanel from './GameEndPanel.svelte'
    import Offer from './Offer.svelte'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'

    let gameSession = getGameSession()

    const viewport = useViewport()

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

{#if gameSession.gameState.machineState === MachineState.Auctioning && gameSession.isPlayable}
    <HTML position.y={$viewport.height / 2 - 0.6} center>
        <div
            class:hud-hidden={gameSession.shouldHideHud}
            class="flex flex-col justify-start items-center gap-y-4 hud-fade"
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

{#if gameSession.isMyTurn && gameSession.isPlayable}
    {#if gameSession.gameState.machineState !== MachineState.Auctioning}
        <HTML position.y={instructionY} center>
            <Instructions hidden={gameSession.shouldHideHud} />
        </HTML>
    {/if}
{:else if gameSession.gameState.result}
    <HTML position.y={$viewport.height / 2 - 1} distanceFactor={5} center transform>
        <GameEndPanel hidden={gameSession.shouldHideHud} />
    </HTML>
{:else if gameSession.isPlayable}
    <HTML position.y={instructionY} distanceFactor={5} center transform>
        <WaitingInstructions hidden={gameSession.shouldHideHud} />
    </HTML>
{/if}

<AuctionPreview hidden={gameSession.shouldHideHud} position={[0, $viewport.height / 2 - 0.6, 0]} />

{#if gameSession.mobileView}
    <HTML position={[0, -$viewport.height / 2 + 0.6, 0]} center={true}
        ><Offer hidden={gameSession.shouldHideHud} /></HTML
    >
{/if}
