<script lang="ts">
    import { centredTextShift } from '../presentation/textBaseline.js'
    import { HexOrientation } from '@tabletop/common'
    import type { StationAppearance } from '../maps/stationPresentation.js'
    import { contrastingTextColor } from '../colors/contrastingTextColor.js'
    import TileArtwork from '../tiles/TileArtwork.svelte'
    let {
        appearance,
        size = 40,
        x = 0,
        y = 0
    }: {
        appearance: StationAppearance
        size?: number
        x?: number
        y?: number
    } = $props()
    const InitialsFontSizes = [16, 16, 16, 14, 11.5, 9.5]
    const labelFitsTokenFontSize = $derived(
        InitialsFontSizes[Math.min(appearance.label.length, InitialsFontSizes.length - 1)]
    )
    // A tile spans its hex (radius 50) plus the room Tile's viewBox leaves for its outline.
    const tileBox = $derived(
        appearance.tiles?.orientation === HexOrientation.Pointy
            ? { width: 92.6, height: 106 }
            : { width: 106, height: 92.6 }
    )
    const tileWidth = $derived((40 * tileBox.width) / tileBox.height)
    const width = $derived(appearance.tiles ? appearance.tiles.tiles.length * tileWidth : 40)
</script>

<svg
    {x}
    {y}
    width={(size * width) / 40}
    height={size}
    viewBox={`0 0 ${width} 40`}
    aria-hidden="true"
>
    {#if appearance.tiles}
        {#each appearance.tiles.tiles as tile, index (index)}<svg
                x={index * tileWidth}
                width={tileWidth}
                height="40"
                viewBox={`${-tileBox.width / 2} ${-tileBox.height / 2} ${tileBox.width} ${tileBox.height}`}
                ><TileArtwork
                    face={tile.face}
                    drawing={tile.drawing}
                    appearance={appearance.tiles.appearance}
                /></svg
            >{/each}
    {:else if appearance.solid}
        <circle cx="20" cy="20" r="20" fill={appearance.color}></circle>
    {:else if appearance.imageUrl}
        <image href={appearance.imageUrl} width="40" height="40"></image>
    {:else}
        <circle cx="20" cy="20" r="20" fill={appearance.color}></circle>
        <text
            x="20"
            y="20"
            text-anchor="middle"
            dy={centredTextShift(labelFitsTokenFontSize)}
            font-family="ui-sans-serif, system-ui, sans-serif"
            font-size={labelFitsTokenFontSize}
            font-weight="700"
            fill={contrastingTextColor(appearance.color)}>{appearance.label}</text
        >
    {/if}
</svg>
