<script lang="ts">
    import { Country, HexKind, hexKey } from '@tabletop/railheads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { boardLayout } from '$lib/utils/boardLayout.js'
    import { DEMAND_FILL, INDUSTRY_STYLE, PEAK_FILL, WATER_FILL } from '$lib/utils/companyStyle.js'
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
                country:
                    place.industry && Object.values<string>(Country).includes(place.regionId ?? '')
                        ? (place.regionId as Country)
                        : undefined,
                center: layout.hexCenter(place.coords),
                name: site?.name,
                value: site ? `+${edition.siteRevenue(site.id)}` : undefined
            }
        })
    )
    // Each bridge or tunnel is named once, on its first hex, with its toll stars.
    const tolls = $derived(
        edition.map.tolls.map((toll) => {
            const centers = toll.hexes.map((coords) => layout.hexCenter(coords))
            const middle = {
                x: centers.reduce((sum, point) => sum + point.x, 0) / centers.length,
                y: centers.reduce((sum, point) => sum + point.y, 0) / centers.length
            }
            return {
                id: toll.id,
                key: hexKey(toll.hexes[0]),
                name: toll.name.replace(/ Bridge$/, ''),
                stars: toll.stars,
                anchor: centers[0],
                middle,
                seams: waterSeams(toll.hexes, layout)
            }
        })
    )
    const peaks = $derived(
        edition.map.peaks.map((peak) => ({
            key: hexKey(peak.hex),
            name: peak.name,
            center: layout.hexCenter(peak.hex)
        }))
    )
    const FLAG_STRIPES: Record<Country, { colors: string[]; vertical: boolean }> = {
        [Country.France]: { colors: ['#2c4f9e', '#f4f0e8', '#d0262f'], vertical: true },
        [Country.Germany]: { colors: ['#111111', '#d0262f', '#f2c230'], vertical: false },
        [Country.Austria]: { colors: ['#d0262f', '#f4f0e8', '#d0262f'], vertical: false },
        [Country.Italy]: { colors: ['#2f8a3e', '#f4f0e8', '#d0262f'], vertical: true }
    }
    const FLAG_WIDTH = 15
    const FLAG_HEIGHT = 10
    const water = $derived(
        edition.map.water.map((coords) => ({
            key: hexKey(coords),
            center: layout.hexCenter(coords)
        }))
    )
    const seams = $derived(waterSeams(edition.map.water, layout))
    const borders = $derived(style.regionBorders ? regionBorders(edition.map, layout) : [])
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
{#each [...hexes, ...water, ...peaks] as hex (hex.key)}
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
{#each tolls as toll (toll.id)}
    {#each toll.seams as seam, index (index)}
        <line
            x1={seam.from.x}
            y1={seam.from.y}
            x2={seam.to.x}
            y2={seam.to.y}
            stroke={style.hexFill[HexKind.Tunnel]}
            stroke-width={2 * INSET_GAP + edgeWidth}
        ></line>
    {/each}
{/each}
{#each peaks as peak (peak.key)}
    <polygon
        points={layout.hexPoints(peak.center, layout.hexRadius - HEX_INSET)}
        fill={PEAK_FILL}
        stroke="#1d1d1b"
        stroke-width={edgeWidth}
        stroke-linejoin="round"
    ></polygon>
    <path
        d="M {peak.center.x - 6 * scale} {peak.center.y - 2 * scale} l {6 * scale} {-10 *
            scale} l {6 * scale} {10 * scale} z"
        class="peak-mark"
    ></path>
    <text x={peak.center.x} y={peak.center.y + 11 * scale} font-size={7.5 * scale} class="peak"
        >{peak.name}</text
    >
{/each}
{#each hexes as hex (hex.key)}
    {#if hex.country}
        {@const flag = FLAG_STRIPES[hex.country]}
        <g
            transform="translate({hex.center.x - (FLAG_WIDTH * scale) / 2} {hex.center.y +
                layout.hexRadius * 0.5})"
        >
            {#each flag.colors as color, index (index)}
                <rect
                    x={flag.vertical ? (index * FLAG_WIDTH * scale) / 3 : 0}
                    y={flag.vertical ? 0 : (index * FLAG_HEIGHT * scale) / 3}
                    width={flag.vertical ? (FLAG_WIDTH * scale) / 3 : FLAG_WIDTH * scale}
                    height={flag.vertical ? FLAG_HEIGHT * scale : (FLAG_HEIGHT * scale) / 3}
                    fill={color}
                ></rect>
            {/each}
            <rect
                width={FLAG_WIDTH * scale}
                height={FLAG_HEIGHT * scale}
                fill="none"
                stroke="#1d1d1b"
                stroke-width="0.8"
            ></rect>
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
{#each tolls as toll (toll.id)}
    <path id="toll-arc-{toll.key}" d={arcPath(toll.anchor.x, toll.anchor.y)} fill="none"></path>
    <text class="name toll" font-size={nameSize(toll.name)}>
        <textPath href="#toll-arc-{toll.key}" startOffset="50%">{toll.name}</textPath>
    </text>
    {#each Array.from({ length: toll.stars }, (_, index) => index) as star (star)}
        {@const across = Math.min(toll.stars, 3)}
        {@const column = star % across}
        {@const row = Math.floor(star / across)}
        <text
            x={toll.middle.x + (column - (across - 1) / 2) * 9 * scale}
            y={toll.middle.y + (16 + row * 9) * scale}
            font-size={10 * scale}
            class="star">★</text
        >
    {/each}
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

    .name.toll {
        fill: #ffffff;
    }

    .star {
        fill: #f2a33a;
        stroke: #5a3a08;
        stroke-width: 0.6px;
        paint-order: stroke;
        text-anchor: middle;
    }

    .peak {
        fill: #2b1d06;
        font-family: 'Railheads Baskerville', Georgia, serif;
        text-anchor: middle;
    }

    .peak-mark {
        fill: none;
        stroke: #2b1d06;
        stroke-width: 1.2;
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
