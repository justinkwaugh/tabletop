<script lang="ts">
    import type { Snippet } from 'svelte'

    // A text glyph, or an icon drawn by the caller.
    let {
        glyph,
        label,
        pressed,
        onToggle,
        children
    }: {
        glyph?: string
        label: string
        pressed: boolean
        onToggle: () => void
        children?: Snippet
    } = $props()
</script>

<button
    type="button"
    class="toggle"
    aria-pressed={pressed}
    title={pressed ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
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
        background: var(--dvonn-panel);
        box-shadow:
            inset 0 0 0 1px var(--dvonn-panel-edge),
            var(--dvonn-panel-shadow);
        color: var(--dvonn-ink-quiet);
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

    .glyph :global(text) {
        fill: currentColor;
    }

    .glyph :global(.line) {
        fill: none;
        stroke: currentColor;
        stroke-width: 1.5;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    /* On, the lines darken and a thin ring shows round the button, quieter than a solid fill. */
    .toggle[aria-pressed='true'] {
        color: var(--dvonn-ink);
        box-shadow:
            inset 0 0 0 1.5px var(--dvonn-toggle-on),
            var(--dvonn-panel-shadow);
    }

    /* Only where a pointer really hovers: on touch, a tap would leave the hover stuck on. */
    @media (hover: hover) {
        .toggle:hover {
            background: var(--dvonn-panel-hover);
        }
    }
</style>
