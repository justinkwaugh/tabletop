<script lang="ts">
    import {
        BERLIN,
        MAP_SPACES,
        RailroadId,
        SpaceKind,
        TERRAIN_COST,
        Terrain,
        mapSpace
    } from '@tabletop/preussische-ostbahn'
    import { LEGEND_AREA, hexPoints } from '$lib/utils/boardGeometry.js'
    import { RAILROAD_STYLES, homeTint } from '$lib/utils/railroadStyle.js'
    import {
        APPROACH_HATCH_ID,
        BERLIN_FILL,
        CITY_FILL,
        HEX_STROKE,
        TERRAIN_FILLS,
        TERRAIN_MARKS,
        terrainMarkPath
    } from '$lib/utils/terrainStyle.js'

    const { x, y, width } = LEGEND_AREA
    const SWATCH = 15
    const SWATCH_X = 30
    const TEXT_X = 54
    const HOME = RAILROAD_STYLES[RailroadId.Bayerische].fill

    const TERRAIN_ROWS = [
        { terrain: Terrain.Plains, label: 'Plains' },
        { terrain: Terrain.Hills, label: 'Hills' },
        { terrain: Terrain.Mountains, label: 'Mountains' }
    ]

    function hex(cx: number, cy: number, size: number = SWATCH): string {
        return hexPoints({ x: cx, y: cy }, size)
    }

    const BERLIN_COST = TERRAIN_COST[mapSpace(BERLIN).terrain]
    const APPROACH_COST = Math.min(
        ...MAP_SPACES.filter((space) => space.kind === SpaceKind.Approach).map(
            (space) => TERRAIN_COST[space.terrain]
        )
    )
</script>

<g transform={`translate(${x}, ${y})`} class="legend">
    <rect {width} height={LEGEND_AREA.height} rx="8" class="paper"></rect>

    <g transform="translate(0, -56)">
        {#each TERRAIN_ROWS as row, index (row.terrain)}
            {@const cy = 84 + index * 34}
            {@const mark = terrainMarkPath(row.terrain, SWATCH_X, cy + 4, 0.8)}
            <polygon
                points={hex(SWATCH_X, cy)}
                fill={TERRAIN_FILLS[row.terrain]}
                stroke={HEX_STROKE}
                stroke-width="0.8"
            ></polygon>
            {#if mark}
                <path d={mark} fill={TERRAIN_MARKS[row.terrain]}></path>
            {/if}
            <text x={TEXT_X} y={cy + 6} class="label">{row.label}</text>
            <text x={width - 14} y={cy + 6} class="cost" text-anchor="end"
                >${TERRAIN_COST[row.terrain]}</text
            >
        {/each}
        <polygon
            points={hex(SWATCH_X, 186)}
            fill={BERLIN_FILL}
            stroke={HEX_STROKE}
            stroke-width="0.8"
        ></polygon>
        <text x={TEXT_X} y="192" class="label">Berlin</text>
        <text x={width - 14} y="192" class="cost" text-anchor="end">${BERLIN_COST}</text>
        <polygon
            points={hex(SWATCH_X, 220)}
            fill={TERRAIN_FILLS[Terrain.Plains]}
            stroke={HEX_STROKE}
            stroke-width="0.8"
        ></polygon>
        <polygon points={hex(SWATCH_X, 220)} fill={`url(#${APPROACH_HATCH_ID})`}></polygon>
        <text x={TEXT_X} y="226" class="label">Berlin Approach</text>
        <text x={width - 14} y="226" class="cost" text-anchor="end">${APPROACH_COST}</text>

        <text x="14" y="264" class="section">Cities</text>
        <polygon points={hex(SWATCH_X, 292)} fill={CITY_FILL} stroke={HEX_STROKE} stroke-width="0.8"
        ></polygon>
        <path
            d={terrainMarkPath(Terrain.Hills, SWATCH_X, 296, 0.8)}
            fill={TERRAIN_MARKS[Terrain.Hills]}
        ></path>
        <text x={TEXT_X} y="290" class="label">Terrain as marked,</text>
        <text x={TEXT_X} y="308" class="note">+$1 per railroad there</text>

        <polygon points={hex(SWATCH_X, 336)} fill={CITY_FILL} stroke={HEX_STROKE} stroke-width="0.8"
        ></polygon>
        <text x={SWATCH_X} y="342" class="value" text-anchor="middle">2</text>
        <text x={TEXT_X} y="334" class="label">Income as marked,</text>
        <text x={TEXT_X} y="352" class="note">otherwise $1</text>

        <polygon points={hex(SWATCH_X, 380)} fill={HOME}></polygon>
        <polygon points={hex(SWATCH_X, 380, SWATCH - 3.5)} fill={homeTint(HOME)}></polygon>
        <text x={TEXT_X} y="386" class="label">Home city</text>
    </g>
</g>

<style>
    .paper {
        fill: #f8f3e4;
        stroke: #b9ab86;
        stroke-width: 1.5;
    }

    .section {
        font-family: 'Ostbahn Alegreya', Georgia, serif;
        font-size: 16px;
        font-weight: 700;
        fill: #1b2b44;
    }

    .label,
    .cost {
        font-family: 'Ostbahn Baskerville', Georgia, serif;
        font-size: 17px;
        fill: #2b2418;
    }

    .cost {
        font-weight: 700;
    }

    .note {
        font-family: 'Ostbahn Baskerville', Georgia, serif;
        font-size: 14px;
        fill: #5e5546;
    }

    .value {
        font-family: 'Ostbahn Baskerville', Georgia, serif;
        font-size: 16px;
        font-weight: 700;
        fill: #2b2418;
    }
</style>
