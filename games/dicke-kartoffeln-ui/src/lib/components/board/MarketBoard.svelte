<script lang="ts">
    import {
        MARKETS,
        MarketBoardId,
        Quality,
        VARIETIES,
        demandRows,
        priceSpaces,
        startingPosition,
        type MarketId,
        type Variety
    } from '@tabletop/dicke-kartoffeln'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { demandText, marketName } from '$lib/utils/format.js'
    import {
        MARKET_TRACKS,
        PRICE_CHANGES,
        markerRow,
        markerSpaceId,
        trackSpaces,
        type MarketTrack
    } from '$lib/utils/marketTracks.js'

    let { width, height }: { width: number; height: number } = $props()

    const gameSession = getGameSession()

    const board = $derived(gameSession.gameState.marketBoard())
    const playerCount = $derived(gameSession.gameState.players.length)
    const demand = $derived(demandRows(board))
    const prices = $derived(priceSpaces(board))

    const TITLE_HEIGHT = 44
    const HEAD_HEIGHT = 58
    const MARGIN = 14
    const GAP = 18
    const KEY_HEIGHT = 78
    const KEY_ROW = 22
    const KEY_LABEL_WIDTH = 190
    const KEY_VALUE_WIDTH = 58
    const KEY_TABLE_X = 116
    const tableWidth = $derived((width - 2 * MARGIN - 2 * GAP) / 3)
    const demandWidth = $derived(tableWidth * 0.58)
    const rowHeight = $derived(
        (height - TITLE_HEIGHT - HEAD_HEIGHT - MARGIN - KEY_HEIGHT) / demand.length
    )
    const top = TITLE_HEIGHT + HEAD_HEIGHT
    const keyTop = $derived(height - MARGIN - KEY_HEIGHT + 10)

    function tableX(variety: Variety): number {
        return MARGIN + VARIETIES.indexOf(variety) * (tableWidth + GAP)
    }

    function rowY(row: number): number {
        return top + row * rowHeight
    }

    function marketsOf(variety: Variety) {
        return MARKETS.filter((market) => market.variety === variety)
    }

    function stoneX(column: MarketTrack, quality: Quality, variety: Variety): number {
        const left = column === 'demand' ? tableX(variety) : tableX(variety) + demandWidth
        const span = column === 'demand' ? demandWidth : tableWidth - demandWidth
        return left + (quality === Quality.Norm ? span * 0.14 : span - span * 0.14)
    }

    function startNotes(variety: Variety, row: number, column: MarketTrack): string[] {
        return marketsOf(variety).flatMap((market) => {
            const start = startingPosition(board, playerCount, market.id)
            return trackSpaces(board, column)[row].id === markerSpaceId(start, column)
                ? [`start ${market.quality}`]
                : []
        })
    }

    function stoneTitle(id: MarketId): string {
        return `${marketName(id)}: demand ${demandText(gameSession.gameState.demand(id))}, price ${gameSession.gameState.price(id)} marks`
    }
</script>

<svg
    class="market"
    {width}
    {height}
    viewBox="0 0 {width} {height}"
    role="img"
    aria-label="Potato market"
>
    <rect x="2" y="2" width={width - 4} height={height - 4} rx="6" class="paper" />
    <rect x="7" y="7" width={width - 14} height={height - 14} rx="3" class="frame" />
    <text x={width / 2} y="33" class="title" text-anchor="middle"
        >POTATO MARKET FOR {board === MarketBoardId.TwoPlayers ? '2' : '3–6'} PLAYERS</text
    >
    {#each VARIETIES as variety (variety)}
        {@const x = tableX(variety)}
        <text x={x + tableWidth / 2} y={TITLE_HEIGHT + 30} class="variety" text-anchor="middle"
            >{variety.toUpperCase()}</text
        >
        <rect {x} y={TITLE_HEIGHT + 36} width={tableWidth} height={HEAD_HEIGHT - 36} class="head" />
        <text x={x + demandWidth / 2} y={top - 6} class="column" text-anchor="middle">DEMAND</text>
        <text
            x={x + demandWidth + (tableWidth - demandWidth) / 2}
            y={top - 6}
            class="column"
            text-anchor="middle">PRICE</text
        >
        {#each demand as { range }, row (row)}
            {@const y = rowY(row)}
            <rect {x} {y} width={demandWidth} height={rowHeight} class="cell" />
            <rect
                x={x + demandWidth}
                {y}
                width={tableWidth - demandWidth}
                height={rowHeight}
                class="cell"
            />
            <text
                x={x + demandWidth / 2}
                y={y + rowHeight * 0.58}
                class="number"
                text-anchor="middle">{demandText(range)}</text
            >
            <text
                x={x + demandWidth + (tableWidth - demandWidth) / 2}
                y={y + rowHeight * 0.58}
                class="number"
                text-anchor="middle">{prices[row].marks}</text
            >
            {#each startNotes(variety, row, 'demand') as note, index (note)}
                <text
                    x={x + demandWidth / 2}
                    y={y + rowHeight - 3 - index * 9}
                    class="note"
                    text-anchor="middle">{note}</text
                >
            {/each}
            {#each startNotes(variety, row, 'price') as note, index (note)}
                <text
                    x={x + demandWidth + (tableWidth - demandWidth) / 2}
                    y={y + rowHeight - 3 - index * 9}
                    class="note"
                    text-anchor="middle">{note}</text
                >
            {/each}
        {/each}
        {#each marketsOf(variety) as market (market.id)}
            {@const state = gameSession.gameState.market(market.id)}
            {#each MARKET_TRACKS as column (column)}
                <circle
                    cx={stoneX(column, market.quality, variety)}
                    cy={rowY(markerRow(board, state, column)) + rowHeight / 2}
                    r={Math.min(rowHeight * 0.36, 11)}
                    class="stone {market.quality === Quality.Bio ? 'bio' : 'norm'}"
                >
                    <title>{stoneTitle(market.id)}</title>
                </circle>
            {/each}
        {/each}
    {/each}
    <g class="key" transform="translate({MARGIN}, {keyTop})">
        <circle cx="10" cy={KEY_ROW / 2} r="9" class="stone norm" />
        <text x="26" y={KEY_ROW / 2 + 5} class="key-text">Norm</text>
        <circle cx="10" cy={KEY_ROW * 1.5} r="9" class="stone bio" />
        <text x="26" y={KEY_ROW * 1.5 + 5} class="key-text">Bio</text>
        {#each ['Demand moves (rows)', 'Price moves (steps)'] as label, row (label)}
            <rect
                x={KEY_TABLE_X}
                y={row * KEY_ROW}
                width={KEY_LABEL_WIDTH}
                height={KEY_ROW}
                class="cell"
            />
            <text x={KEY_TABLE_X + 6} y={row * KEY_ROW + 15} class="key-text">{label}</text>
            {#each PRICE_CHANGES as change, index (change.rowsMoved)}
                {@const x = KEY_TABLE_X + KEY_LABEL_WIDTH + index * KEY_VALUE_WIDTH}
                <rect {x} y={row * KEY_ROW} width={KEY_VALUE_WIDTH} height={KEY_ROW} class="cell" />
                <text
                    x={x + KEY_VALUE_WIDTH / 2}
                    y={row * KEY_ROW + 16}
                    class="number"
                    text-anchor="middle">{row === 0 ? change.rowsMoved : change.priceSteps}</text
                >
            {/each}
        {/each}
        <text x={KEY_TABLE_X} y={KEY_ROW * 2 + 18} class="key-text"
            >More sacks offered than demanded: the price falls. Fewer: it rises.</text
        >
    </g>
</svg>

<style>
    .market {
        display: block;
        user-select: none;
    }

    .paper {
        fill: #fffdf4;
        stroke: #6e3b1c;
        stroke-width: 2.5;
    }

    .frame {
        fill: none;
        stroke: #6e3b1c;
        stroke-width: 1.2;
    }

    .title {
        fill: #6e3b1c;
        font-family: 'Kartoffeln Letters', 'Comic Sans MS', cursive;
        font-size: 25px;
        letter-spacing: 1px;
    }

    .variety {
        fill: #6e3b1c;
        font-family: 'Kartoffeln Letters', 'Comic Sans MS', cursive;
        font-size: 28px;
    }

    .head {
        fill: none;
        stroke: #6e3b1c;
        stroke-width: 1.6;
    }

    .column {
        fill: #6e3b1c;
        font-family: 'Kartoffeln Letters', 'Comic Sans MS', cursive;
        font-size: 13px;
    }

    .cell {
        fill: none;
        stroke: #6e3b1c;
        stroke-width: 1.6;
    }

    .number {
        fill: #6e3b1c;
        font-family: 'Arial Narrow', Arial, sans-serif;
        font-size: 15px;
        font-weight: 700;
    }

    .key-text {
        fill: #6e3b1c;
        font-family: Arial, sans-serif;
        font-size: 14px;
    }

    .note {
        fill: #8a5a36;
        font-family: Arial, sans-serif;
        font-size: 8px;
    }

    .stone {
        stroke-width: 1.5;
        filter: drop-shadow(1px 1.5px 1px rgba(0, 0, 0, 0.45));
    }

    .stone.norm {
        fill: #3b2a20;
        stroke: #120b06;
    }

    .stone.bio {
        fill: #f1e6c8;
        stroke: #7a6a48;
    }
</style>
