<script lang="ts">
    import type { Snippet } from 'svelte'

    type Rung = { label: string; value: string }

    let {
        rungs,
        label,
        valueClass = 'aid-figure'
    }: { rungs: Rung[]; label?: Snippet; valueClass?: string } = $props()
</script>

<div
    class="grid rounded-md bg-[#6b4f30]/10 px-1 py-1.5 text-center"
    style:grid-template-columns="repeat({rungs.length}, 1fr)"
>
    {#each rungs as rung (rung.label)}
        <div class="mb-1 text-[10.5px] whitespace-nowrap text-[#6b5640]">
            {rung.label}{#if label}{' '}{@render label()}{/if}
        </div>
    {/each}
    {#each rungs as rung (rung.label)}
        <div class={valueClass}>{rung.value}</div>
    {/each}
</div>
