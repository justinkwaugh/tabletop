<script lang="ts">
    import { QueueEnd } from '@tabletop/marracash'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
</script>

<div class="flex flex-col items-center gap-2">
    <p class="font-semibold">
        Bring new visitors to the empty entrance{gameSession.gameState.emptyEntranceIds().length > 1
            ? 's'
            : ''}.
    </p>
    <div class="flex flex-wrap items-center justify-center gap-2">
        <span class="text-sm">Take from the</span>
        {#each Object.values(QueueEnd) as end (end)}
            <button
                class="rounded-md border border-[#8a6a46] px-3 py-1 text-sm"
                class:bg-[#8a6a46]={gameSession.chosenQueueEnd === end}
                class:text-white={gameSession.chosenQueueEnd === end}
                onclick={() => gameSession.chooseQueueEnd(end)}
                >{end === QueueEnd.Front ? 'Front' : 'Back'} of queue</button
            >
        {/each}
        {#if gameSession.chosenQueueEnd !== undefined && gameSession.visitorCountOptions.length > 1}
            <span class="ml-2 text-sm">How many?</span>
            {#each gameSession.visitorCountOptions as count (count)}
                <button
                    class="w-9 rounded-md border border-[#8a6a46] py-1 text-sm"
                    class:bg-[#8a6a46]={gameSession.chosenVisitorCount === count}
                    class:text-white={gameSession.chosenVisitorCount === count}
                    onclick={() => gameSession.chooseVisitorCount(count)}>{count}</button
                >
            {/each}
        {/if}
        {#if gameSession.hasManualSelection}
            <button
                class="ml-2 rounded-md border border-[#8a6a46] px-3 py-1 text-sm"
                onclick={() => gameSession.back()}>Back</button
            >
        {/if}
    </div>
    {#if gameSession.chosenVisitorCount !== undefined}
        <p class="text-sm">Choose a highlighted entrance to place them.</p>
    {/if}
</div>
