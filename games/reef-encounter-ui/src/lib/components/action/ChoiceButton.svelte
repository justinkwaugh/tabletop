<script lang="ts">
    import type { Snippet } from 'svelte'

    let {
        label,
        selected = false,
        onclick,
        children
    }: { label: string; selected?: boolean; onclick: () => void; children: Snippet } = $props()
</script>

<button
    type="button"
    class="choice"
    class:selected
    aria-label={label}
    aria-pressed={selected}
    {onclick}
>
    {@render children()}
</button>

<style>
    .choice {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        min-width: 52px;
        min-height: 52px;
        padding: 4px;
        border-radius: 8px;
        background: rgb(255 255 255 / 0.08);
        box-shadow: inset 0 0 0 2px rgb(255 255 255 / 0.45);
    }

    .choice:hover {
        background: rgb(255 255 255 / 0.18);
        box-shadow: inset 0 0 0 2px var(--reef-line);
    }

    .choice.selected {
        box-shadow: inset 0 0 0 3px var(--reef-accent);
    }

    .choice:focus-visible {
        outline: 2px solid var(--reef-accent);
        outline-offset: 2px;
    }
</style>
