<script lang="ts">
    import { BoardColumns, BoardRows } from '@tabletop/marracash'
    import { CellSize, WallThickness } from '$lib/utils/boardGeometry.js'
    import { StreetDustPatternId } from '$lib/utils/ground.js'

    const WallShadowId = 'marracash-wall-shadow'
    const WallShadowDepth = 14
    const WallShadowColor = '#3a1c0c'
    const WallShadowOpacity = 0.3

    const street = {
        x: WallThickness,
        y: WallThickness,
        width: BoardColumns * CellSize,
        height: BoardRows * CellSize
    }

    // The walls are lit from the top-left, so their shadow falls on the street along its top and
    // left edges, fading away from the wall.
    const shadows = [
        {
            id: `${WallShadowId}-top`,
            fade: { x2: 0, y2: 1 },
            rect: { x: street.x, y: street.y, width: street.width, height: WallShadowDepth }
        },
        {
            id: `${WallShadowId}-left`,
            fade: { x2: 1, y2: 0 },
            rect: { x: street.x, y: street.y, width: WallShadowDepth, height: street.height }
        }
    ]
</script>

<defs>
    {#each shadows as shadow (shadow.id)}
        <linearGradient id={shadow.id} x1="0" y1="0" x2={shadow.fade.x2} y2={shadow.fade.y2}>
            <stop offset="0" stop-color={WallShadowColor} stop-opacity={WallShadowOpacity}></stop>
            <stop offset="1" stop-color={WallShadowColor} stop-opacity="0"></stop>
        </linearGradient>
    {/each}
</defs>

<rect
    x={street.x}
    y={street.y}
    width={street.width}
    height={street.height}
    fill="url(#{StreetDustPatternId})"
></rect>
{#each shadows as shadow (shadow.id)}
    <rect
        x={shadow.rect.x}
        y={shadow.rect.y}
        width={shadow.rect.width}
        height={shadow.rect.height}
        fill="url(#{shadow.id})"
    ></rect>
{/each}
