<script lang="ts">
    import type { Snippet } from 'svelte'

    let {
        label,
        selected = false,
        tile = false,
        onclick,
        children
    }: {
        label: string
        selected?: boolean
        // The content is a component tile that is itself the button, with no pebble around it.
        tile?: boolean
        onclick: () => void
        children: Snippet
    } = $props()
</script>

<button
    type="button"
    class="choice"
    class:tile
    class:selected
    aria-label={label}
    aria-pressed={selected}
    {onclick}
>
    {@render children()}
</button>

<style>
    /* A pearly button, lit along its top. */
    .choice {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        min-width: 52px;
        min-height: 52px;
        padding: 4px;
        border-radius: 18px;
        color: var(--reef-paper-ink);
        background: linear-gradient(180deg, #fff, rgb(255 255 255 / 0) 70%), var(--reef-pearl);
        box-shadow:
            inset 0 0 0 1px rgb(255 255 255 / 0.9),
            0 2px 6px rgb(4 30 26 / 0.18);
        transition:
            transform 0.12s,
            box-shadow 0.12s;
    }

    .choice:hover {
        transform: translateY(-1px);
        box-shadow:
            inset 0 0 0 1.5px var(--reef-teal),
            0 5px 10px -3px rgb(4 30 26 / 0.3);
    }

    .choice:active {
        transform: translateY(1px);
    }

    .choice.selected {
        box-shadow:
            inset 0 0 0 3px var(--reef-accent),
            0 0 0 3px rgb(239 143 46 / 0.25);
    }

    .choice.tile {
        min-width: 0;
        min-height: 0;
        padding: 0;
        border-radius: 4px;
        background: none;
        overflow: hidden;
        box-shadow:
            0 0 0 1px rgb(0 0 0 / 0.3),
            0 2px 4px rgb(4 30 26 / 0.25);
    }

    .choice.tile:hover {
        box-shadow:
            0 0 0 2px var(--reef-teal),
            0 5px 8px -2px rgb(4 30 26 / 0.35);
    }

    .choice:focus-visible {
        outline: 2px solid var(--reef-accent);
        outline-offset: 2px;
    }

    @media (prefers-reduced-motion: reduce) {
        .choice,
        .choice:hover,
        .choice:active {
            transform: none;
            transition: none;
        }
    }

    @media (max-width: 639px) {
        .choice:not(.tile) {
            min-width: 44px;
            min-height: 44px;
            padding: 2px;
        }
    }
</style>
