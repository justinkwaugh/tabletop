<script lang="ts">
    import type { Snippet } from 'svelte'

    // A text glyph, or an icon drawn by the caller. The hint, shown on hover, says what a press
    // does now.
    let {
        glyph,
        label,
        hint,
        pressed,
        onToggle,
        children
    }: {
        glyph?: string
        label: string
        hint: string
        pressed: boolean
        onToggle: () => void
        children?: Snippet
    } = $props()
</script>

<button
    type="button"
    class="toggle"
    aria-pressed={pressed}
    title={hint}
    aria-label={label}
    onclick={onToggle}
>
    <span class="glyph"
        >{#if children}{@render children()}{:else}{glyph}{/if}</span
    >
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

    .glyph :global(.line) {
        fill: none;
        stroke: currentColor;
        stroke-width: 1.5;
        stroke-linecap: round;
        stroke-linejoin: round;
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
