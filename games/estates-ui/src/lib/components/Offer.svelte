<script lang="ts">
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import { Cube } from '@tabletop/estates'

    import { getContext } from 'svelte'

    let gameSession = getContext('gameSession') as EstatesGameSession
</script>

<div class="p-2 flex justify-center">
    <div class="flex flex-col justify-center items-center gap-y-1">
        {#each gameSession.gameState.cubes as row}
            <div class="flex items-center gap-x-1">
                {#each row as cube}
                    <div
                        class="flex justify-center items-center text-[#DDDDDD] w-8 h-8 font-bold text-2xl {gameSession.getBgColor(
                            gameSession.getCompanyColor(cube.company)
                        )}"
                    >
                        {cube.value}
                    </div>
                {/each}
            </div>
        {/each}
    </div>
</div>
