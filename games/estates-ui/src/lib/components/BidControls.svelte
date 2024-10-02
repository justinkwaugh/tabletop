<script lang="ts">
    import { getContext } from 'svelte'
    import { ActionType, MachineState } from '@tabletop/estates'
    import { HTML, OrbitControls } from '@threlte/extras'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import { Button } from 'flowbite-svelte'

    let gameSession = getContext('gameSession') as EstatesGameSession
    let bidValue = $state(gameSession.gameState.auction?.highBid ?? 0 + 1)

    function incrementBid() {
        bidValue = Math.min(bidValue + 1, gameSession.myPlayerState?.money ?? 0)
    }

    function decrementBid() {
        bidValue = Math.max(bidValue - 1, gameSession.gameState.auction?.highBid ?? 0 + 1)
    }

    async function placeBid() {
        await gameSession.placeBid(bidValue)
    }
</script>

{#if gameSession.gameState.machineState === MachineState.Auctioning}
    <HTML position={[1, 2.5, -7]} distanceFactor={3} transform>
        <div
            class="flex flex-col justify-center items-center rounded-lg p-2 gap-y-2 fit-content text-gray-200"
        >
            <div class="flex flex-row justify-center items-center text-xl">Your Bid</div>
            <div class="flex flex-row justify-between items-center text-center text-gray-200">
                <button
                    class="flex flex-col justify-center items-center rounded-full w-[35px] h-[35px]"
                    onclick={decrementBid}><h1 class="text-2xl">-</h1></button
                >
                <h1 class="w-[50px] text-4xl">${bidValue}</h1>
                <button
                    class="flex flex-col justify-center items-center rounded-full w-[35px] h-[35px]"
                    onclick={incrementBid}><h1 class="text-2xl">+</h1></button
                >
            </div>
        </div>
    </HTML>
{/if}
