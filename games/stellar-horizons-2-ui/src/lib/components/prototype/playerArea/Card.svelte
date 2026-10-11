<script lang="ts">
    // PROTOTYPE: a fleet improvement or genetic manipulation card, shaped like the printed one.
    import { FIELD_COLORS } from '$lib/utils/presentation.js'
    import type { MockCard } from './campaignMock.svelte.js'
    import Coin from './Coin.svelte'

    let {
        card,
        width = 96,
        showEffect = false
    }: { card: MockCard; width?: number; showEffect?: boolean } = $props()
    const scale = $derived(width / 96)
</script>

<div
    class="card"
    class:genetic={card.kind === 'Genetic'}
    style:width="{width}px"
    style:--s={scale}
    title="{card.name} ({card.level}){card.effect
        ? `: ${card.effect}`
        : ''}. Costs {card.cost} {card.costField.toLowerCase()} points, worth {card.vp} victory points."
>
    <div class="band">{card.kind === 'Fleet' ? 'Fleet improvement' : 'Genetic manipulation'}</div>
    <div class="name">{card.name} ({card.level})</div>
    {#if showEffect && card.effect}
        <div class="effect">{card.effect}</div>
    {/if}
    <div class="foot">
        <Coin value={card.vp} size={18 * scale} />
        <span class="cost" style:background={FIELD_COLORS[card.costField]}>{card.cost}</span>
    </div>
</div>

<style>
    .card {
        display: flex;
        flex-direction: column;
        flex-shrink: 0;
        border-radius: calc(5px * var(--s));
        overflow: hidden;
        background: #cdbb93;
        color: #1c1710;
        border: 1px solid #0b0f18;
    }
    .card.genetic {
        background: #b9d3a4;
    }
    .band {
        padding: calc(2px * var(--s)) calc(5px * var(--s));
        background: #16233a;
        color: #7fd3ff;
        font-size: calc(8.5px * var(--s));
        font-weight: 700;
        white-space: nowrap;
        overflow: hidden;
    }
    .name {
        padding: calc(4px * var(--s)) calc(5px * var(--s)) 0;
        font-size: calc(11px * var(--s));
        font-weight: 800;
        line-height: 1.15;
    }
    .effect {
        padding: calc(3px * var(--s)) calc(5px * var(--s)) 0;
        font-size: calc(9.5px * var(--s));
        font-style: italic;
        line-height: 1.2;
    }
    .foot {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: auto;
        padding: calc(4px * var(--s)) calc(5px * var(--s));
    }
    .cost {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: calc(20px * var(--s));
        height: calc(20px * var(--s));
        padding: 0 calc(3px * var(--s));
        border-radius: 999px;
        border: 1.5px solid #fff;
        color: #0b0f18;
        font-size: calc(10.5px * var(--s));
        font-weight: 900;
    }
</style>
