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
        background: var(--lyngk-card);
        box-shadow:
            inset 0 0 0 1px var(--lyngk-card-rule),
            0 1px 3px rgb(60 45 25 / 0.2);
        color: var(--lyngk-card-quiet);
        font-size: 11px;
    }

    .glyph {
        padding: 1px 5px;
        border-radius: 6px;
        border: 1px solid currentColor;
        font-weight: 700;
        letter-spacing: 0;
    }

    .toggle[aria-pressed='true'] {
        color: var(--lyngk-card-ink);
        box-shadow:
            inset 0 0 0 1.5px var(--lyngk-link),
            0 1px 3px rgb(60 45 25 / 0.2);
    }

    .toggle:hover {
        background: #ffffff;
    }
</style>
