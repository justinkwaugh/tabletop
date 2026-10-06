<script lang="ts">
    import { BoardColumns, BoardRows } from '@tabletop/marracash'
    import { CellSize, WallThickness } from '$lib/utils/boardGeometry.js'
    import { StreetDustPatternId } from '$lib/utils/ground.js'

    const WallShadowId = 'marracash-wall-shadow'
    const WallShadowClipId = 'marracash-wall-shadow-clip'
    const WallShadowOffset = { x: 4, y: 5 }
    const WallShadowWidth = 14

    const street = {
        x: WallThickness,
        y: WallThickness,
        width: BoardColumns * CellSize,
        height: BoardRows * CellSize
    }
</script>

<defs>
    <filter id={WallShadowId} x="-5%" y="-5%" width="110%" height="110%">
        <feGaussianBlur stdDeviation="5"></feGaussianBlur>
    </filter>
    <clipPath id={WallShadowClipId}>
        <rect x={street.x} y={street.y} width={street.width} height={street.height}></rect>
    </clipPath>
</defs>

<rect
    x={street.x}
    y={street.y}
    width={street.width}
    height={street.height}
    fill="url(#{StreetDustPatternId})"
></rect>
<g clip-path="url(#{WallShadowClipId})">
    <rect
        x={street.x - WallShadowWidth / 2 + WallShadowOffset.x}
        y={street.y - WallShadowWidth / 2 + WallShadowOffset.y}
        width={street.width + WallShadowWidth}
        height={street.height + WallShadowWidth}
        fill="none"
        stroke="#3a1c0c"
        stroke-opacity="0.3"
        stroke-width={WallShadowWidth}
        filter="url(#{WallShadowId})"
    ></rect>
</g>
