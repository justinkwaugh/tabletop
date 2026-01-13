<script lang="ts">
import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import { GameResult } from '@tabletop/common'
    import Header from './Header.svelte'
    import Ship from './Ship.svelte'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'

    let gameSession = getGameSession() as SolGameSession
    let isWin = $derived(gameSession.gameState.result === GameResult.Win)

    const numbers: Map<number, string> = new Map<number, string>([
        [1, 'One'],
        [2, 'Two'],
        [3, 'Three'],
        [4, 'Four'],
        [5, 'Five']
    ])
    const number = $derived(numbers.get(gameSession.gameState.winningPlayerIds.length) ?? 'Unknown')
    const plural = $derived(gameSession.gameState.winningPlayerIds.length > 1 ? 'S' : '')
</script>

<div class="flex flex-col mb-2 sol-font-bold text-[#ad9c80] gap-y-2 uppercase">
    <Header />

    <div class="pt-2 pb-0 flex flex-row flex-wrap justify-center items-center gap-x-4">
        <h1 class="text-lg mb-2">
            {number} CIVILIZATION{plural}
            {plural ? 'HAVE' : 'HAS'} SURVIVED
        </h1>
    </div>

    <div class="pt-0 pb-2 flex flex-row justify-center items-center gap-x-4">
        {#each gameSession.gameState.winningPlayerIds as winnerId (winnerId)}
            <div class="shrink-0">
                <Ship playerId={winnerId} width={40} height={80} />
            </div>
        {/each}
    </div>
</div>
