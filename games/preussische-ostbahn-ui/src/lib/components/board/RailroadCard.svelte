<script lang="ts">
    import {
        Ability,
        CONNECTIONS_TO_END,
        SHARES_PER_RAILROAD,
        cubesLeft,
        directConnections,
        mapSpace,
        paysDividends,
        railroadDefinition,
        railroadIncome,
        type RailroadId
    } from '@tabletop/preussische-ostbahn'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { ABILITY_LABELS, RAILROAD_STYLES } from '$lib/utils/railroadStyle.js'
    import Cube from './Cube.svelte'

    let {
        railroadId,
        x,
        y,
        width,
        height
    }: { railroadId: RailroadId; x: number; y: number; width: number; height: number } = $props()

    const gameSession = getGameSession()
    const definition = $derived(railroadDefinition(railroadId))
    const style = $derived(RAILROAD_STYLES[railroadId])
    const railroad = $derived(gameSession.gameState.railroad(railroadId))
    const connections = $derived(directConnections(gameSession.gameState.railroads, railroadId))
    const linkSlots = $derived(Math.max(CONNECTIONS_TO_END, connections.length))
    const selected = $derived(gameSession.expansionRailroad === railroadId)
    const auctioned = $derived(gameSession.shareAuctionView?.railroadId === railroadId)
</script>

<g transform={`translate(${x}, ${y})`} class="card">
    <rect
        {width}
        {height}
        rx="8"
        class="paper"
        class:highlighted={selected || auctioned}
        style:--highlight={style.fill}
    ></rect>
    <path
        d={`M0,8 a8,8 0 0 1 8,-8 h${width - 16} a8,8 0 0 1 8,8 v28 h-${width} z`}
        fill={style.fill}
    ></path>
    <text x="10" y="17" class="name" fill={style.text}>{definition.name}</text>
    <text x="10" y="30" class="sub" fill={style.text}
        >{definition.year} · {mapSpace(definition.homeSpaceId).city?.name}</text
    >

    <g transform="translate(10, 46)">
        <rect
            width={ABILITY_LABELS[definition.ability].length * 6.4 + 14}
            height="18"
            rx="9"
            fill={style.fill}
        ></rect>
        <text x="7" y="13" class="ability" fill={style.text}
            >{ABILITY_LABELS[definition.ability]}</text
        >
        {#if definition.ability === Ability.MustConnect}
            <text
                x={width - 20}
                y="13"
                text-anchor="end"
                class="note"
                class:alert={!paysDividends(railroad)}
                >{paysDividends(railroad) ? 'Paying' : 'Not paying'}</text
            >
        {/if}
    </g>

    <text x="10" y="88" class="label">Income</text>
    <text x="10" y="112" class="big">${railroadIncome(railroad)}</text>
    <text x={width * 0.38} y="88" class="label">Treasury</text>
    <text x={width * 0.38} y="112" class="big">${railroad.treasury}</text>
    <text x={width - 10} y="88" text-anchor="end" class="label">Track</text>
    <text x={width - 28} y="112" text-anchor="end" class="big">{cubesLeft(railroad)}</text>
    <Cube {railroadId} x={width - 16} y={106.5} size={11} />

    <g transform="translate(10, 134)">
        <text x="0" y="36" class="tiny">shares sold</text>
        {#each Array.from({ length: SHARES_PER_RAILROAD }, (_, index) => index) as index (index)}
            {@const owner = railroad.owners[index]}
            <g transform={`translate(${index * 26 + 11}, 11)`}>
                {#if owner}
                    <circle
                        r="10.5"
                        fill={gameSession.colors.getPlayerUiColor(owner)}
                        stroke="rgba(0,0,0,0.45)"
                    ></circle>
                    <text
                        y="4"
                        text-anchor="middle"
                        class="initial"
                        fill={gameSession.colors.getPlayerTextColorValue(owner)}
                        >{gameSession.playerInitial(owner)}</text
                    >
                {:else}
                    <circle r="10.5" class="empty-share"></circle>
                {/if}
            </g>
        {/each}
        {#each Array.from({ length: linkSlots }, (_, index) => index) as index (index)}
            {@const linked = connections[index]}
            <rect
                x={width - 20 - (linkSlots - index) * 16 + 3}
                y="4.5"
                width="13"
                height="13"
                rx="2"
                fill={linked ? RAILROAD_STYLES[linked].fill : 'none'}
                stroke={linked ? 'rgba(0,0,0,0.5)' : '#a99d7e'}
                stroke-dasharray={linked ? undefined : '2 2'}
            ></rect>
        {/each}
        <text x={width - 20} y="36" text-anchor="end" class="tiny">links</text>
    </g>
</g>

<style>
    .paper {
        fill: #f8f3e4;
        stroke: #b9ab86;
        stroke-width: 1.5;
    }

    .paper.highlighted {
        stroke: var(--highlight);
        stroke-width: 4;
    }

    .name {
        font-family: 'Ostbahn Alegreya', Georgia, serif;
        font-size: 14px;
        font-weight: 700;
    }

    .sub {
        font-family: 'Ostbahn Baskerville', Georgia, serif;
        font-size: 9px;
    }

    .ability {
        font-family: 'Ostbahn Baskerville', Georgia, serif;
        font-size: 10.5px;
        font-weight: 700;
    }

    .note {
        font-family: 'Ostbahn Baskerville', Georgia, serif;
        font-size: 9px;
        fill: #2e7d4a;
    }

    .note.alert {
        fill: #a3262b;
    }

    .label {
        font-family: 'Ostbahn Baskerville', Georgia, serif;
        font-size: 9.5px;
        fill: #6f6450;
    }

    .big {
        font-family: 'Ostbahn Alegreya', Georgia, serif;
        font-size: 22px;
        font-weight: 700;
        fill: #2b2418;
    }

    .initial {
        font-family: 'Ostbahn Baskerville', Georgia, serif;
        font-size: 11px;
        font-weight: 700;
    }

    .empty-share {
        fill: none;
        stroke: #a99d7e;
        stroke-dasharray: 3 2;
    }

    .tiny {
        font-family: 'Ostbahn Baskerville', Georgia, serif;
        font-size: 8.5px;
        fill: #6f6450;
    }
</style>
