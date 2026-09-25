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
        position: relative;
        border: 0;
        padding: 4px 14px;
        border-radius: 999px;
        background: transparent;
        color: var(--rail-muted, #7f8e9e);
        font: inherit;
        font-size: 12px;
        line-height: 16px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        cursor: pointer;
    }
    button:hover {
        color: var(--rail-text, #e3e9ef);
    }
    button[aria-pressed='true'] {
        color: #ffffff;
        font-weight: 600;
    }
    button:focus-visible {
        outline: 2px solid var(--rail-focus, #9e7752);
        outline-offset: 1px;
    }
</style>
