<script lang="ts">
    import { QUALITIES, marketId, type Variety } from '@tabletop/dicke-kartoffeln'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { marketTotal, type SheetYear } from '$lib/utils/ledger.js'

    let {
        variety,
        entry,
        current,
        grown
    }: { variety: Variety; entry: SheetYear | undefined; current: boolean; grown: boolean } =
        $props()

    const gameSession = getGameSession()

    const columns = $derived(
        QUALITIES.map((quality) => {
            const id = marketId(variety, quality)
            const market = entry?.markets[id]
            const settled = market?.price !== undefined
            return {
                quality,
                price: !grown
                    ? undefined
                    : settled
                      ? market?.price
                      : current
                        ? gameSession.gameState.price(id)
                        : undefined,
                settled,
                sacks: market?.sacks ?? 0,
                total: market ? marketTotal(market) : undefined
            }
        })
    )
</script>

<div class="cell">
    <div class="line"><span class="label">PRICE</span></div>
    <div class="values">
        {#each columns as column (column.quality)}
            <span class="value" class:pencil={!column.settled} class:bio={column.quality === 'Bio'}
                >{column.price ?? ''}</span
            >
        {/each}
    </div>
    <div class="line"><span class="label">QUANTITY</span></div>
    <div class="values">
        {#each columns as column (column.quality)}
            <span class="value small" class:bio={column.quality === 'Bio'}
                ><span class="times">×</span>{column.sacks > 0 ? column.sacks : ''}</span
            >
        {/each}
    </div>
    <div class="line"><span class="label">TOTAL</span></div>
    <div class="values">
        {#each columns as column (column.quality)}
            <span class="value" class:bio={column.quality === 'Bio'}>{column.total ?? ''}</span>
        {/each}
    </div>
</div>

<style>
    .cell {
        display: grid;
        grid-template-rows: auto 1fr auto 1fr auto 1fr;
        height: 100%;
        border-right: 1.5px solid #1d1d1d;
    }

    .line {
        text-align: center;
        line-height: 1;
    }

    .label {
        font-family: 'Kartoffeln Letters', 'Comic Sans MS', cursive;
        font-size: 9px;
    }

    .values {
        display: grid;
        grid-template-columns: 1fr 1fr;
        align-items: center;
        border-bottom: 1px solid #b9b2a2;
    }

    .value {
        color: #1b3c8c;
        font-family: 'Kartoffeln Pen', 'Comic Sans MS', cursive;
        font-size: 19px;
        font-weight: 700;
        line-height: 1.05;
        text-align: center;
    }

    .value.bio {
        align-self: stretch;
        background: #e3e3e3;
    }

    .value.small {
        font-size: 17px;
    }

    .times {
        color: #1d1d1d;
        font-family: Arial, sans-serif;
        font-size: 11px;
        font-weight: 400;
        margin-right: 2px;
    }

    .value.pencil {
        color: #8b8b8b;
        font-weight: 400;
    }
</style>
