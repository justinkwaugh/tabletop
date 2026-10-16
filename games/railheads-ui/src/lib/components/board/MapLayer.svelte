<script lang="ts">
    import { HexKind, hexKey } from '@tabletop/railheads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { HEX_RADIUS, hexCenter, hexPoints } from '$lib/utils/boardLayout.js'
    import { HEX_FILL, INDUSTRY_STYLE } from '$lib/utils/companyStyle.js'
    import IndustryMark from './IndustryMark.svelte'

    const gameSession = getGameSession()

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
    const EDGE_WIDTH = 2.5
    const HEX_INSET = 1
    // Edge stroke plus the inset gap on both sides, so the map's outer border matches the seam between hexes.
    const OUTLINE_WIDTH = EDGE_WIDTH + 4 * HEX_INSET * Math.cos(Math.PI / 6)

    function arcPath(x: number, y: number): string {
        return `M ${x - ARC_RADIUS} ${y + 2} A ${ARC_RADIUS} ${ARC_RADIUS} 0 0 1 ${x + ARC_RADIUS} ${y + 2}`
    }
</script>

{#each hexes as hex (hex.key)}
    <polygon
        points={hexPoints(hex.center, HEX_RADIUS - HEX_INSET)}
        fill="#1d1d1b"
        stroke="#1d1d1b"
        stroke-width={OUTLINE_WIDTH}
        stroke-linejoin="round"
    />
{/each}
{#each hexes as hex (hex.key)}
    <polygon
        points={hexPoints(hex.center, HEX_RADIUS - HEX_INSET)}
        fill={HEX_FILL[hex.kind]}
        stroke="#1d1d1b"
        stroke-width={EDGE_WIDTH}
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
        <text
            class="name"
            class:city={hex.kind === HexKind.City}
            font-size={hex.name.length > 8 ? 9.5 : 11}
        >
            <textPath href="#arc-{hex.key}" startOffset="50%">{hex.name}</textPath>
        </text>
        <text
            x={hex.center.x}
            y={hex.center.y + 28}
            class="value"
            class:city={hex.kind === HexKind.City}>{hex.value}</text
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
        font-family: 'Railheads Baskerville', Georgia, serif;
        font-weight: 700;
        text-anchor: middle;
    }

    .name.city,
    .value.city {
        fill: #ffffff;
    }

    .value {
        fill: #2b1d06;
        font-family: 'Railheads Baskerville', Georgia, serif;
        font-size: 11px;
        font-weight: 700;
        text-anchor: middle;
    }
</style>
