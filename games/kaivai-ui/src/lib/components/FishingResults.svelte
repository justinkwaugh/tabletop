<script lang="ts">
    import { Fish } from '@tabletop/kaivai'
    import { getContext } from 'svelte'
    import type { KaivaiGameSession } from '$lib/model/KaivaiGameSession.svelte'

    let gameSession = getContext('gameSession') as KaivaiGameSession
    let { action, justify = 'center' }: { action: Fish; justify: 'center' | 'left' } = $props()

    const dieCircleSize = [
        'w-[24px] h-[24px]',
        'w-[21px] h-[21px]',
        'w-[18px] h-[18px]',
        'w-[15px] h-[15px]'
    ]

    const EVS = ['.83', '1.5', '2', '2.33']
    const ev = $derived(
        gameSession.game.config.lessluckFishing
            ? ` (EV ${EVS[(action.metadata?.dieResults.length ?? 1) - 1]})`
            : ''
    )

    let justifyClass = justify === 'center' ? 'justify-center' : 'justify-start'
</script>

{#if action.metadata?.dieResults && action.metadata?.dieResults.length > 0}
    <div class="flex flex-row {justifyClass} items-center space-x-2 w-full mt-2">
        <div>Die results{ev}:</div>
        {#each action.metadata?.dieResults as result, i}
            <div
                class="flex justify-center items-center w-[30px] h-[30px] border border-gray-400 rounded-lg bg-gray-200"
            >
                {#if result}
                    <div class="{dieCircleSize[i]} rounded-full bg-blue-500"></div>
                {/if}
            </div>
        {/each}
    </div>
{/if}
