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
        background: var(--zertz-panel);
        box-shadow:
            inset 0 0 0 1px var(--zertz-panel-edge),
            var(--zertz-panel-shadow);
        color: var(--zertz-ink-quiet);
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

    /* On, the lines brighten and a thin ring shows round the button, quieter than a solid fill. */
    .toggle[aria-pressed='true'] {
        color: var(--zertz-ink);
        box-shadow:
            inset 0 0 0 1.5px var(--zertz-toggle-on),
            var(--zertz-panel-shadow);
    }

    .toggle:hover {
        background: rgb(255 255 255 / 0.08);
    }
</style>
