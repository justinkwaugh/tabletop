<script lang="ts">
    import type { BoundingBox } from '@tabletop/common'
    import { townTileImage } from '$lib/images/tileImages.js'
    import type { EndTrackerStatus } from '$lib/utils/boardLayout.js'
    import { localHexPoints, pointsAttribute } from '$lib/utils/boardLayout.js'

    let { status, box }: { status: EndTrackerStatus; box: BoundingBox } = $props()

    const uid = $props.id()
    const clipId = `pp-end-tracker-${uid}`
    const icon = pointsAttribute(localHexPoints(0.27))
    const rows = { red: 125, promontory: 200 }
    const iconX = 44
    const textX = 80
    const redTile = townTileImage('tile.red.dividend')
    const redLine = $derived(
        `${status.redTilesUncovered} red ${status.redTilesUncovered === 1 ? 'tile' : 'tiles'} uncovered (≤ 1)${status.redTilesMet ? ' ✓' : ''}`
    )
</script>

<!-- R-6.1, R-6.1-H1: the game ends after a turn once both lines are met. -->
<g
    transform="translate({box.x} {box.y})"
    data-end-tracker
    data-red-tiles-uncovered={status.redTilesUncovered}
    data-promontory-taken={status.promontoryTaken}
>
    <defs>
        <clipPath id={clipId}>
            <polygon points={icon}></polygon>
        </clipPath>
    </defs>
    <rect
        width={box.width}
        height={box.height}
        rx="18"
        fill="var(--pp-halo)"
        fill-opacity="0.78"
        stroke="var(--pp-paper)"
        stroke-width="4"
    ></rect>
    <text x="22" y="56" class="pp-board-caption" font-size="29" fill="var(--pp-paper)"
        >GAME ENDS WHEN BOTH</text
    >
    <g transform="translate({iconX} {rows.red})">
        <g clip-path="url(#{clipId})">
            <image href={redTile.src} x="-34" y="-34" width="68" height="68"></image>
        </g>
    </g>
    <text x={textX} y={rows.red} class="pp-board-line" font-size="29" fill="var(--pp-text)">
        {redLine}
    </text>
    <g transform="translate({iconX} {rows.promontory})">
        <polygon points={icon} fill="var(--pp-table)" stroke="var(--pp-paper)" stroke-width="4"
        ></polygon>
    </g>
    <text x={textX} y={rows.promontory} class="pp-board-line" font-size="29" fill="var(--pp-text)">
        Promontory {status.promontoryTaken ? 'taken ✓' : 'open'}
    </text>
</g>
