<script lang="ts">
    import { HexOrientation } from '@tabletop/common'
    import type { TileFace, TileRotation } from '@tabletop/18xx'
    import type { Snippet } from 'svelte'
    import { createTileDrawing, type TileDrawing, type TileLayout } from './tileDrawing.js'
    import type { TileAppearance } from './tileAppearance.js'
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
        overlays
    }: {
        face: TileFace
        printedNumber?: string
        orientation?: HexOrientation
        rotation?: TileRotation
        layout?: TileLayout
        revenueStageColors?: Readonly<Record<string, string>>
        appearance?: TileAppearance
        size?: number | string
        label?: string
        highlightedPathIds?: readonly string[]
        trackOverlay?: Snippet<[TileDrawing]>
        overlays?: Snippet<[TileDrawing]>
    } = $props()
    const drawing = $derived(createTileDrawing(face, orientation, rotation, layout))
    const description = $derived(
        label ??
            `${printedNumber ? `Tile ${printedNumber}` : 'Printed hex'}, ${face.color}${face.labels.length ? `, ${face.labels.join(', ')}` : ''}, rotation ${rotation * 60} degrees`
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
