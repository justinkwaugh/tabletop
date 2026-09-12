<script lang="ts">
    import { type StockMarket as StockMarketModel, type Company } from '@tabletop/18xx'
    let {
        market,
        companies,
        renderScale = 1
    }: { market: StockMarketModel; companies: readonly Company[]; renderScale?: number } = $props()
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

<div
    class="market"
    role="region"
    aria-label="Stock market board"
    style:--render-scale={renderScale}
    style:grid-template-columns={`repeat(${columns}, ${62 * renderScale}px)`}
    style:grid-template-rows={`repeat(${rows}, ${68 * renderScale}px)`}
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
            {#if !space.moves.right && space.moves.up}
                <svg
                    class="edge-arrow right"
                    viewBox="0 0 10 32"
                    role="img"
                    aria-label="Right moves up"
                >
                    <title>Right moves up</title>
                    <path d="M7 28V4L3 10" />
                </svg>
            {/if}
            {#if !space.moves.left && space.moves.down}
                <svg
                    class="edge-arrow left"
                    viewBox="0 0 10 32"
                    role="img"
                    aria-label="Left moves down"
                >
                    <title>Left moves down</title>
                    <path d="M7 28V4L3 10" />
                </svg>
            {/if}
        </div>
    {/each}
</div>

<style>
    .market {
        display: grid;
        width: max-content;
        padding: calc(6px * var(--render-scale));
    }
    .space {
        position: relative;
        border: calc(1px * var(--render-scale)) solid #a4b3a7;
        border-radius: 0;
        margin-right: calc(-1px * var(--render-scale));
        margin-bottom: calc(-1px * var(--render-scale));
        display: flex;
        align-items: center;
        flex-direction: column;
        overflow: auto;
        font-size: calc(12px * var(--render-scale));
    }
    strong {
        align-self: flex-start;
        padding: calc(2px * var(--render-scale)) calc(4px * var(--render-scale));
        font-size: calc(13px * var(--render-scale));
    }
    .marker {
        border: calc(1px * var(--render-scale)) solid #315b4d;
        border-radius: calc(8px * var(--render-scale));
        padding: 0 calc(5px * var(--render-scale));
        background: #f6fff1;
        font-size: calc(10px * var(--render-scale));
        font-weight: 700;
    }
    .edge-arrow {
        opacity: 0.4;
        position: absolute;
        bottom: calc(3px * var(--render-scale));
        width: calc(10px * var(--render-scale));
        height: calc(32px * var(--render-scale));
        fill: none;
        stroke: currentColor;
        stroke-width: 1.25;
        stroke-linecap: round;
        stroke-linejoin: round;
    }
    .edge-arrow.right {
        right: calc(4px * var(--render-scale));
    }
    .edge-arrow.left {
        left: calc(4px * var(--render-scale));
        transform: rotate(180deg);
    }

    .market {
        color: #253b35;
        font:
            14px/1.4 ui-sans-serif,
            system-ui,
            sans-serif;
    }
</style>
