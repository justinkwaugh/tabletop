<script lang="ts">
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import { HTML, OrbitControls } from '@threlte/extras'
    import { MachineState } from '@tabletop/estates'
    import { getContext } from 'svelte'
    import { gsap } from 'gsap'

    let gameSession = getContext('gameSession') as EstatesGameSession
    let {
        position,
        ready,
        ...others
    }: {
        position: [number, number, number]
        ready: boolean
    } = $props()

    function fadeIn(div: HTMLDivElement) {
        gsap.to(div, { opacity: 1, duration: 0.5 })
    }
</script>

{#if ready && gameSession.gameState.machineState === MachineState.Auctioning}
    <HTML distanceFactor={5} {position} transform occlude={false} {...others}>
        <div
            use:fadeIn
            class="flex flex-col justify-center items-center rounded-lg p-2 gap-y-2 fit-content text-gray-200 z-10 select-none opacity-0"
        >
            <div class="flex flex-row justify-center items-center text-xl">High Bid</div>
            <div class="flex flex-row justify-between items-center text-center">
                <h1 class="w-[50px] text-4xl">{gameSession.gameState.auction?.highBid ?? 0}</h1>
            </div>
        </div>
    </HTML>
{/if}
