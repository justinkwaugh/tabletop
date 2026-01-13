<script lang="ts">
import { isCube, isRoof, MachineState } from '@tabletop/estates'
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import { Button } from 'flowbite-svelte'
    import { fade } from 'svelte/transition'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'

    let { position, ...others }: { position?: [number, number, number] } = $props()
    let gameSession = getGameSession() as EstatesGameSession

    async function discardPiece(event: any) {
        event.stopPropagation()
        await gameSession.discardPiece()
    }
</script>

{#if gameSession.gameState.machineState === MachineState.PlacingPiece && !isCube(gameSession.gameState.chosenPiece) && !isRoof(gameSession.gameState.chosenPiece)}
    <div
        transition:fade={{ duration: 200 }}
        class="flex flex-row justify-center items-center gap-x-2 z-30"
    >
        <Button onclick={(event: any) => discardPiece(event)} size="xs" color="light"
            >Discard Instead</Button
        >
    </div>
{/if}
