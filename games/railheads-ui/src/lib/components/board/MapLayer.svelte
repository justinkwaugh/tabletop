<script lang="ts">
    import { HexKind, hexKey } from '@tabletop/railheads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { HEX_RADIUS, hexCenter, hexPoints } from '$lib/utils/boardLayout.js'
    import { INDUSTRY_STYLE } from '$lib/utils/companyStyle.js'
    import IndustryMark from './IndustryMark.svelte'

    const gameSession = getGameSession()

    const FILL: Record<HexKind, string> = {
        [HexKind.Countryside]: '#83a35a',
        [HexKind.City]: '#df3f2b',
        [HexKind.Town]: '#de8a1d',
        [HexKind.Industry]: '#e9dc3f'
    }

    const edition = $derived(gameSession.gameState.edition)
    const revenue = $derived(edition.definition.siteRevenue)

    const hexes = $derived(
        edition.map.hexes().map((place) => {
            const site = place.siteId ? edition.site(place.siteId) : undefined
            return {
                key: hexKey(place.coords),
                kind: place.kind,
                industry: place.industry,
                center: hexCenter(place.coords),
                name: site?.name,
                value: site ? `+${revenue[site.kind]}` : undefined
            }
        })
    )

    const ARC_RADIUS = 21

    function arcPath(x: number, y: number): string {
        return `M ${x - ARC_RADIUS} ${y + 2} A ${ARC_RADIUS} ${ARC_RADIUS} 0 0 1 ${x + ARC_RADIUS} ${y + 2}`
    }
</script>

{#each hexes as hex (hex.key)}
    <polygon
        points={hexPoints(hex.center, HEX_RADIUS - 1)}
        fill={FILL[hex.kind]}
        stroke="#1d1d1b"
        stroke-width="2.5"
        stroke-linejoin="round"
    />
    {#if hex.industry}
        <polygon
            points={hexPoints(hex.center, HEX_RADIUS - 5)}
            fill="none"
            stroke={INDUSTRY_STYLE[hex.industry].ring}
            stroke-width="6"
            stroke-linejoin="round"
        />
        <g transform="translate({hex.center.x} {hex.center.y})">
            <IndustryMark industry={hex.industry} scale={0.9} />
        </g>
    {/if}
    {#if hex.name}
        <path id="arc-{hex.key}" d={arcPath(hex.center.x, hex.center.y)} fill="none" />
        <text class="name" class:city={hex.kind === HexKind.City} font-size={hex.name.length > 8 ? 9.5 : 11}>
            <textPath href="#arc-{hex.key}" startOffset="50%">{hex.name}</textPath>
        </text>
        <text x={hex.center.x} y={hex.center.y + 25} class="value" class:city={hex.kind === HexKind.City}
            >{hex.value}</text
        >
    {/if}
{/each}

<style>
    polygon,
    text {
        pointer-events: none;
    }

    .name {
        fill: #2b1d06;
        font-family: 'Libre Baskerville', Georgia, serif;
        font-weight: 700;
        text-anchor: middle;
    }

    .name.city,
    .value.city {
        fill: #ffffff;
    }

    .value {
        fill: #2b1d06;
        font-family: 'Courier Prime', 'Courier New', monospace;
        font-size: 11px;
        font-weight: 700;
        text-anchor: middle;
    }
</style>
