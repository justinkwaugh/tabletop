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
    onclick={onToggle}
>
    <span class="glyph">{glyph}</span>
    <span class="max-sm:hidden">{label}</span>
</button>

<style>
    .toggle {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 3px 10px 3px 6px;
        border-radius: 999px;
        background: var(--zertz-panel);
        box-shadow: inset 0 0 0 1px var(--zertz-panel-edge);
        color: var(--zertz-ink-quiet);
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    .glyph {
        padding: 1px 5px;
        border-radius: 6px;
        border: 1px solid currentColor;
        font-weight: 700;
        letter-spacing: 0;
    }

    .toggle[aria-pressed='true'] {
        color: var(--zertz-ink);
        box-shadow: inset 0 0 0 1px var(--zertz-place);
    }

    .toggle:hover {
        background: rgb(255 255 255 / 0.08);
    }
</style>
