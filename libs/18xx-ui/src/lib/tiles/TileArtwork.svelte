<script lang="ts">
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
        showZeroRevenue = true,
        trackOverlay,
        overlays
    }: {
        face: TileFace
        drawing: TileDrawing
        appearance?: TileAppearance
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
    <polygon points={drawing.polygon} {fill} stroke="#453e32" stroke-width="0.65" />
    <g fill="none" stroke-linecap="butt">
        {#each drawing.paths as path (path.id)}
            <path
                d={path.d}
                stroke={appearance.paper}
                stroke-width={appearance.trackWidth + appearance.trackBorderWidth}
            />
        {/each}
        {#each drawing.paths as path (path.id)}
            <g data-path-id={path.id}>
                <path d={path.d} stroke={appearance.ink} stroke-width={appearance.trackWidth} />
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
        />
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
                    />
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
                    />
                {/each}
                {#if slots.length === 0}<circle
                        cx={center.x}
                        cy={center.y}
                        r="7"
                        fill={appearance.ink}
                    />{/if}
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
                    />
                {:else}
                    <circle
                        data-town-marker="dot"
                        cx={center.x}
                        cy={center.y}
                        r={townAngle === undefined ? 6.3 : 4.2}
                        fill={appearance.ink}
                        stroke={appearance.paper}
                        stroke-width="0.7"
                    />
                {/if}
            {:else if node.kind === 'offboard'}
                <rect
                    x={center.x - 7}
                    y={center.y - 7}
                    width="14"
                    height="14"
                    rx="2"
                    fill={appearance.ink}
                />
            {:else}
                <circle cx={center.x} cy={center.y} r="3" fill={appearance.ink} />
            {/if}
        </g>
    {/each}
    {@render overlays?.(drawing)}
    <g class="annotations" text-anchor="middle" dominant-baseline="central" fill={appearance.ink}>
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
                />
                <text font-size="6.5" font-weight="650">{face.upgradeCost}</text>
            </g>
        {/if}
        {#if face.symbols?.includes('port')}
            <g
                data-tile-symbol="port"
                transform={`translate(${drawing.symbolPosition.x} ${drawing.symbolPosition.y})`}
            >
                <circle r="8" fill={appearance.paper} />
                <g fill="none" stroke={appearance.ink} stroke-width="1.5" stroke-linecap="round">
                    <circle cy="-4" r="1.5" />
                    <path
                        d="M 0 -2.5 V 6 M -3 -1 H 3 M -5 2 Q -5 6 0 6 Q 5 6 5 2 M -5 2 L -6 3 M 5 2 L 6 3"
                    />
                </g>
            </g>
        {/if}
        {#each drawing.nodes as { node, revenuePosition } (node.id)}
            {#if node.kind !== 'junction' && (showZeroRevenue || node.revenue.kind === 'staged' || node.revenue.amount !== 0)}
                <g
                    data-revenue-for={node.id}
                    transform={`translate(${revenuePosition.x} ${revenuePosition.y})`}
                >
                    {#if node.revenue.kind === 'fixed'}
                        <circle
                            r="8.7"
                            fill={appearance.paper}
                            stroke="#5d584a"
                            stroke-width="0.55"
                        />
                        <text font-size="10" font-weight="750">{node.revenue.amount}</text>
                    {:else}
                        <rect
                            x="-17"
                            y={-node.revenue.values.length * 4.5 - 2}
                            width="34"
                            height={node.revenue.values.length * 9 + 4}
                            rx="3"
                            fill={appearance.paper}
                        />
                        {#each node.revenue.values as value, index}
                            <text
                                y={(index - (node.revenue.values.length - 1) / 2) * 9}
                                font-size="6.5">{value.stage} {value.amount}</text
                            >
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
</style>
