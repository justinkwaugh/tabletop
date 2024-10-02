<script lang="ts">
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import { HTML, OrbitControls } from '@threlte/extras'
    import { MachineState } from '@tabletop/estates'
    import { getContext } from 'svelte'

    let gameSession = getContext('gameSession') as EstatesGameSession
    function thing() {
        console.log('thing')
    }
</script>

{#if gameSession.gameState.machineState === MachineState.Auctioning}
    <HTML
        distanceFactor={3}
        onvisibilitychange={thing}
        position={[-0.9, 2.5, -7]}
        transform
        occlude={false}
    >
        <div
            class="flex flex-col justify-center items-center rounded-lg p-2 gap-y-2 fit-content text-gray-200"
        >
            <div class="flex flex-row justify-center items-center text-xl">High Bid</div>
            <div class="flex flex-row justify-between items-center text-center">
                <h1 class="w-[50px] text-4xl">{gameSession.gameState.auction?.highBid ?? 0}</h1>
            </div>
        </div>
    </HTML>
{/if}
