<script lang="ts">
    import { BOARD_HEIGHT, BOARD_PADDING, BOARD_WIDTH } from '$lib/utils/boardGeometry.js'
    import MapLayer from './board/MapLayer.svelte'
    import TrackLayer from './board/TrackLayer.svelte'
    import TargetLayer from './board/TargetLayer.svelte'
    import RailroadCards from './board/RailroadCards.svelte'
    import TurnOrderTrack from './board/TurnOrderTrack.svelte'
    import TitleBlock from './board/TitleBlock.svelte'
    import Legend from './board/Legend.svelte'
    import IncomeTrack from './board/IncomeTrack.svelte'
    import { APPROACH_HATCH, APPROACH_HATCH_ID } from '$lib/utils/terrainStyle.js'

    const PADDING = BOARD_PADDING
    const FRAME = 8
    const width = BOARD_WIDTH + 2 * PADDING
    const height = BOARD_HEIGHT + 2 * PADDING
</script>

<svg
    {width}
    {height}
    viewBox={`${-PADDING} ${-PADDING} ${width} ${height}`}
    class="block"
    role="img"
    aria-label="Map of the German states"
>
    <defs>
        <pattern
            id="po-sea"
            width="7"
            height="7"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
        >
            <rect width="7" height="7" fill="#c4d3d6"></rect>
            <line x1="0" y1="0" x2="0" y2="7" stroke="#aec1c5" stroke-width="1.5"></line>
        </pattern>
        <pattern
            id={APPROACH_HATCH_ID}
            width={APPROACH_HATCH.gap}
            height={APPROACH_HATCH.gap}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
        >
            <line
                x1="0"
                y1="0"
                x2="0"
                y2={APPROACH_HATCH.gap}
                stroke={APPROACH_HATCH.color}
                stroke-width={APPROACH_HATCH.width}
            ></line>
        </pattern>
    </defs>
    <rect
        x={FRAME / 2 - PADDING}
        y={FRAME / 2 - PADDING}
        width={width - FRAME}
        height={height - FRAME}
        rx="12"
        fill="url(#po-sea)"
        stroke="#0f1a2c"
        stroke-width={FRAME}
    ></rect>
    <TitleBlock />
    <Legend />
    <IncomeTrack />
    <TurnOrderTrack />
    <MapLayer />
    <TrackLayer />
    <TargetLayer />
    <RailroadCards />
</svg>
