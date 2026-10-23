<script lang="ts">
    import {
        MARKETS,
        Quality,
        VARIETIES,
        demandRanges,
        priceScale,
        type Variety
    } from '@tabletop/dicke-kartoffeln'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { demandText, marketName } from '$lib/utils/format.js'

    const gameSession = getGameSession()

    const board = $derived(gameSession.gameState.marketBoard())
    const demand = $derived(demandRanges(board))
    const prices = $derived(priceScale(board))
    const COLUMNS = ['demand', 'price'] as const

    function stones(variety: Variety, column: 'demand' | 'price', row: number) {
        return MARKETS.filter((market) => market.variety === variety).flatMap((market) => {
            const state = gameSession.gameState.market(market.id)
            const at = column === 'demand' ? demand[row].min : prices[row]
            return at === (column === 'demand' ? state.demand : state.price)
                ? [
                      {
                          id: market.id,
                          bio: market.quality === Quality.Bio,
                          title: `${marketName(market.id)}: demand ${demandText(gameSession.gameState.demand(market.id))}, price ${state.price} marks`
                      }
                  ]
                : []
        })
    }
</script>

<div class="market">
    <div class="title">POTATO MARKET <small>● NORM ○ BIO</small></div>
    <table>
        <thead>
            <tr>
                <th rowspan="2" class="scale">DEMAND</th>
                <th rowspan="2" class="scale">PRICE</th>
                {#each VARIETIES as variety (variety)}
                    <th colspan="2" class="variety">{variety.toUpperCase()}</th>
                {/each}
            </tr>
            <tr>
                {#each VARIETIES as variety (variety)}
                    <th class="sub">D</th>
                    <th class="sub">P</th>
                {/each}
            </tr>
        </thead>
        <tbody>
            {#each demand as range, row (row)}
                <tr>
                    <td class="number">{demandText(range)}</td>
                    <td class="number">{prices[row]}</td>
                    {#each VARIETIES as variety (variety)}
                        {#each COLUMNS as column (column)}
                            <td class="stones" class:first={column === 'demand'}>
                                {#each stones(variety, column, row) as stone (stone.id)}
                                    <span class="stone" class:bio={stone.bio} title={stone.title}
                                    ></span>
                                {/each}
                            </td>
                        {/each}
                    {/each}
                </tr>
            {/each}
        </tbody>
    </table>
</div>

<style>
    .market {
        color: #6e3b1c;
        font-family: 'Kartoffeln Letters', 'Comic Sans MS', cursive;
    }

    .title {
        font-size: 20px;
        text-align: center;
    }

    small {
        margin-left: 6px;
        font-size: 12px;
    }

    table {
        width: 100%;
        border-collapse: collapse;
        border: 2px solid #6e3b1c;
        table-layout: fixed;
    }

    th,
    td {
        border: 1px solid #6e3b1c;
        padding: 0;
        text-align: center;
    }

    .scale {
        width: 52px;
        font-size: 10px;
    }

    .variety {
        border-left-width: 2px;
        font-size: 14px;
    }

    .sub {
        font-size: 10px;
    }

    .sub:nth-child(odd),
    td.first {
        border-left-width: 2px;
    }

    .number {
        height: 15px;
        font-family: 'Arial Narrow', Arial, sans-serif;
        font-size: 12px;
        font-weight: 700;
    }

    .stones {
        white-space: nowrap;
        line-height: 0;
    }

    .stone {
        display: inline-block;
        width: 10px;
        height: 10px;
        margin: 0 1px;
        border: 1.5px solid #120b06;
        border-radius: 50%;
        background: #3b2a20;
        box-shadow: 1px 1px 1px rgba(0, 0, 0, 0.35);
        vertical-align: middle;
    }

    .stone.bio {
        border-color: #7a6a48;
        background: #f1e6c8;
    }
</style>
