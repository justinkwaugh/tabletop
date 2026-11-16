<script lang="ts">
    import type { RevenueStageColors } from '../colors/revenueStageColors.js'
    import { HexOrientation } from '@tabletop/common'
    import type { TileFace, TileRotation } from '@tabletop/18xx'
    import type { Snippet } from 'svelte'
    import { createTileDrawing, type TileDrawing, type TileLayout } from './tileDrawing.js'
    import { tileDrawingStyle, type TileAppearance } from './tileAppearance.js'
    import TileArtwork from './TileArtwork.svelte'

    let {
        face,
        printedNumber,
        orientation = HexOrientation.Flat,
        rotation = 0,
        layout,
        appearance,
        revenueStageColors,
        size = 120,
        label,
        highlightedPathIds,
        trackOverlay,
        overlays,
        shadow = false
    }: {
        face: TileFace
        printedNumber?: string
        orientation?: HexOrientation
        rotation?: TileRotation
        layout?: TileLayout
        revenueStageColors?: RevenueStageColors
        appearance?: TileAppearance
        size?: number | string
        label?: string
        highlightedPathIds?: readonly string[]
        trackOverlay?: Snippet<[TileDrawing]>
        overlays?: Snippet<[TileDrawing]>
        /**
         * Draws the tile's shadow beneath it as shapes of its own, for a tile lifted off the map;
         * a CSS filter would be redrawn on every frame the tile moves.
         */
        shadow?: boolean
    } = $props()
    const drawing = $derived(
        createTileDrawing(face, orientation, rotation, layout, tileDrawingStyle(appearance))
    )
    const description = $derived(
        label ??
            `${printedNumber ? `Tile ${printedNumber}` : 'Printed hex'}, ${appearance?.colorNames?.[face.color] ?? face.color}${face.labels.length ? `, ${face.labels.join(', ')}` : ''}, rotation ${rotation * 60} degrees`
    )
</script>

<svg
    viewBox="-53 -53 106 106"
    width={size}
    height={size}
    role="img"
    aria-label={description}
    data-tile-rotation={rotation}
>
    {#if shadow}
        <g data-tile-shadow fill="#000" aria-hidden="true">
            <polygon
                points={drawing.polygon}
                transform="translate(0 3.5) scale(1.03)"
                opacity="0.15"
            ></polygon>
            <polygon points={drawing.polygon} transform="translate(0 2)" opacity="0.35"></polygon>
        </g>
    {/if}
    <TileArtwork
        {face}
        {drawing}
        {appearance}
        {revenueStageColors}
        {highlightedPathIds}
        {trackOverlay}
        {overlays}
    />
</svg>

<style>
    svg {
        display: block;
        max-width: 100%;
        height: auto;
        overflow: visible;
    }
</style>
