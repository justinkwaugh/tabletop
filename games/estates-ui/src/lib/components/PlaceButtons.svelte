<script lang="ts">
    import { getContext, onMount } from 'svelte'
    import { ActionType, isCube, isRoof, MachineState } from '@tabletop/estates'
    import { HTML, OrbitControls } from '@threlte/extras'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import { Button } from 'flowbite-svelte'
    import { gsap } from 'gsap'
    import { fade } from 'svelte/transition'

    let { position, ...others }: { position: [number, number, number] } = $props()
    let gameSession = getContext('gameSession') as EstatesGameSession

    async function discardPiece(event: any) {
        event.stopPropagation()
        await gameSession.discardPiece()
    }

    function fadeIn(div: HTMLDivElement) {
        gsap.to(div, { opacity: 1, duration: 0.5 })
    }
</script>

{#if gameSession.gameState.machineState === MachineState.PlacingPiece && !isCube(gameSession.gameState.chosenPiece) && !isRoof(gameSession.gameState.chosenPiece)}
    <HTML {position} distanceFactor={5} transform>
        <div use:fadeIn class="flex flex-row justify-center items-center gap-x-2 z-30 opacity-0">
            <Button onclick={(event: any) => discardPiece(event)} size="xs" color="light"
                >Discard</Button
            >
        </div>
    </HTML>
{/if}
