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
    /* A rock-pool pebble: pale sand that brightens under the pointer. */
    .choice {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        min-width: 52px;
        min-height: 52px;
        padding: 4px;
        border-radius: 14px 11px 15px 10px / 11px 15px 10px 14px;
        color: var(--reef-paper-ink);
        background: radial-gradient(ellipse 90% 80% at 40% 20%, #fffdf7, #efe6cf);
        box-shadow:
            inset 0 0 0 1.5px rgb(29 71 63 / 0.28),
            inset 0 -3px 0 rgb(150 125 80 / 0.22),
            0 2px 4px rgb(4 30 26 / 0.18);
        transition:
            transform 0.12s,
            box-shadow 0.12s;
    }

    .choice:hover {
        transform: translateY(-1px);
        box-shadow:
            inset 0 0 0 2px var(--reef-teal),
            inset 0 -3px 0 rgb(150 125 80 / 0.22),
            0 5px 8px -2px rgb(4 30 26 / 0.3);
    }

    .choice:active {
        transform: translateY(1px);
    }

    .choice.selected {
        box-shadow:
            inset 0 0 0 3px var(--reef-accent),
            0 0 0 3px rgb(239 143 46 / 0.25);
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
        .choice {
            min-width: 44px;
            min-height: 44px;
            padding: 2px;
        }
    }
</style>
