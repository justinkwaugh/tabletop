<script lang="ts">
    import { HexOrientation } from '@tabletop/common'
    import type { TileRotation } from '@tabletop/18xx'
    import {
        Tile,
        TileArtwork,
        createTileDrawing,
        ClassicTileAppearance,
        CustomTileAppearance,
        TileAppearances,
        tileDrawingStyle,
        revenueBadgeHalfWidth
    } from '@tabletop/18xx-ui'
    import '@fontsource/inter/latin-700.css'
    import '@fontsource/atkinson-hyperlegible/latin-700.css'
    import '@fontsource/roboto-condensed/latin-700.css'
    import '@fontsource/lato/latin-700.css'
    import { TileSpecimenGroups, SpecimenLayouts } from '../../demo/specimens.js'
    import { PreprintedTileExamples, TileReplacementExamples } from '../../demo/placements.js'
    let orientation = $state(HexOrientation.Flat)
    let appearance = $state(ClassicTileAppearance)
    const rotations: readonly TileRotation[] = [0, 1, 2, 3, 4, 5]
    const tiles = TileSpecimenGroups['All specimens']
    const overlayTile = tiles.find((tile) => tile.id === '18xx:14')!
    // Revenue type candidates, drawn in the Custom style's circle on its tile colours.
    const revenueFonts = [
        {
            name: 'Classic (system sans)',
            family: 'ui-sans-serif, system-ui, sans-serif',
            weight: 750
        },
        { name: 'Inter', family: "'Inter', sans-serif", weight: 700 },
        {
            name: 'Atkinson Hyperlegible',
            family: "'Atkinson Hyperlegible', sans-serif",
            weight: 700
        },
        { name: 'Lato', family: "'Lato', sans-serif", weight: 700 },
        { name: 'Roboto Condensed', family: "'Roboto Condensed', sans-serif", weight: 700 }
    ]
    const revenueValues = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 120, 150]
    const revenueTiles = ['yellow', 'green', 'brown', 'gray', 'white']
    const revenueCircle = CustomTileAppearance.revenueCircle!
    const overlayDrawing = $derived(
        createTileDrawing(overlayTile.face, orientation, 1, undefined, tileDrawingStyle(appearance))
    )
</script>

<svelte:head><title>18xx visual specimens</title></svelte:head>
<main>
    <a href="/">← Tile library</a>
    <h1>Visual specimens</h1>
    <div class="controls">
        <label
            >Hex orientation<select bind:value={orientation}
                ><option value={HexOrientation.Flat}>Flat top</option><option
                    value={HexOrientation.Pointy}>Pointy top</option
                ></select
            ></label
        >
        <label
            >Tile style<select bind:value={appearance}
                >{#each TileAppearances as option (option.name)}<option value={option}
                        >{option.name}</option
                    >{/each}</select
            ></label
        >
    </div>
    <section aria-label="Revenue type">
        <h2>Revenue type <small>Custom circle, 10 units; map scale then 3×</small></h2>
        {#each revenueFonts as font (font.name)}
            <figure class="revenue-font">
                <figcaption>{font.name}</figcaption>
                {#each [1, 3] as scale (scale)}
                    <svg
                        viewBox={`0 0 ${revenueValues.length * 30} 20`}
                        width={revenueValues.length * 30 * scale}
                        height={20 * scale}
                        role="img"
                        aria-label={`${font.name} revenues at ${scale}×`}
                    >
                        {#each revenueValues as value, index (value)}
                            <rect
                                x={index * 30}
                                width="30"
                                height="20"
                                fill={CustomTileAppearance.colors[
                                    revenueTiles[index % revenueTiles.length]
                                ]}
                            ></rect>
                            {@const halfWidth = revenueBadgeHalfWidth(
                                value,
                                revenueCircle.radius,
                                revenueCircle.fontSize
                            )}
                            <rect
                                x={index * 30 + 15 - halfWidth}
                                y={10 - revenueCircle.radius}
                                width={2 * halfWidth}
                                height={2 * revenueCircle.radius}
                                rx={revenueCircle.radius}
                                fill={CustomTileAppearance.paper}
                                stroke={revenueCircle.ringColor}
                                stroke-width={revenueCircle.ringWidth}
                            ></rect>
                            <text
                                x={index * 30 + 15}
                                y="10"
                                text-anchor="middle"
                                dominant-baseline="central"
                                font-size={revenueCircle.fontSize}
                                font-family={font.family}
                                font-weight={font.weight}
                                fill={CustomTileAppearance.ink}>{value}</text
                            >
                        {/each}
                    </svg>
                {/each}
            </figure>
        {/each}
    </section>
    <section aria-label="Board composition example">
        <h2>SVG composition · route, token, location</h2>
        <svg
            viewBox="-65 -65 130 130"
            width="220"
            role="img"
            aria-label="Tile with a route and station overlay"
        >
            <TileArtwork face={overlayTile.face} drawing={overlayDrawing} {appearance}>
                {#snippet trackOverlay(drawing)}
                    <path
                        data-example-route
                        d={drawing.paths[0].d}
                        fill="none"
                        stroke="#ae2544"
                        stroke-width="3"
                    ></path>
                {/snippet}
                {#snippet overlays(drawing)}
                    {@const slot = drawing.nodes[0].slots[0]}
                    <circle
                        data-example-token
                        cx={slot.x}
                        cy={slot.y}
                        r="8.5"
                        fill="#294f9c"
                        stroke="white"
                        stroke-width=".8"
                    ></circle>
                    <text
                        x={slot.x}
                        y={slot.y}
                        text-anchor="middle"
                        dominant-baseline="central"
                        font-size="7"
                        fill="white">A</text
                    >
                    <text x="0" y="-53" text-anchor="middle" font-size="6">Example location</text>
                {/snippet}
            </TileArtwork>
        </svg>
        <div class="sizes" aria-label="Tile size comparison">
            {#each [64, 110, 180] as size (size)}<Tile
                    face={overlayTile.face}
                    printedNumber="14"
                    {orientation}
                    {appearance}
                    {size}
                />{/each}
        </div>
    </section>
    <section aria-label="Preprinted tiles">
        <h2>Preprinted tiles</h2>
        <div class="preprinted-tiles">
            {#each PreprintedTileExamples as example, i (i)}
                <figure>
                    <Tile
                        face={example.face}
                        {orientation}
                        {appearance}
                        size={130}
                        label={`${example.title} ${example.locationId} preprinted tile`}
                    />
                    <figcaption>{example.title} · {example.locationId}</figcaption>
                </figure>
            {/each}
        </div>
    </section>
    {#each TileReplacementExamples as example, i (i)}
        <section aria-label={`${example.title} replacement`}>
            <h2>{example.title} · Supply replacement</h2>
            <div class="replacement">
                {#each example.stages as stage, i (i)}
                    <figure>
                        <Tile
                            face={stage.face}
                            rotation={stage.rotation}
                            {orientation}
                            {appearance}
                            size={130}
                        />
                        <figcaption>{stage.caption}</figcaption>
                    </figure>
                {/each}
            </div>
        </section>
    {/each}
    {#each tiles as tile (tile.id)}
        <section aria-label={tile.id}>
            <h2>{tile.printedNumber} <small>{tile.scope}</small></h2>
            <div class="rotations">
                {#each rotations as rotation (rotation)}<figure>
                        <Tile
                            face={tile.face}
                            printedNumber={tile.printedNumber}
                            {rotation}
                            {orientation}
                            {appearance}
                            layout={SpecimenLayouts[tile.id]}
                            size="100%"
                        />
                        <figcaption>{rotation * 60}°</figcaption>
                    </figure>{/each}
            </div>
        </section>
    {/each}
</main>

<style>
    :global(body) {
        margin: 0;
        background: #f8f6ee;
        color: #283429;
        font-family: system-ui, sans-serif;
    }
    main {
        max-width: 1000px;
        margin: auto;
        padding: 24px;
    }
    a {
        color: #385d43;
    }
    h1 {
        font-size: 28px;
    }
    h2 {
        font-size: 16px;
    }
    small {
        font-weight: 400;
        color: #5d705e;
    }
    section {
        border-top: 1px solid #d1d7c9;
        padding: 18px 0;
    }
    .revenue-font {
        display: grid;
        gap: 6px;
        margin-bottom: 14px;
    }
    .revenue-font figcaption {
        text-align: left;
    }
    .controls {
        display: flex;
        gap: 18px;
        margin-bottom: 24px;
    }
    label {
        display: grid;
        gap: 6px;
        font-size: 12px;
    }
    select {
        min-height: 44px;
        padding: 10px;
        font: inherit;
    }
    .rotations {
        display: grid;
        grid-template-columns: repeat(6, minmax(0, 1fr));
        gap: 15px;
    }
    figure {
        margin: 0;
    }
    figcaption {
        text-align: center;
        font-size: 12px;
        margin-top: 5px;
    }
    .sizes {
        display: flex;
        flex-wrap: wrap;
        align-items: end;
        gap: 24px;
    }
    .preprinted-tiles,
    .replacement {
        display: flex;
        flex-wrap: wrap;
        gap: 24px;
    }
    .replacement figure {
        width: 210px;
    }
    @media (max-width: 600px) {
        .rotations {
            grid-template-columns: repeat(3, minmax(0, 1fr));
        }
    }
</style>
