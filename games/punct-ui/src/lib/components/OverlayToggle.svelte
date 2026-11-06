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

    .glyph :global(.badge-ring) {
        fill: none;
        stroke: currentColor;
        stroke-width: 1.3;
    }

    .glyph :global(text) {
        fill: currentColor;
    }

    .glyph :global(.turn-arrow) {
        fill: none;
        stroke: currentColor;
        stroke-width: 1.5;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    /* On, the lines darken and a thin ring shows round the button, quieter than a solid fill. */
    .toggle[aria-pressed='true'] {
        color: var(--punct-ink);
        box-shadow:
            inset 0 0 0 1.5px var(--punct-toggle-on),
            var(--punct-panel-shadow);
    }

    .toggle:hover {
        background: var(--punct-panel-hover);
    }
</style>
