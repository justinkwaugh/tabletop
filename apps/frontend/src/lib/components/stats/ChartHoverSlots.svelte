<svelte:options namespace="svg" />

<script lang="ts">
    let {
        slotXs,
        width,
        height,
        onhover
    }: { slotXs: number[]; width: number; height: number; onhover: (index: number) => void } =
        $props()
</script>

{#each slotXs as x, index (index)}
    <rect
        class="slot"
        role="presentation"
        {x}
        y="0"
        {width}
        {height}
        onpointerenter={() => onhover(index)}
    ></rect>
{/each}

<style>
    .slot {
        fill: transparent;
    }
</style>
