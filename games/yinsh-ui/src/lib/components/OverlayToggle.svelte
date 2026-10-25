<script lang="ts">
    let {
        glyph,
        label,
        pressed,
        onToggle
    }: { glyph: string; label: string; pressed: boolean; onToggle: () => void } = $props()
</script>

<button
    type="button"
    class="toggle"
    aria-pressed={pressed}
    title={pressed ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
    aria-label={label}
    onclick={onToggle}
>
    <span class="glyph">{glyph}</span>
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
        background: var(--yinsh-panel);
        box-shadow:
            inset 0 0 0 1px var(--yinsh-panel-edge),
            var(--yinsh-panel-shadow);
        color: var(--yinsh-ink-quiet);
        font-size: 11px;
    }

    .glyph {
        padding: 1px 5px;
        border-radius: 6px;
        border: 1px solid currentColor;
        font-weight: 700;
        letter-spacing: 0;
    }

    /* On, the glyph's outline turns black and thickens, padded in so the glyph keeps its size. */
    .toggle[aria-pressed='true'] {
        color: #000000;
    }

    .toggle[aria-pressed='true'] .glyph {
        border-width: 2px;
        padding: 0 4px;
    }

    .toggle:hover {
        background: var(--yinsh-panel-hover);
    }
</style>
