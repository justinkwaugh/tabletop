<script lang="ts">
    import type { Snippet } from 'svelte'

    let {
        label,
        pressed,
        onToggle,
        children
    }: { label: string; pressed: boolean; onToggle: () => void; children: Snippet } = $props()
</script>

<button
    type="button"
    class="toggle"
    aria-pressed={pressed}
    title={pressed ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
    aria-label={label}
    onclick={onToggle}
>
    <span class="glyph">{@render children()}</span>
</button>

<style>
    .toggle {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 30px;
        min-width: 30px;
        padding: 3px 4px;
        border-radius: 999px;
        background: var(--punct-panel);
        box-shadow:
            inset 0 0 0 1px var(--punct-panel-edge),
            var(--punct-panel-shadow);
        color: var(--punct-ink-quiet);
        font-size: 11px;
    }

    .glyph {
        display: flex;
        align-items: center;
        min-height: 17px;
        padding: 1px 5px;
        border-radius: 6px;
        border: 1px solid currentColor;
        font-weight: 700;
        letter-spacing: 0;
    }

    .glyph :global(ellipse) {
        fill: none;
        stroke: currentColor;
        stroke-width: 1.4;
    }

    /* On, the glyph fills in dark; off, it is a faint outline. */
    .toggle[aria-pressed='true'] {
        color: var(--punct-ink);
    }

    .toggle[aria-pressed='true'] .glyph {
        background: var(--punct-ink);
        border-color: var(--punct-ink);
        color: var(--punct-panel);
    }

    .toggle[aria-pressed='false'] .glyph {
        opacity: 0.6;
    }

    .toggle:hover {
        background: var(--punct-panel-hover);
    }
</style>
