<script lang="ts">
    import { Fish } from '@tabletop/kaivai'
    let { action }: { action: Fish } = $props()

    const dieCircleSize = [
        'w-[24px] h-[24px]',
        'w-[21px] h-[21px]',
        'w-[18px] h-[18px]',
        'w-[15px] h-[15px]'
    ]
</script>

{#if action.metadata?.dieResults && action.metadata?.dieResults.length > 0}
    <div class="flex flex-row justify-start items-center space-x-2 w-full mt-2">
        <div>Die results:</div>
        {#each action.metadata?.dieResults as result, i}
            <div class="flex justify-center items-center w-[30px] h-[30px] rounded-lg bg-gray-200">
                {#if result}
                    <div class="{dieCircleSize[i]} rounded-full bg-blue-500"></div>
                {/if}
            </div>
        {/each}
    </div>
{/if}
