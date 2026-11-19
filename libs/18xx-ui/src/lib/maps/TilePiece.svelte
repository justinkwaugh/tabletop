<script lang="ts">
    import type { HexOrientation } from '@tabletop/common'
    import TileArtwork from '../tiles/TileArtwork.svelte'
    import { createTileDrawing } from '../tiles/tileDrawing.js'
    import {
        ClassicTileAppearance,
        tileDrawingStyle,
        type TileAppearance
    } from '../tiles/tileAppearance.js'
    import type { PieceHex } from './tilePiece.js'

    let {
        hexes,
        viewWidth,
        viewHeight,
        width,
        height,
        orientation,
        appearance = ClassicTileAppearance,
        label,
        shadow = false
    }: {
        hexes: readonly PieceHex[]
        /** The piece's span in map units, which its pixel size draws. */
        viewWidth: number
        viewHeight: number
        width: number
        height: number
        orientation: HexOrientation
        appearance?: TileAppearance
        label: string
        shadow?: boolean
    } = $props()
    const drawn = $derived(
        hexes.map((hex) => ({
            hex,
            drawing: createTileDrawing(
                hex.face,
                orientation,
                hex.rotation,
                hex.layout,
                tileDrawingStyle(appearance)
            )
        }))
    )
    const seamless = $derived({ ...appearance, edge: { color: 'none', width: 0 } })
</script>

<!-- One drawing, so no hex's shadow falls on another and the hexes meet without a seam. -->
<svg
    viewBox={`${-viewWidth / 2} ${-viewHeight / 2} ${viewWidth} ${viewHeight}`}
    {width}
    {height}
    role="img"
    aria-label={label}
>
    {#if shadow}
        <g data-tile-shadow fill="#000" aria-hidden="true">
            {#each drawn as { hex, drawing }, index (index)}<g
                    transform={`translate(${hex.offset.x} ${hex.offset.y})`}
                    ><polygon
                        points={drawing.polygon}
                        transform="translate(0 3.5) scale(1.03)"
                        opacity="0.15"
                    ></polygon><polygon
                        points={drawing.polygon}
                        transform="translate(0 2)"
                        opacity="0.35"
                    ></polygon></g
                >{/each}
        </g>
    {/if}
    {#each drawn as { hex, drawing }, index (index)}<g
            transform={`translate(${hex.offset.x} ${hex.offset.y})`}
            ><TileArtwork face={hex.face} {drawing} appearance={seamless} joints={hex.joints} /></g
        >{/each}
    <g
        fill="none"
        stroke={appearance.edge?.color ?? '#453e32'}
        stroke-width={appearance.edge?.width ?? 0.65}
        stroke-linecap="round"
        aria-hidden="true"
    >
        {#each drawn as { hex }, index (index)}<g
                transform={`translate(${hex.offset.x} ${hex.offset.y})`}
                >{#each hex.outline as { start, end }, side (side)}<line
                        x1={start.x}
                        y1={start.y}
                        x2={end.x}
                        y2={end.y}
                    ></line>{/each}</g
            >{/each}
    </g>
</svg>

<style>
    svg {
        display: block;
        overflow: visible;
    }
</style>
