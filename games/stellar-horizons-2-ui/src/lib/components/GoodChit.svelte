<script lang="ts">
    import type { TradeGood } from '@tabletop/stellar-horizons-2'
    import { TRADE_GOOD_ART } from '$lib/art/manifest.js'
    import { goodName } from '$lib/utils/trade.js'

    let {
        good,
        count = 1,
        size = 30
    }: { good: TradeGood; count?: number; size?: number } = $props()
</script>

<span
    class="chit"
    role="img"
    aria-label={count > 1 ? `${count} ${goodName(good)}` : goodName(good)}
    title={count > 1 ? `${count} ${goodName(good)}` : goodName(good)}
    style:--size="{size}px"
>
    <img src={TRADE_GOOD_ART[good]} alt="" />
    {#if count > 1}<b>{count}</b>{/if}
</span>

<style>
    .chit {
        position: relative;
        display: inline-block;
        flex-shrink: 0;
        width: var(--size);
        height: calc(var(--size) * 116 / 128);
    }

    img {
        display: block;
        width: 100%;
        height: 100%;
    }

    b {
        position: absolute;
        right: -3px;
        bottom: -3px;
        font-size: 12px;
        font-weight: 900;
        line-height: 1;
        color: #fff;
        paint-order: stroke;
        -webkit-text-stroke: 3px rgba(0, 0, 0, 0.75);
    }
</style>
