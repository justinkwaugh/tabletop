<script lang="ts">
    import StockMarketScene from './StockMarketScene.svelte'
    import {
        stockMarketOrder,
        type StockMarket as StockMarketModel,
        type Company
    } from '@tabletop/18xx'
    import type { StationAppearance } from '../maps/stationPresentation.js'
    import type { MarketAnimationSource } from './marketAnimationSource.js'
    let {
        market,
        companies,
        appearances,
        animation
    }: {
        market: StockMarketModel
        companies: readonly Company[]
        appearances: Readonly<Record<string, StationAppearance>>
        animation?: MarketAnimationSource
    } = $props()
</script>

<section aria-label="Stock market">
    <h2>Stock market</h2>
    <!-- Keyboard users need to focus the scrollable market. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div class="scroll" tabindex="0" role="region" aria-label="Stock market spaces">
        <StockMarketScene {market} {companies} {appearances} {animation} />
    </div>
    <p class="order">Market order: {stockMarketOrder(market).join(' · ')}</p>
</section>

<style>
    section {
        margin: 24px 0;
        color: #253b35;
        font:
            14px/1.4 ui-sans-serif,
            system-ui,
            sans-serif;
    }
    h2 {
        font-size: 17px;
        margin: 0 0 12px;
    }
    .scroll {
        overflow: auto;
        max-height: 370px;
        border: 1px solid var(--rail-border, #c9d2cb);
        border-radius: 6px;
        background: var(--rail-surface-raised, #e6ebe2);
    }
    .order {
        font-size: 12px;
    }
</style>
