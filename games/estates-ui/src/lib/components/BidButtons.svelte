<script lang="ts">
    import { getContext, onMount } from 'svelte'
    import { ActionType, MachineState } from '@tabletop/estates'
    import { HTML, OrbitControls } from '@threlte/extras'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import { Button } from 'flowbite-svelte'
    import { gsap } from 'gsap'

    let { position, ready, ...others }: { position: [number, number, number]; ready: boolean } =
        $props()
    let gameSession = getContext('gameSession') as EstatesGameSession

    let bidValue = $state(gameSession.gameState.auction?.highBid ?? 0 + 1)

    async function pass(event: any) {
        event.stopPropagation()
        await gameSession.placeBid(0)
    }

    async function placeBid(event: any) {
        event.stopPropagation()
        await gameSession.placeBid(bidValue)
    }

    function fadeIn(div: HTMLDivElement) {
        gsap.to(div, { opacity: 1, duration: 0.5 })
    }
</script>

{#if ready && gameSession.gameState.machineState === MachineState.Auctioning}
    <HTML {position} distanceFactor={5} transform>
        <div use:fadeIn class="flex flex-row justify-center items-center gap-x-2 z-30 opacity-0">
            <Button onclick={(event: any) => pass(event)} size="xs" color="light">Pass</Button>
            <Button onclick={(event: any) => placeBid(event)} size="xs">Bid</Button>
        </div>
    </HTML>
{/if}
