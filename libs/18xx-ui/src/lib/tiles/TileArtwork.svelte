<script lang="ts">
    import { contrastingTextColor } from '../colors/contrastingTextColor.js'
    import { assert, assertExists } from '@tabletop/common'
    import type { TileFace } from '@tabletop/18xx'
    import type { Snippet } from 'svelte'
    import type { TileDrawing } from './tileDrawing.js'
    import { ClassicTileAppearance, type TileAppearance } from './tileAppearance.js'

    let {
        face,
        drawing,
        appearance = ClassicTileAppearance,
        highlightedPathIds = [],
        revenueStageColors = {},
        showZeroRevenue = true,
        trackOverlay,
        overlays
    }: {
        face: TileFace
        drawing: TileDrawing
        appearance?: TileAppearance
        revenueStageColors?: Readonly<Record<string, string>>
        highlightedPathIds?: readonly string[]
        showZeroRevenue?: boolean
        trackOverlay?: Snippet<[TileDrawing]>
        overlays?: Snippet<[TileDrawing]>
    } = $props()
    const fill = $derived.by(() => {
        const color = appearance.colors[face.color]
        assertExists(color, `Tile palette requires color ${face.color}`)
        assert(
            (face.symbols ?? []).every((symbol) => symbol === 'port'),
            'Unsupported tile symbol'
        )
        return color
    })
</script>

<g class="tile-artwork" data-color={face.color}>
    <polygon points={drawing.polygon} {fill} stroke="#453e32" stroke-width="0.65"></polygon>
    <g fill="none" stroke-linecap="butt">
        {#each drawing.paths as path (path.id)}
            <path
                d={path.d}
                stroke={appearance.paper}
                stroke-width={appearance.trackWidth + appearance.trackBorderWidth}
            ></path>
        {/each}
        {#each drawing.paths as path (path.id)}
            <g data-path-id={path.id}>
                <path d={path.d} stroke={appearance.ink} stroke-width={appearance.trackWidth}
                ></path>
            </g>
        {/each}
    </g>
    {#each drawing.paths.filter((path) => highlightedPathIds.includes(path.id)) as path (path.id)}
        <path
            data-highlight-path={path.id}
            d={path.d}
            fill="none"
            stroke="#b32747"
            stroke-width="2.8"
        ></path>
    {/each}
    {@render trackOverlay?.(drawing)}
    {#each drawing.nodes as { node, center, slots, townAngle } (node.id)}
        <g data-node-id={node.id}>
            {#if node.kind === 'city'}
                {#if slots.length > 1}
                    <path
                        d={`M ${slots.map((point) => `${point.x},${point.y}`).join(' L ')} Z`}
                        fill={appearance.ink}
                        stroke={appearance.ink}
                        stroke-width="23"
                        stroke-linejoin="round"
                    ></path>
                {/if}
                {#each slots as point, index}
                    <circle
                        data-station-slot={index}
                        cx={point.x}
                        cy={point.y}
                        r="10"
                        fill={appearance.paper}
                        stroke={appearance.ink}
                        stroke-width="1.1"
                    ></circle>
                {/each}
                {#if slots.length === 0}<circle
                        cx={center.x}
                        cy={center.y}
                        r="7"
                        fill={appearance.ink}
                    ></circle>{/if}
            {:else if node.kind === 'town'}
                {#if appearance.townMarker === 'bar' && townAngle !== undefined}
                    <rect
                        data-town-marker="bar"
                        x="-7"
                        y="-3"
                        width="14"
                        height="6"
                        transform={`translate(${center.x} ${center.y}) rotate(${townAngle})`}
                        fill={appearance.ink}
                        stroke={appearance.paper}
                        stroke-width="1"
                    ></rect>
                {:else}
                    <circle
                        data-town-marker="dot"
                        cx={center.x}
                        cy={center.y}
                        r={townAngle === undefined ? 6.3 : 4.2}
                        fill={appearance.ink}
                        stroke={appearance.paper}
                        stroke-width="0.7"
                    ></circle>
                {/if}
            {:else if node.kind === 'offboard'}
                <rect
                    x={center.x - 7}
                    y={center.y - 7}
                    width="14"
                    height="14"
                    rx="2"
                    fill={appearance.ink}
                ></rect>
            {:else}
                <circle cx={center.x} cy={center.y} r="3" fill={appearance.ink}></circle>
            {/if}
        </g>
    {/each}
    {@render overlays?.(drawing)}
    <g class="annotations" text-anchor="middle" fill={appearance.ink}>
        {#if face.upgradeCost !== undefined}
            <g
                data-tile-upgrade-cost
                transform={`translate(${drawing.upgradeCostPosition.x} ${drawing.upgradeCostPosition.y})`}
            >
                <rect
                    x="-9"
                    y="-5"
                    width="18"
                    height="10"
                    rx="1"
                    fill={appearance.paper}
                    stroke={appearance.ink}
                    stroke-width="0.5"
                ></rect>
                <text font-size="6.5" font-weight="650">{face.upgradeCost}</text>
            </g>
        {/if}
        {#if face.symbols?.includes('port')}
            <g
                data-tile-symbol="port"
                transform={`translate(${drawing.symbolPosition.x} ${drawing.symbolPosition.y})`}
            >
                <circle r="8" fill={appearance.paper}></circle>
                <g fill="none" stroke={appearance.ink} stroke-width="1.5" stroke-linecap="round">
                    <circle cy="-4" r="1.5"></circle>
                    <path
                        d="M 0 -2.5 V 6 M -3 -1 H 3 M -5 2 Q -5 6 0 6 Q 5 6 5 2 M -5 2 L -6 3 M 5 2 L 6 3"
                    ></path>
                </g>
            </g>
        {/if}
        {#each drawing.nodes as { node, revenuePosition, revenueCells } (node.id)}
            {#if node.kind !== 'junction' && (showZeroRevenue || node.revenue.kind === 'staged' || node.revenue.amount !== 0)}
                <g
                    data-revenue-for={node.id}
                    transform={`translate(${revenuePosition.x} ${revenuePosition.y})`}
                >
                    {#if node.revenue.kind === 'fixed'}
                        <circle r="8.7" fill={appearance.paper} stroke="#5d584a" stroke-width="0.55"
                        ></circle>
                        <text font-size="10" font-weight="750">{node.revenue.amount}</text>
                    {:else}
                        {#each revenueCells as cell}
                            {@const color =
                                revenueStageColors[cell.stage] ??
                                appearance.colors[cell.stage] ??
                                appearance.paper}
                            <g
                                transform={`translate(${cell.x - revenuePosition.x} ${cell.y - revenuePosition.y})`}
                                data-revenue-stage={cell.stage}
                            >
                                <rect
                                    x={-cell.width / 2}
                                    y={-cell.height / 2}
                                    width={cell.width}
                                    height={cell.height}
                                    fill={color}
                                    stroke={appearance.ink}
                                    stroke-width="0.5"
                                ></rect>
                                <text
                                    fill={contrastingTextColor(color)}
                                    font-size="9"
                                    font-weight="650"
                                    aria-label={`${cell.stage}: ${cell.amount}`}>{cell.amount}</text
                                >
                            </g>
                        {/each}
                    {/if}
                </g>
            {/if}
        {/each}
        {#if face.labels.length}
            <text
                data-tile-label
                x={drawing.labelPosition.x}
                y={drawing.labelPosition.y}
                font-size="12"
                font-weight="850"
                paint-order="stroke"
                stroke={fill}
                stroke-width="2.5">{face.labels.join(' ')}</text
            >
        {/if}
    </g>
</g>

<style>
    .tile-artwork {
        text-rendering: geometricPrecision;
        font-family: var(--tile-font-family, ui-sans-serif, system-ui, sans-serif);
    }
    .annotations {
        pointer-events: none;
    }
    .annotations text {
        dominant-baseline: central;
    }
</style>
