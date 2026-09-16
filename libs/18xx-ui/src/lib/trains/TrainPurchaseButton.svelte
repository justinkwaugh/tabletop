<script lang="ts">
    import { contrastingTextColor } from '../colors/contrastingTextColor.js'
    let { name, price, color, disabled = false, upcoming = false, market = false, definitionId, onclick }: {
        name: string; price: number; color: string; disabled?: boolean; upcoming?: boolean;
        market?: boolean; definitionId: string; onclick: () => void
    } = $props()
</script>

<button class:upcoming style:background={color} style:color={contrastingTextColor(color)}
    data-depot-train={market ? undefined : definitionId}
    aria-label={`${name} for $${price}${upcoming ? ', upcoming' : market ? ' from Market' : ''}`}
    disabled={disabled || upcoming} {onclick}>
    <span>{name}</span><span class="price">${price}</span>
</button>

<style>
    button {
        display: flex; align-items: baseline; justify-content: space-between; gap: 28px;
        min-width: 100px; padding: 4px 8px; border: 1px solid var(--rail-border, #c7b8a6); border-radius: 4px;
        font: inherit; font-size: 15px; font-weight: 400; line-height: 1.25;
        filter: var(--rail-phase-filter, saturate(0.6)); cursor: pointer;
    }
    button > span { font-size: 15px; }
    .price { font-weight: 600; }
    button:disabled { opacity: var(--rail-phase-opacity, 0.5); cursor: default; }
    button.upcoming { border-style: dashed; cursor: not-allowed; }
    button:hover:not(:disabled) { filter: var(--rail-phase-filter, saturate(0.6) brightness(0.95)); }
    button:focus-visible { outline: 2px solid #a87948; outline-offset: 2px; }
</style>
