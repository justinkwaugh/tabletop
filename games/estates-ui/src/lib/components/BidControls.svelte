<script lang="ts">
    import { getContext } from 'svelte'
    import { MachineState } from '@tabletop/estates'
    import { HTML } from '@threlte/extras'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import { Button } from 'flowbite-svelte'
    import { gsap } from 'gsap'

    let { position, ready, ...others }: { position: [number, number, number]; ready: boolean } =
        $props()
    let gameSession = getContext('gameSession') as EstatesGameSession

    let bidValue = $state(gameSession.gameState.auction?.highBid ?? 0 + 1)

    function incrementBid() {
        bidValue = Math.min(bidValue + 1, gameSession.myPlayerState?.money ?? 0)
    }

    function decrementBid() {
        bidValue = Math.max(bidValue - 1, gameSession.gameState.auction?.highBid ?? 0 + 1)
    }

    function fadeIn(div: HTMLDivElement) {
        gsap.to(div, { opacity: 1, duration: 0.5 })
    }
</script>

{#if ready && gameSession.gameState.machineState === MachineState.Auctioning}
    <HTML {position} distanceFactor={5} transform>
        <div
            use:fadeIn
            class="flex flex-col justify-center items-center rounded-lg p-2 gap-y-2 fit-content text-gray-200 select-none opacity-0"
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
