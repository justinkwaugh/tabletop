<script lang="ts">
    import SlidingToggle from './SlidingToggle.svelte'
    let {
        options
    }: {
        options: readonly { label: string; selected: boolean; onSelect: () => void }[]
    } = $props()
</script>

<div class="board-focus" role="group" aria-label="Board focus">
    <SlidingToggle
        count={options.length}
        selectedIndex={options.findIndex((option) => option.selected)}
    >
        {#each options as option (option.label)}<button
                aria-pressed={option.selected}
                onclick={option.onSelect}><span>{option.label}</span></button
            >{/each}
    </SlidingToggle>
</div>

<style>
    button {
        padding: 4px 14px;
        font-size: 12px;
        line-height: 16px;
    }
    button:focus-visible {
        outline: 2px solid var(--rail-focus, #9e7752);
        outline-offset: 1px;
    }
</style>
