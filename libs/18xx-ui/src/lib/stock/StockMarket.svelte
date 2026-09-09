<script lang="ts">
    import {
        stockMarketOrder,
        type StockMarket as StockMarketModel,
        type Company
    } from '@tabletop/18xx'
    let { market, companies }: { market: StockMarketModel; companies: readonly Company[] } =
        $props()
    const columns = $derived(Math.max(...market.spaces.map((space) => space.column)) + 1)
    const rows = $derived(Math.max(...market.spaces.map((space) => space.row)) + 1)
    const colors: Record<string, string> = {
        white: '#fffefa',
        pink: '#f2c7d4',
        yellow: '#f6df81',
        orange: '#efa960',
        green: '#9cccaa',
        blue: '#accbe9',
        red: '#e8a59f'
    }
</script>

<section aria-label="Stock market">
    <h2>Stock market</h2>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard users need to focus the scrollable market.) -->
    <div class="scroll" tabindex="0" role="region" aria-label="Stock market spaces">
        <div
            class="market"
            style:grid-template-columns={`repeat(${columns}, 62px)`}
            style:grid-template-rows={`repeat(${rows}, 68px)`}
        >
            {#each market.spaces as space (space.id)}
                <div
                    class="space"
                    data-market-space={space.id}
                    style:grid-column={space.column + 1}
                    style:grid-row={space.row + 1}
                    style:background={colors[space.color] ?? space.color}
                >
                    <strong>{space.price}</strong>
                    {#each market.stacks.find((stack) => stack.spaceId === space.id)?.companyIds ?? [] as companyId (companyId)}
                        <span
                            class="marker"
                            data-market-company={companyId}
                            title={companies.find((company) => company.id === companyId)?.name}
                            >{companyId}</span
                        >
                    {/each}
                </div>
            {/each}
        </div>
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
    .market {
        display: grid;
        gap: 2px;
        width: max-content;
        padding: 6px;
    }
    .space {
        border: 1px solid #a4b3a7;
        border-radius: 3px;
        display: flex;
        align-items: center;
        flex-direction: column;
        overflow: auto;
        font-size: 12px;
    }
    strong {
        font-size: 13px;
    }
    .marker {
        border: 1px solid #315b4d;
        border-radius: 8px;
        padding: 0 5px;
        background: #f6fff1;
        font-size: 10px;
        font-weight: 700;
    }
    .order {
        font-size: 12px;
    }
</style>
