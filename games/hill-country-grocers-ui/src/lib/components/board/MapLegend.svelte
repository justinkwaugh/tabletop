<script lang="ts">
    import { CityTier, CompanyId } from '@tabletop/hill-country-grocers'
    import { LEGEND_RECT } from '$lib/utils/boardLayout.js'
    import { COMPANY_STYLE } from '$lib/utils/companyStyle.js'
    import { TIER_FILL } from '$lib/utils/mapStyle.js'
    import Development from '../icons/Development.svelte'
    import Store from '../icons/Store.svelte'

    const ROW_START = 46
    const ROW_STEP = 25
    const ICON_X = 20
    const LABEL_X = 38

    const CITY_TIERS: { tier: CityTier; label: string }[] = [
        { tier: CityTier.Black, label: 'Black city' },
        { tier: CityTier.Brown, label: 'Brown city' },
        { tier: CityTier.White, label: 'White city' }
    ]

    function rowY(index: number): number {
        return ROW_START + index * ROW_STEP
    }
</script>

<g transform="translate({LEGEND_RECT.x} {LEGEND_RECT.y})" class="legend">
    <rect width={LEGEND_RECT.width} height={LEGEND_RECT.height} rx="8" class="panel" />
    <text x={LEGEND_RECT.width / 2} y="22" class="title">Legend</text>
    {#each CITY_TIERS as entry, index (entry.tier)}
        <circle cx={ICON_X} cy={rowY(index) - 4} r="7" fill={TIER_FILL[entry.tier]} class="dot" />
        <text x={LABEL_X} y={rowY(index)} class="label">{entry.label}</text>
    {/each}
    <Store x={ICON_X} y={rowY(3) - 4} size={15} fill={COMPANY_STYLE[CompanyId.Verbena].fill}
        tint={COMPANY_STYLE[CompanyId.Verbena].tint}
    />
    <text x={LABEL_X} y={rowY(3)} class="label">Grocery store</text>
    <Development x={ICON_X} y={rowY(4) - 5} size={16} />
    <text x={LABEL_X} y={rowY(4)} class="label">Development</text>
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
        font-size: 15px;
        font-weight: 700;
        fill: #7a1d22;
        text-anchor: middle;
    }

    .label {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 13.5px;
        fill: #2b1a10;
    }

    .dot {
        stroke: #1a1512;
        stroke-width: 2;
    }

</style>
