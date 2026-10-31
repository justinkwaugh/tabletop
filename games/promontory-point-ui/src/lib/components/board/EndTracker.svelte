<script lang="ts">
    import type { BoundingBox } from '@tabletop/common'
    import { UNCOVERED_RED_TILES_AT_END } from '@tabletop/promontory-point'
    import { townTileImage } from '$lib/images/tileImages.js'
    import type { EndTrackerStatus } from '$lib/utils/boardLayout.js'
    import { localHexPoints, pointsAttribute } from '$lib/utils/boardLayout.js'
    import StripCard from './StripCard.svelte'

    let { status, box }: { status: EndTrackerStatus; box: BoundingBox } = $props()

    const uid = $props.id()
    const clipId = `pp-end-tracker-${uid}`
    const icon = pointsAttribute(localHexPoints(0.42))
    const rows = { red: 170, promontory: 320 }
    const iconX = 80
    const textX = 160
    const lineGap = 30
    const redTile = townTileImage('tile.red.dividend')
    const redLine = $derived(
        `${status.redTilesUncovered} red ${status.redTilesUncovered === 1 ? 'town' : 'towns'} open`
    )
    const redNote = $derived(
        `at most ${UNCOVERED_RED_TILES_AT_END}${status.redTilesMet ? ' ✓' : ''}`
    )
</script>

<!-- R-6.1, R-6.1-H1: the game ends after a turn once both lines are met. -->
<g
    data-end-tracker
    data-red-tiles-uncovered={status.redTilesUncovered}
    data-red-tiles-met={status.redTilesMet}
    data-promontory-taken={status.promontoryTaken}
>
    <StripCard {box} title="GAME ENDS WHEN BOTH">
        <defs>
            <clipPath id={clipId}>
                <polygon points={icon}></polygon>
            </clipPath>
        </defs>
        <g transform="translate({iconX} {rows.red})">
            <g clip-path="url(#{clipId})">
                <image href={redTile.src} x="-52" y="-52" width="104" height="104"></image>
            </g>
        </g>
        <text
            x={textX}
            y={rows.red - lineGap}
            class="pp-board-line"
            font-size="50"
            fill="var(--pp-ink)"
            data-end-line="red">{redLine}</text
        >
        <text
            x={textX}
            y={rows.red + lineGap}
            class="pp-board-line pp-board-italic"
            font-size="44"
            fill="var(--pp-ink-sub)">{redNote}</text
        >
        <g transform="translate({iconX} {rows.promontory})">
            <polygon points={icon} fill="var(--pp-charcoal)" stroke="var(--pp-ink)" stroke-width="5"
            ></polygon>
        </g>
        <text
            x={textX}
            y={rows.promontory - lineGap}
            class="pp-board-line"
            font-size="50"
            fill="var(--pp-ink)"
            data-end-line="promontory">Promontory</text
        >
        <text
            x={textX}
            y={rows.promontory + lineGap}
            class="pp-board-line pp-board-italic"
            font-size="44"
            fill="var(--pp-ink-sub)">{status.promontoryTaken ? 'taken ✓' : 'open'}</text
        >
    </StripCard>
</g>
