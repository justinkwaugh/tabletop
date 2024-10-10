<script lang="ts">
    import type { EstatesGameSession } from '$lib/model/EstatesGameSession.svelte'
    import { getContext } from 'svelte'

    let gameSession = getContext('gameSession') as EstatesGameSession
</script>

<div
    class="flex flex-col justify-center items-center rounded-lg p-2 fit-content text-gray-200 z-10 select-none w-[120px]"
>
    <div class="flex flex-row justify-center items-center text-lg text-nowrap">High Bid</div>
    <div class="flex flex-row justify-between items-center text-center">
        <h1 class="w-[50px] text-4xl leading-none">
            {gameSession.gameState.auction?.highBid ?? 0}
        </h1>
    </div>
</div>
