<script lang="ts">
    import StockMarketScene from './StockMarketScene.svelte'
    import {
        stockMarketOrder,
        type StockMarket as StockMarketModel,
        type Company
    } from '@tabletop/18xx'
    let { market, companies }: { market: StockMarketModel; companies: readonly Company[] } =
        $props()
</script>

<section aria-label="Stock market">
    <h2>Stock market</h2>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard users need to focus the scrollable market.) -->
    <div class="scroll" tabindex="0" role="region" aria-label="Stock market spaces">
        <StockMarketScene {market} {companies} />
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
        border: 1px solid #c9d2cb;
        border-radius: 6px;
        background: #e6ebe2;
    }
    .order {
        font-size: 12px;
    }
</style>
