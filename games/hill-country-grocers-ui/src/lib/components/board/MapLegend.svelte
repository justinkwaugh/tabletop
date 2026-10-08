<script lang="ts">
    import {
        CITIES,
        CityTier,
        CompanyId,
        HEX_CUBE_LIMIT,
        developmentCapacity,
        hasCubeLimit
    } from '@tabletop/hill-country-grocers'
    import { LEGEND_RECT, hexPoints } from '$lib/utils/boardLayout.js'
    import { COMPANY_STYLE } from '$lib/utils/companyStyle.js'
    import { MEADOW_TINTS, TIER_FILL } from '$lib/utils/mapStyle.js'
    import Development from '../icons/Development.svelte'
    import Store from '../icons/Store.svelte'

    const PAD_X = 12
    const HEADER_Y = 17
    const ROW_START = 43
    const ROW_STEP = 19
    const ICON_X = PAD_X + 7
    const LABEL_X = PAD_X + 19
    const STORE_X = LEGEND_RECT.width - 64
    const DEVELOPMENT_X = LEGEND_RECT.width - 26

    type Row = { key: string; label: string; tier?: CityTier; stores: string; developments: string }

    function cityRow(tier: CityTier, label: string): Row {
        const sample = CITIES.find((candidate) => candidate.tier === tier)
        return {
            key: tier,
            label,
            tier,
            stores: sample && !hasCubeLimit(sample.coords) ? '∞' : `${HEX_CUBE_LIMIT}`,
            developments: sample ? `${developmentCapacity(sample.id)}` : '–'
        }
    }

    const ROWS: Row[] = [
        cityRow(CityTier.Black, 'Black city'),
        cityRow(CityTier.Brown, 'Brown city'),
        cityRow(CityTier.White, 'White city'),
        { key: 'countryside', label: 'Countryside', stores: `${HEX_CUBE_LIMIT}`, developments: '–' }
    ]

    function rowY(index: number): number {
        return ROW_START + index * ROW_STEP
    }
</script>

<g
    transform="translate({LEGEND_RECT.x} {LEGEND_RECT.y})"
    class="legend"
    role="img"
    aria-label="Legend: maximum stores per hex and developments per city"
>
    <rect width={LEGEND_RECT.width} height={LEGEND_RECT.height} rx="7" class="panel" />
    <text x={PAD_X} y="21" class="title">Legend</text>
    <text x={STORE_X - 13} y="21" class="max">max</text>
    <Store
        x={STORE_X}
        y={HEADER_Y}
        size={15}
        fill={COMPANY_STYLE[CompanyId.Verbena].fill}
        tint={COMPANY_STYLE[CompanyId.Verbena].tint}
    />
    <Development x={DEVELOPMENT_X} y={HEADER_Y} size={16} />
    <line x1={PAD_X} y1={HEADER_Y + 12} x2={LEGEND_RECT.width - PAD_X} y2={HEADER_Y + 12} class="rule" />
    {#each ROWS as row, index (row.key)}
        {#if row.tier}
            <circle cx={ICON_X} cy={rowY(index) - 4} r="5.5" fill={TIER_FILL[row.tier]} class="dot" />
        {:else}
            <polygon
                points={hexPoints({ x: ICON_X, y: rowY(index) - 4 }, 7)}
                fill={MEADOW_TINTS[0]}
                class="meadow"
            />
        {/if}
        <text x={LABEL_X} y={rowY(index)} class="label">{row.label}</text>
        <text x={STORE_X} y={rowY(index)} class="value" class:unlimited={row.stores === '∞'}
            >{row.stores}</text
        >
        <text x={DEVELOPMENT_X} y={rowY(index)} class="value">{row.developments}</text>
    {/each}
</g>

<style>
    .legend {
        pointer-events: none;
    }

    .panel {
        fill: rgba(253, 248, 236, 0.94);
        stroke: #7a1d22;
        stroke-width: 2;
    }

    .title {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        fill: #7a1d22;
    }

    .max {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 11px;
        font-style: italic;
        fill: #6b4a28;
        text-anchor: end;
    }

    .rule {
        stroke: #b59a68;
        stroke-width: 1;
    }

    .label {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 12.5px;
        fill: #2b1a10;
    }

    .value {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 13px;
        font-weight: 700;
        fill: #2b1a10;
        text-anchor: middle;
    }

    .value.unlimited {
        font-size: 18px;
        font-weight: 400;
    }

    .dot {
        stroke: #1a1512;
        stroke-width: 1.5;
    }

    .meadow {
        stroke: #8a8558;
        stroke-width: 1;
    }
</style>
