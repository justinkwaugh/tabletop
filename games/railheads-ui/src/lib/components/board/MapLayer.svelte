<script lang="ts">
    import { HexKind, hexKey } from '@tabletop/railheads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { boardLayout } from '$lib/utils/boardLayout.js'
    import { DEMAND_FILL, INDUSTRY_STYLE, WATER_FILL } from '$lib/utils/companyStyle.js'
    import { editionStyle } from '$lib/utils/editionStyle.js'
    import { regionBorders, regionLabels, waterSeams } from '$lib/utils/mapFeatures.js'
    import DemandArea from './DemandArea.svelte'
    import IndustryMark from './IndustryMark.svelte'

    const gameSession = getGameSession()

    const GERMANY_RADIUS = 36
    const ARC_RADIUS = 21
    const HEX_INSET = 1
    // The gap between two inset hexes.
    const INSET_GAP = 2 * HEX_INSET * Math.cos(Math.PI / 6)
    // Demand areas sit on a disc wider than their hex, which shows beyond the map edge.
    const DEMAND_DISC_RADIUS = 1.45
    const NAME_SIZE = 11
    const LONG_NAME_SIZE = 9.5
    const GLYPH_WIDTH = 0.6

    const edition = $derived(gameSession.gameState.edition)
    const style = $derived(editionStyle(gameSession.gameState.editionId))
    const edgeWidth = $derived(style.hexEdgeWidth)
    // Edge stroke plus the inset gap on both sides, so the map's outer border matches the seam between hexes.
    const outlineWidth = $derived(edgeWidth + 2 * INSET_GAP)
    const layout = $derived(boardLayout(gameSession.gameState.editionId))
    const revenue = $derived(edition.definition.siteRevenue)
    const scale = $derived(layout.hexRadius / GERMANY_RADIUS)
    const arcRadius = $derived(ARC_RADIUS * scale)

    const hexes = $derived(
        edition.map.hexes().map((place) => {
            const site = place.siteId ? edition.site(place.siteId) : undefined
            return {
                key: hexKey(place.coords),
                kind: place.kind,
                fill:
                    (place.kind === HexKind.Countryside && place.regionId !== undefined
                        ? style.regionFill[place.regionId]
                        : undefined) ?? style.hexFill[place.kind],
                industry: place.industry,
                center: layout.hexCenter(place.coords),
                name: site?.name,
                value: site ? `+${revenue[site.kind]}` : undefined
            }
        })
    )
    const water = $derived(
        edition.map.water.map((coords) => ({
            key: hexKey(coords),
            center: layout.hexCenter(coords)
        }))
    )
    const seams = $derived(waterSeams(edition.map.water, layout))
    const borders = $derived(regionBorders(edition.map, layout))
    const states = $derived(regionLabels(edition.map, layout, style.regionLabels))
    const lakes = $derived(
        style.lakeLabels.map((lake) => ({
            ...lake,
            center: layout.hexCenter(lake.at)
        }))
    )

    function arcPath(x: number, y: number): string {
        return `M ${x - arcRadius} ${y + 2 * scale} A ${arcRadius} ${arcRadius} 0 0 1 ${x + arcRadius} ${y + 2 * scale}`
    }

    function nameSize(name: string): number {
        const base = (name.length > 8 ? LONG_NAME_SIZE : NAME_SIZE) * scale
        return Math.min(base, (Math.PI * arcRadius) / (GLYPH_WIDTH * name.length))
    }
</script>

{#each edition.map.demandAreas as area (area.id)}
    {@const center = layout.hexCenter(area.hex)}
    <circle
        cx={center.x}
        cy={center.y}
        r={layout.hexRadius * DEMAND_DISC_RADIUS}
        class="demand-disc"
        fill={DEMAND_FILL}
    ></circle>
{/each}
{#each [...hexes, ...water] as hex (hex.key)}
    <polygon
        points={layout.hexPoints(hex.center, layout.hexRadius - HEX_INSET)}
        fill="#1d1d1b"
        stroke="#1d1d1b"
        stroke-width={outlineWidth}
        stroke-linejoin="round"
    ></polygon>
{/each}
{#each water as hex (hex.key)}
    <polygon points={layout.hexPoints(hex.center, layout.hexRadius - HEX_INSET)} fill={WATER_FILL}
    ></polygon>
{/each}
<!-- Fill the gap between neighbouring water hexes so each lake reads as one body. -->
{#each seams as seam, index (index)}
    <line
        x1={seam.from.x}
        y1={seam.from.y}
        x2={seam.to.x}
        y2={seam.to.y}
        stroke={WATER_FILL}
        stroke-width={2 * INSET_GAP}
    ></line>
{/each}
{#each lakes as lake, index (index)}
    <text
        class="lake"
        font-size={11 * scale}
        transform="translate({lake.center.x} {lake.center.y + 4}) rotate({lake.angle})"
        >{lake.name}</text
    >
{/each}
{#each hexes as hex (hex.key)}
    <polygon
        points={layout.hexPoints(hex.center, layout.hexRadius - HEX_INSET)}
        fill={hex.fill}
        stroke="#1d1d1b"
        stroke-width={edgeWidth}
        stroke-linejoin="round"
    ></polygon>
    {#if hex.industry}
        <polygon
            points={layout.hexPoints(hex.center, layout.hexRadius - 5)}
            fill="none"
            stroke={INDUSTRY_STYLE[hex.industry].ring}
            stroke-width={6 * scale}
            stroke-linejoin="round"
        ></polygon>
        <g transform="translate({hex.center.x} {hex.center.y})">
            <IndustryMark industry={hex.industry} scale={0.9 * scale} />
        </g>
    {/if}
{/each}
{#each borders as border, index (index)}
    <line
        x1={border.from.x}
        y1={border.from.y}
        x2={border.to.x}
        y2={border.to.y}
        class="border-edge"
    ></line>
{/each}
{#each borders as border, index (index)}
    <line x1={border.from.x} y1={border.from.y} x2={border.to.x} y2={border.to.y} class="border"
    ></line>
{/each}
{#each edition.map.demandAreas as area (area.id)}
    <DemandArea {area} center={layout.hexCenter(area.hex)} radius={layout.hexRadius} />
{/each}
{#each hexes as hex (hex.key)}
    {#if hex.name}
        <path id="arc-{hex.key}" d={arcPath(hex.center.x, hex.center.y)} fill="none"></path>
        <text class="name" class:city={hex.kind === HexKind.City} font-size={nameSize(hex.name)}>
            <textPath href="#arc-{hex.key}" startOffset="50%">{hex.name}</textPath>
        </text>
        <text
            x={hex.center.x}
            y={hex.center.y + 28 * scale}
            font-size={11 * scale}
            class="value"
            class:city={hex.kind === HexKind.City}>{hex.value}</text
        >
    {/if}
{/each}
{#each states as state (state.id)}
    <text x={state.at.x} y={state.at.y + 6} class="state">{state.name.toUpperCase()}</text>
{/each}

<style>
    polygon,
    circle,
    line,
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
        font-weight: 700;
        text-anchor: middle;
    }

    .border-edge {
        stroke: #fbf8e6;
        stroke-width: 7;
        stroke-linecap: round;
    }

    .border {
        stroke: #e8141c;
        stroke-width: 4.5;
        stroke-linecap: round;
    }

    .demand-disc {
        stroke: #3b2508;
        stroke-width: 2.5;
    }

    .lake {
        fill: #e3eef8;
        font-family: 'Railheads Baskerville', Georgia, serif;
        font-style: italic;
        font-weight: 700;
        text-anchor: middle;
    }

    .state {
        fill: #ffffff;
        stroke: #5b4a2a;
        stroke-width: 3px;
        paint-order: stroke;
        stroke-linejoin: round;
        font-family: 'Railheads Alegreya', Georgia, serif;
        font-size: 17px;
        font-weight: 700;
        letter-spacing: 0.03em;
        text-anchor: middle;
        opacity: 0.92;
    }
</style>
